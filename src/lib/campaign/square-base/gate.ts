import "server-only";

/**
 * F60.4 — Gate PRÉ-CHAMADA do `square_original` da base quadrada.
 *
 * A regra central (design D4 / T-60.4-08 / T-60.4-09): LINHA e OBJETO são
 * perguntas diferentes. O retrieve da F60.1 devolve `absent` tanto
 * quando a linha não existe quanto quando a linha existe e o objeto desapareceu
 * — o probe NUNCA infere ausência de linha a partir do retrieve.
 *
 * Decisões:
 * - linha + retrieve integral + compatível + evidência verificada ⇒ `reused`;
 * - linha + objeto desaparecido ⇒ `row_object_missing` (zero chamadas; nada é
 *   regravado/apagado);
 * - linha ausente + objeto ausente comprovado ⇒ `proceed` — ÚNICO caminho que
 *   autoriza a chamada paga;
 * - linha ausente + órfão JPEG 1024×1024 com evidência compatível ⇒ adoção pela
 *   F60.1 (`persistCompositionArtifact`) ⇒ `reused` com `adoption: true`; a
 *   adoção só acontece quando o chamador provou estado congelado admissível
 *   (`allowAdoption: true`) — antes disso o desfecho é
 *   `blocked("artifact_without_frozen_state")` e ZERO escritas acontecem;
 * - qualquer estado indeterminado (linha, objeto, download, info) ⇒ `blocked`.
 *
 * Nenhum ramo chama provider, cria URL, entrega, apaga, sobrescreve ou corrige.
 * A autorização/vínculo loja↔campanha é reafirmada pelo chamador antes daqui.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabase/server";

import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildObjectEvidence,
  verifyObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import {
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACT_PIXELS,
} from "@/lib/campaign/composition-artifacts/role-policy";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import {
  CompositionArtifactStorage,
  type DownloadBytesResult,
  type ReadObjectInfoResult,
} from "@/lib/campaign/composition-artifacts/storage";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  AuthorizationContext,
  ObjectEvidence,
} from "@/lib/campaign/composition-artifacts/types";

import { SQUARE_BASE_ORIGIN, SQUARE_BASE_TARGET } from "./policy";
import type { FrozenStateKind } from "./types";

/** Motivos fechados de conflito do gate (união fechada do design). */
export type ProbeSquareBaseConflictReason =
  | "incompatible"
  | "object_unverified"
  | "object_invalid"
  | "row_object_missing";

/** Motivos fechados de bloqueio do gate. */
export type ProbeSquareBaseBlockedReason =
  | "pre_call_probe_indeterminate"
  | "artifact_without_frozen_state";

export type ProbeSquareBaseOutcome =
  | {
      readonly kind: "reused";
      readonly artifact: ArtifactRecord;
      readonly bytes: Buffer;
      readonly adoption: boolean;
    }
  | { readonly kind: "proceed" }
  | {
      readonly kind: "conflict";
      readonly reason: ProbeSquareBaseConflictReason;
      readonly artifact?: ArtifactRecord;
    }
  | {
      readonly kind: "blocked";
      readonly reason: ProbeSquareBaseBlockedReason;
      readonly detail?: string;
    };

export interface ProbeSquareBaseInput {
  readonly destination: ArtifactIdentity;
  readonly authorization: AuthorizationContext;
  /**
   * Derivado pelo orquestrador do estado congelado: `true` SOMENTE para
   * `complete`/`repairable`. O probe nunca adota um órfão quando `false`.
   */
  readonly allowAdoption: boolean;
}

/** Storage mínimo injetável (default: `CompositionArtifactStorage`). */
export interface SquareBaseProbeStorage {
  readObjectInfo(path: string): Promise<ReadObjectInfoResult>;
  downloadBytes(path: string): Promise<DownloadBytesResult>;
}

export interface ProbeSquareBaseDeps {
  readonly client?: SupabaseClient;
  readonly getRow?: typeof getArtifactByIdentity;
  readonly retrieve?: typeof retrieveCompositionArtifact;
  readonly storage?: SquareBaseProbeStorage;
  readonly persist?: typeof persistCompositionArtifact;
}

/**
 * Compatibilidade estrita de um `square_original` reutilizável. Puro e nunca
 * lança: qualquer divergência recusa o reuso (nunca reuso silencioso).
 */
export function isCompatibleSquareBaseArtifact(record: ArtifactRecord): boolean {
  try {
    return (
      record.role === "square_original" &&
      record.format === SQUARE_BASE_TARGET.format &&
      record.width === SQUARE_BASE_TARGET.width &&
      record.height === SQUARE_BASE_TARGET.height &&
      record.mimeType === SQUARE_BASE_TARGET.mimeType &&
      record.origin === SQUARE_BASE_ORIGIN &&
      record.derivedFromArtifactId === null &&
      record.sourceCampaignId === null &&
      Object.keys(record.provenance).length === 0
    );
  } catch {
    return false;
  }
}

/**
 * Admissibilidade do reuso/adoção frente ao estado congelado (design D2).
 *
 * - `complete`/`repairable` ⇒ reuso permitido;
 * - `absent` ⇒ `artifact_without_frozen_state` (não se combina arte antiga com
 *   conteúdo novo);
 * - `unproven`/`corrupt` ⇒ `artifact_without_frozen_state` (estado não
 *   comprovável);
 * - `indeterminate` ⇒ `pre_call_probe_indeterminate`;
 * - `bound_to_other_operation` ⇒ conflito explícito;
 * - `proceed`/`conflict`/`blocked` do probe são preservados.
 */
export function decideReuseAdmissibility(
  probe: ProbeSquareBaseOutcome,
  frozenState: FrozenStateKind,
):
  | {
      readonly kind: "reuse";
      readonly artifact: ArtifactRecord;
      readonly adoption: boolean;
    }
  | { readonly kind: "proceed" }
  | {
      readonly kind: "conflict";
      readonly reason: ProbeSquareBaseConflictReason | "bound_to_other_operation";
      readonly artifact?: ArtifactRecord;
    }
  | {
      readonly kind: "blocked";
      readonly reason: ProbeSquareBaseBlockedReason;
      readonly detail?: string;
    } {
  if (probe.kind === "conflict") {
    return probe.artifact === undefined
      ? Object.freeze({ kind: "conflict" as const, reason: probe.reason })
      : Object.freeze({
          kind: "conflict" as const,
          reason: probe.reason,
          artifact: probe.artifact,
        });
  }
  if (probe.kind === "blocked") {
    return probe.detail === undefined
      ? Object.freeze({ kind: "blocked" as const, reason: probe.reason })
      : Object.freeze({
          kind: "blocked" as const,
          reason: probe.reason,
          detail: probe.detail,
        });
  }
  if (probe.kind === "proceed") {
    return Object.freeze({ kind: "proceed" as const });
  }

  if (frozenState === "complete" || frozenState === "repairable") {
    return Object.freeze({
      kind: "reuse" as const,
      artifact: probe.artifact,
      adoption: probe.adoption,
    });
  }
  if (frozenState === "bound_to_other_operation") {
    return Object.freeze({
      kind: "conflict" as const,
      reason: "bound_to_other_operation" as const,
      artifact: probe.artifact,
    });
  }
  if (frozenState === "indeterminate") {
    return Object.freeze({
      kind: "blocked" as const,
      reason: "pre_call_probe_indeterminate" as const,
    });
  }
  // `absent`, `unproven` e `corrupt`: não há conteúdo original comprovável.
  return Object.freeze({
    kind: "blocked" as const,
    reason: "artifact_without_frozen_state" as const,
  });
}

function blocked(detail?: string): ProbeSquareBaseOutcome {
  return detail === undefined
    ? Object.freeze({
        kind: "blocked" as const,
        reason: "pre_call_probe_indeterminate" as const,
      })
    : Object.freeze({
        kind: "blocked" as const,
        reason: "pre_call_probe_indeterminate" as const,
        detail,
      });
}

function conflict(
  reason: ProbeSquareBaseConflictReason,
  artifact?: ArtifactRecord,
): ProbeSquareBaseOutcome {
  return Object.freeze(
    artifact === undefined
      ? { kind: "conflict" as const, reason }
      : { kind: "conflict" as const, reason, artifact },
  );
}

function reused(
  artifact: ArtifactRecord,
  bytes: Buffer,
  adoption: boolean,
): ProbeSquareBaseOutcome {
  return Object.freeze({
    kind: "reused" as const,
    artifact,
    bytes,
    adoption,
  });
}

/**
 * JPEG 1024×1024 verificado por decode COMPLETO (não apenas header). Aplica
 * limites de bytes/pixels e exige 1024×1024 ANTES do decode completo; imagens
 * admissíveis continuam passando pelo decode completo. Nunca lança.
 */
export async function isSquareJpeg1024(bytes: Buffer): Promise<boolean> {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_ARTIFACT_BYTES
  ) {
    return false;
  }

  let metadata: { format?: string; width?: number; height?: number };
  try {
    metadata = await sharp(bytes).metadata();
  } catch {
    return false;
  }
  if (metadata.format !== "jpeg") return false;

  const width = metadata.width;
  const height = metadata.height;
  if (
    !width ||
    !height ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width * height > MAX_ARTIFACT_PIXELS ||
    width !== SQUARE_BASE_TARGET.width ||
    height !== SQUARE_BASE_TARGET.height
  ) {
    return false;
  }

  try {
    const decoded = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: MAX_ARTIFACT_PIXELS,
    })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return (
      decoded.info.width === SQUARE_BASE_TARGET.width &&
      decoded.info.height === SQUARE_BASE_TARGET.height
    );
  } catch {
    return false;
  }
}

/** Evidência esperada do `square_original` gerado pelo provider (F60.1). */
function expectedSquareEvidence(input: {
  readonly destination: ArtifactIdentity;
  readonly bytes: Buffer;
}):
  | { readonly ok: true; readonly evidence: ObjectEvidence }
  | { readonly ok: false } {
  const built = buildObjectEvidence({
    storeId: input.destination.storeId,
    campaignId: input.destination.campaignId,
    operationId: input.destination.operationId,
    role: SQUARE_BASE_TARGET.role,
    origin: SQUARE_BASE_ORIGIN,
    sourceKind: "none",
    width: SQUARE_BASE_TARGET.width,
    height: SQUARE_BASE_TARGET.height,
    mimeType: SQUARE_BASE_TARGET.mimeType,
    byteSize: input.bytes.byteLength,
    checksumSha256: computeChecksumSha256(input.bytes),
    provenance: {},
  });
  return built.ok ? { ok: true, evidence: built.evidence } : { ok: false };
}

/**
 * Decide o que fazer com o destino ANTES de resolver modelo/pricing e antes de
 * qualquer chamada paga.
 */
export async function probeSquareBaseTarget(
  input: ProbeSquareBaseInput,
  deps: ProbeSquareBaseDeps = {},
): Promise<ProbeSquareBaseOutcome> {
  const client = deps.client ?? supabaseAdmin;
  const getRow = deps.getRow ?? getArtifactByIdentity;
  const retrieve = deps.retrieve ?? retrieveCompositionArtifact;
  const persist = deps.persist ?? persistCompositionArtifact;
  const storage = deps.storage ?? new CompositionArtifactStorage(client);
  const { destination, authorization } = input;

  // (1) A LINHA é consultada explicitamente pela identidade de destino.
  const row = await getRow(destination, client);
  if (row.kind === "read_failed") return blocked();

  if (row.kind === "found") {
    // (2) Linha encontrada: o OBJETO é uma segunda pergunta independente.
    const retrieval = await retrieve(
      { identity: destination, authorization },
      { client },
    );

    if (retrieval.kind === "integral") {
      if (!isCompatibleSquareBaseArtifact(retrieval.artifact)) {
        return conflict("incompatible", retrieval.artifact);
      }

      // Evidência durável: buildObjectEvidence OK antes de verifyObjectEvidence.
      const expected = expectedSquareEvidence({
        destination,
        bytes: retrieval.bytes,
      });
      if (!expected.ok) return conflict("object_unverified", retrieval.artifact);

      const info = await storage.readObjectInfo(retrieval.artifact.storagePath);
      if (info.kind === "indeterminate") return blocked();
      if (info.kind === "absent") {
        return conflict("row_object_missing", retrieval.artifact);
      }

      const evidence = verifyObjectEvidence(
        info.metadata,
        expected.evidence,
      );
      if (!evidence.ok) return conflict("object_unverified", retrieval.artifact);

      return reused(retrieval.artifact, retrieval.bytes, false);
    }

    // Linha existe e o objeto desapareceu: NUNCA regravar/sobrescrever.
    if (retrieval.kind === "absent") {
      return conflict("row_object_missing", row.record);
    }
    if (retrieval.kind === "metadata_conflict") {
      return conflict("object_invalid", retrieval.artifact);
    }
    if (retrieval.kind === "invalid") {
      return conflict("object_invalid", row.record);
    }
    return blocked();
  }

  // (3) Linha ausente: ler o objeto no path determinístico.
  const path = compositionArtifactStoragePath(destination);

  const info = await storage.readObjectInfo(path);
  if (info.kind === "indeterminate") return blocked();
  if (info.kind === "absent") {
    // ÚNICO caminho que autoriza a chamada paga.
    return Object.freeze({ kind: "proceed" as const });
  }

  const download = await storage.downloadBytes(path);
  if (download.kind === "indeterminate") return blocked();
  if (download.kind === "absent") return conflict("object_unverified");

  const bytes = download.bytes;
  if (!(await isSquareJpeg1024(bytes))) {
    return conflict("object_invalid");
  }

  // (4) Evidência esperada montada SOMENTE pela F60.1.
  const expected = expectedSquareEvidence({ destination, bytes });
  if (!expected.ok) return conflict("object_unverified");

  const evidence = verifyObjectEvidence(info.metadata, expected.evidence);
  if (!evidence.ok) return conflict("object_unverified");

  // (5) Admissibilidade ANTES de qualquer escrita: sem estado congelado
  // comprovável (absent/unproven/corrupt/indeterminate) não se adota órfão.
  if (!input.allowAdoption) {
    return Object.freeze({
      kind: "blocked" as const,
      reason: "artifact_without_frozen_state" as const,
    });
  }

  // (6) Órfão íntegro e verificado: a F60.1 cria a linha (adoção), sem upload e
  // sem chamada paga.
  const persisted = await persist(
    {
      identity: destination,
      authorization,
      bytes,
      origin: SQUARE_BASE_ORIGIN,
      source: { kind: "none" },
    },
    { client },
  );

  if (persisted.kind === "created" || persisted.kind === "reused") {
    const adoptedRow = await getRow(destination, client);
    if (adoptedRow.kind === "read_failed") return blocked();
    if (adoptedRow.kind === "absent") return conflict("object_unverified");
    return reused(adoptedRow.record, bytes, true);
  }

  switch (persisted.kind) {
    case "content_conflict":
    case "identity_conflict":
    case "metadata_conflict":
    case "provenance_conflict":
    case "invalid_input":
      return conflict("object_unverified");
    case "integrity_failure":
    case "persistence_failure":
      return conflict("object_invalid");
    case "indeterminate":
      return blocked();
  }
}
