import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  validateArtifactIdentity,
  validateAuthorizationContext,
} from "@/lib/campaign/composition-artifacts/identity";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  PersistArtifactResult,
} from "@/lib/campaign/composition-artifacts/types";

import { SQUARE_PREPARATION_ORIGIN, SQUARE_PREPARATION_SOURCE } from "./recipe";
import { isCompatiblePreparedArtifact } from "./reuse-compatibility";
import { verifyPreparedReuseEvidence } from "./reuse-evidence";
import {
  transformSquare1024To1152,
  type SquareTransformResult,
} from "./transform";
import type {
  PrepareSquareInput,
  PrepareSquareInvalidReason,
  PrepareSquareResult,
} from "./types";

/**
 * F60.2 (quick 261111-idz) — Preparação determinística 1024×1024 → 1152×1152
 * sobre os contratos da F60.1.
 *
 * Ordem: recusas de entrada → retrieve da fonte → probe do prepared (linha +
 * bytes + evidência DURÁVEL) → transform → `persistCompositionArtifact` →
 * readback. Nenhum mecanismo paralelo de idempotência (sem chave, lock, tabela,
 * retry, `upsert`, delete ou correção). A F60.1 é a única autoridade de
 * idempotência/conflito. Nenhuma URL, campanha, crédito ou exclusão é tocada.
 */

const PATH_KEYS = ["storagePath", "path", "bucket", "storageBucket"] as const;
const URL_KEYS = ["url", "publicUrl", "signedUrl", "downloadUrl"] as const;

type DeniedReason = Extract<
  PrepareSquareResult,
  { kind: "authorization_denied" }
>["reason"];

type UnavailableReason = Extract<
  PrepareSquareResult,
  { kind: "source_unavailable" }
>["reason"];

type UnavailableResult = Extract<
  PrepareSquareResult,
  { kind: "source_unavailable" }
>;

type ReadbackReason = Extract<
  PrepareSquareResult,
  { kind: "readback_failed" }
>["reason"];

export interface PrepareSquareDeps {
  readonly client?: SupabaseClient;
  /** Costura de teste: prova que `reused` não transforma. Default = receita real. */
  readonly transform?: (bytes: Buffer) => Promise<SquareTransformResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasAnyOwn(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function invalidInput(reason: PrepareSquareInvalidReason): PrepareSquareResult {
  return Object.freeze({ kind: "invalid_input" as const, reason });
}

function sourceUnavailable(
  reason: UnavailableReason,
  extra?: {
    readonly detail?: string;
    readonly artifact?: ArtifactRecord;
  },
): PrepareSquareResult {
  const result: {
    kind: "source_unavailable";
    reason: UnavailableReason;
    detail?: string;
    artifact?: ArtifactRecord;
  } = { kind: "source_unavailable", reason };
  if (extra?.detail !== undefined) result.detail = extra.detail;
  if (extra?.artifact !== undefined) result.artifact = extra.artifact;
  return Object.freeze(result);
}

function toDeniedReason(reason: string): DeniedReason | null {
  if (
    reason === "not_owner" ||
    reason === "store_mismatch" ||
    reason === "identity_conflict"
  ) {
    return reason;
  }
  return null;
}

function readbackFailed(
  reason: ReadbackReason,
  extra?: {
    readonly detail?: string;
    readonly artifact?: ArtifactRecord;
  },
): PrepareSquareResult {
  const result: {
    kind: "readback_failed";
    reason: ReadbackReason;
    detail?: string;
    artifact?: ArtifactRecord;
  } = { kind: "readback_failed", reason };
  if (extra?.detail !== undefined) result.detail = extra.detail;
  if (extra?.artifact !== undefined) result.artifact = extra.artifact;
  return Object.freeze(result);
}

/** Traduz o desfecho da autoridade F60.1 para o contrato público deste módulo. */
function mapPersistResult(result: PersistArtifactResult): PrepareSquareResult {
  switch (result.kind) {
    case "content_conflict":
    case "identity_conflict":
    case "metadata_conflict":
    case "provenance_conflict":
      return Object.freeze({
        kind: "conflict" as const,
        reason: result.kind,
        detail: result.reason,
        existing: result.existing,
      });
    case "invalid_input":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "invalid_input" as const,
        detail: result.reason,
      });
    case "integrity_failure":
      // Falha de revalidação da FONTE entre retrieve e persist (TOCTOU).
      if (result.reason === "artifact_absent") {
        return sourceUnavailable("absent", {
          detail: `persist_source_revalidation:${result.reason}`,
        });
      }
      if (result.reason === "artifact_invalid") {
        return sourceUnavailable("invalid", {
          detail: `persist_source_revalidation:${result.reason}`,
        });
      }
      if (result.reason === "artifact_indeterminate") {
        return sourceUnavailable("indeterminate", {
          detail: `persist_source_revalidation:${result.reason}`,
        });
      }
      // Demais falhas de integridade referem-se aos bytes do DERIVADO.
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "integrity_failure" as const,
        detail: result.reason,
      });
    case "persistence_failure":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: result.reason,
        storagePath: result.storagePath,
      });
    case "indeterminate":
      return Object.freeze({ kind: "indeterminate" as const, stage: "persist" as const });
    default:
      // `created`/`reused` são tratados antes de chamar este mapeamento.
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: "unexpected_persist_outcome",
      });
  }
}

function reassertedSourceIdentity(
  identity: ArtifactIdentity,
): ArtifactIdentity {
  return Object.freeze({
    storeId: identity.storeId,
    campaignId: identity.campaignId,
    operationId: identity.operationId,
    role: SQUARE_PREPARATION_SOURCE.role,
  });
}

export async function prepareSquareForExpansion(
  input: PrepareSquareInput,
  deps: PrepareSquareDeps = {},
): Promise<PrepareSquareResult> {
  const client = deps.client;
  const depsRef = { client };
  const rawInput: Record<string, unknown> = isRecord(input)
    ? (input as unknown as Record<string, unknown>)
    : {};

  // (1) Recusas de entrada — nenhum I/O.
  if (!isRecord(input)) return invalidInput("source_identity_invalid");
  if (hasAnyOwn(rawInput, PATH_KEYS)) return invalidInput("path_not_accepted");
  if (hasAnyOwn(rawInput, URL_KEYS)) return invalidInput("url_not_accepted");

  const rawSource = rawInput.source;
  if (!isRecord(rawSource)) return invalidInput("source_identity_invalid");
  if (hasAnyOwn(rawSource, PATH_KEYS)) return invalidInput("path_not_accepted");
  if (hasAnyOwn(rawSource, URL_KEYS)) return invalidInput("url_not_accepted");

  // (2) Identidades — validadas pela F60.1, sem aceitar path/bucket do chamador.
  const sourceIdentityResult = validateArtifactIdentity({
    storeId: rawSource.storeId,
    campaignId: rawSource.campaignId,
    operationId: rawSource.operationId,
    role: rawSource.role,
  });
  if (!sourceIdentityResult.ok) return invalidInput("source_identity_invalid");

  // A F60.1 aceita `square_prepared` como fonte; nós estreitamos para
  // `square_original` SEM alterar a F60.1.
  if (sourceIdentityResult.identity.role !== SQUARE_PREPARATION_SOURCE.role) {
    return invalidInput("source_role_not_original");
  }
  const sourceIdentity = reassertedSourceIdentity(
    sourceIdentityResult.identity,
  );

  const preparedOperationId = rawInput.preparedOperationId;
  if (
    typeof preparedOperationId !== "string" ||
    preparedOperationId.trim().length === 0
  ) {
    return invalidInput("prepared_operation_missing");
  }

  const preparedIdentityResult = validateArtifactIdentity({
    storeId: sourceIdentity.storeId,
    campaignId: sourceIdentity.campaignId,
    operationId: preparedOperationId,
    role: "square_prepared",
  });
  if (!preparedIdentityResult.ok) {
    return invalidInput("prepared_identity_invalid");
  }
  const preparedIdentity = preparedIdentityResult.identity;

  // (3) Autorização — antes de qualquer byte.
  const authorizationResult = validateAuthorizationContext(
    rawInput.authorization,
  );
  if (!authorizationResult.ok) {
    return invalidInput(authorizationResult.reason);
  }
  const authorization = authorizationResult.authorization;

  // (4) Retrieve da fonte.
  const sourceRetrieve = await retrieveCompositionArtifact(
    { identity: sourceIdentity, authorization },
    depsRef,
  );
  let sourceArtifact: ArtifactRecord;
  let sourceBytes: Buffer;

  if (sourceRetrieve.kind === "integral") {
    const artifact = sourceRetrieve.artifact;
    if (
      artifact.role !== SQUARE_PREPARATION_SOURCE.role ||
      artifact.width !== SQUARE_PREPARATION_SOURCE.width ||
      artifact.height !== SQUARE_PREPARATION_SOURCE.height ||
      artifact.mimeType !== SQUARE_PREPARATION_SOURCE.mimeType
    ) {
      return sourceUnavailable("invalid", {
        detail: "role_policy_mismatch",
        artifact,
      });
    }
    sourceArtifact = artifact;
    sourceBytes = sourceRetrieve.bytes;
  } else if (sourceRetrieve.kind === "absent") {
    return sourceUnavailable("absent");
  } else if (sourceRetrieve.kind === "invalid") {
    const denied = toDeniedReason(sourceRetrieve.reason);
    if (denied !== null) {
      return Object.freeze({ kind: "authorization_denied" as const, reason: denied });
    }
    return sourceUnavailable("invalid", { detail: sourceRetrieve.reason });
  } else if (sourceRetrieve.kind === "metadata_conflict") {
    return sourceUnavailable("metadata_conflict", {
      detail: sourceRetrieve.reason,
      artifact: sourceRetrieve.artifact,
    });
  } else {
    return sourceUnavailable("indeterminate");
  }

  // (5) Probe do prepared: linha + bytes + EVIDÊNCIA DURÁVEL.
  const preparedProbe = await retrieveCompositionArtifact(
    { identity: preparedIdentity, authorization },
    depsRef,
  );
  if (
    preparedProbe.kind === "invalid" &&
    toDeniedReason(preparedProbe.reason) !== null
  ) {
    // Exceção estreita: falta de acesso não é condição de bytes.
    return Object.freeze({
      kind: "authorization_denied" as const,
      reason: toDeniedReason(preparedProbe.reason) as DeniedReason,
    });
  }
  if (preparedProbe.kind === "integral") {
    const compatible = isCompatiblePreparedArtifact({
      artifact: preparedProbe.artifact,
      source: {
        artifactId: sourceArtifact.id,
        storagePath: sourceArtifact.storagePath,
        width: sourceArtifact.width,
        height: sourceArtifact.height,
        mimeType: sourceArtifact.mimeType,
        checksumSha256: sourceArtifact.checksumSha256,
      },
    });
    if (compatible) {
      const evidence = await verifyPreparedReuseEvidence(
        preparedProbe.artifact,
        {
          artifactId: sourceArtifact.id,
          checksumSha256: sourceArtifact.checksumSha256,
        },
        depsRef,
      );
      if (evidence.kind === "verified") {
        return Object.freeze({
          kind: "prepared" as const,
          artifact: preparedProbe.artifact,
          bytes: preparedProbe.bytes,
          persistence: "reused" as const,
        });
      }
    }
  }
  // Qualquer outro desfecho (incompatível, evidência não verificada, absent,
  // invalid de conteúdo, metadata_conflict, indeterminate) segue para a
  // autoridade F60.1 no passo (7). Em particular, `absent` pode significar
  // "linha existe e objeto sumiu" — nunca curto-circuitar.

  // (6) Transform determinístico.
  const transform = deps.transform ?? transformSquare1024To1152;
  const transformed = await transform(sourceBytes);
  if (!transformed.ok) {
    return transformed.detail === undefined
      ? Object.freeze({ kind: "transform_failed" as const, reason: transformed.reason })
      : Object.freeze({
          kind: "transform_failed" as const,
          reason: transformed.reason,
          detail: transformed.detail,
        });
  }
  const output = transformed.bytes;

  // (7) Autoridade F60.1: idempotência, conflito e imutabilidade.
  const persisted = await persistCompositionArtifact(
    {
      identity: preparedIdentity,
      authorization,
      bytes: output,
      origin: SQUARE_PREPARATION_ORIGIN,
      source: { kind: "internal_artifact", artifactId: sourceArtifact.id },
    },
    depsRef,
  );
  if (persisted.kind !== "created" && persisted.kind !== "reused") {
    return mapPersistResult(persisted);
  }
  const persistence = persisted.kind;

  // (8) Readback: os bytes autoritativos são os lidos, não os transformados.
  const readback = await retrieveCompositionArtifact(
    { identity: preparedIdentity, authorization },
    depsRef,
  );
  if (readback.kind === "integral") {
    return Object.freeze({
      kind: "prepared" as const,
      artifact: readback.artifact,
      bytes: readback.bytes,
      persistence,
    });
  }
  if (readback.kind === "metadata_conflict") {
    return readbackFailed("metadata_conflict", {
      detail: readback.reason,
      artifact: readback.artifact,
    });
  }
  if (readback.kind === "invalid") {
    return readbackFailed("invalid", { detail: readback.reason });
  }
  if (readback.kind === "absent") {
    return readbackFailed("absent");
  }
  return readbackFailed("indeterminate");
}
