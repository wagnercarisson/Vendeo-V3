import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildObjectEvidence,
  verifyObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { CompositionArtifactStorage } from "@/lib/campaign/composition-artifacts/storage";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  AuthorizationContext,
} from "@/lib/campaign/composition-artifacts/types";
import {
  VerticalResizeError,
  verifyVerticalJpeg1080x1920,
} from "@/lib/product-vertical-9-16/artifact/resize";

import { EXPANSION_ORIGIN, EXPANSION_TARGET } from "./policy";
import { isCompatibleExpansionArtifact } from "./reuse-compatibility";
import { verifyExpansionReuseEvidence } from "./reuse-evidence";

/**
 * F60.3 — Gate PRÉ-CHAMADA da expansão 1:1 → 9:16.
 *
 * A regra central (T-60.3-18/T-60.3-19/T-60.3-22): LINHA e OBJETO são perguntas
 * diferentes. `retrieveCompositionArtifact` devolve `absent` tanto quando a linha
 * não existe quanto quando a linha existe e o objeto desapareceu — o probe NUNCA
 * infere ausência de linha a partir do retrieve.
 *
 * Decisões:
 * - linha + retrieve integral + compatível + evidência verificada ⇒ `reused`;
 * - linha + objeto desaparecido ⇒ `row_object_missing` (zero chamadas, nada é
 *   regravado/apagado);
 * - linha ausente + objeto ausente comprovado ⇒ `proceed` — ÚNICO caminho que
 *   autoriza a chamada paga;
 * - linha ausente + órfão íntegro com evidência compatível ⇒ adoção pela F60.1
 *   (`persistCompositionArtifact`) ⇒ `adopted` (zero chamadas pagas);
 * - qualquer estado indeterminado (linha, objeto, download, info) ⇒ `blocked`.
 *
 * Nenhum ramo chama provider, cria URL, entrega, apaga, sobrescreve ou corrige.
 * A autorização/vínculo loja↔campanha é reafirmada pelo chamador antes daqui.
 */

export type ProbeExpansionConflictReason =
  | "incompatible"
  | "object_unverified"
  | "object_invalid"
  | "row_object_missing";

export type ProbeExpansionOutcome =
  | { readonly kind: "reused"; readonly artifact: ArtifactRecord; readonly bytes: Buffer }
  | { readonly kind: "adopted"; readonly artifact: ArtifactRecord; readonly bytes: Buffer }
  | { readonly kind: "proceed" }
  | {
      readonly kind: "conflict";
      readonly reason: ProbeExpansionConflictReason;
      readonly artifact?: ArtifactRecord;
    }
  | { readonly kind: "blocked"; readonly reason: "pre_call_probe_indeterminate" };

export interface ProbeExpansionInput {
  readonly destination: ArtifactIdentity;
  readonly source: ArtifactRecord;
  readonly authorization: AuthorizationContext;
}

export interface ProbeExpansionDeps {
  readonly client?: SupabaseClient;
}

function blocked(): ProbeExpansionOutcome {
  return Object.freeze({
    kind: "blocked" as const,
    reason: "pre_call_probe_indeterminate" as const,
  });
}

function conflict(
  reason: ProbeExpansionConflictReason,
  artifact?: ArtifactRecord,
): ProbeExpansionOutcome {
  return Object.freeze(
    artifact === undefined
      ? { kind: "conflict" as const, reason }
      : { kind: "conflict" as const, reason, artifact },
  );
}

/**
 * Proveniência que a F60.1 deriva para uma fonte interna. É um ESPELHO da
 * allowlist (`sourceProvenance` em `persist.ts`), necessário apenas porque um
 * órfão ainda não tem linha de onde ler a proveniência. O digest em si continua
 * sendo calculado exclusivamente por `buildObjectEvidence`.
 */
function derivedProvenance(source: ArtifactRecord): Record<string, unknown> {
  return {
    sourceOrigin: "composition_artifact",
    sourceStoragePath: source.storagePath,
    sourceWidth: source.width,
    sourceHeight: source.height,
    sourceMimeType: source.mimeType,
    sourceChecksumSha256: source.checksumSha256,
    derivedFromArtifactId: source.id,
  };
}

/** JPEG 1080×1920 verificado por decode completo (F59). Nunca lança. */
async function isVerticalJpeg1080x1920(bytes: Buffer): Promise<boolean> {
  try {
    await verifyVerticalJpeg1080x1920(bytes);
    return true;
  } catch (error) {
    if (error instanceof VerticalResizeError) return false;
    return false;
  }
}

/**
 * Decide o que fazer com o destino ANTES de resolver modelo/pricing e antes de
 * qualquer chamada paga.
 */
export async function probeExpansionTarget(
  input: ProbeExpansionInput,
  deps: ProbeExpansionDeps = {},
): Promise<ProbeExpansionOutcome> {
  const client = deps.client ?? supabaseAdmin;
  const { destination, source, authorization } = input;

  // (1) A LINHA é consultada explicitamente pela identidade de destino.
  const row = await getArtifactByIdentity(destination, client);
  if (row.kind === "read_failed") return blocked();

  if (row.kind === "found") {
    // (2) Linha encontrada: o OBJETO é uma segunda pergunta independente.
    const retrieval = await retrieveCompositionArtifact(
      { identity: destination, authorization },
      { client },
    );

    if (retrieval.kind === "integral") {
      if (
        !isCompatibleExpansionArtifact({
          artifact: retrieval.artifact,
          source,
        })
      ) {
        return conflict("incompatible", retrieval.artifact);
      }

      const evidence = await verifyExpansionReuseEvidence(
        retrieval.artifact,
        source,
        { client },
      );
      if (evidence.kind === "verified") {
        return Object.freeze({
          kind: "reused" as const,
          artifact: retrieval.artifact,
          bytes: retrieval.bytes,
        });
      }
      if (evidence.reason === "object_absent") {
        return conflict("row_object_missing", retrieval.artifact);
      }
      if (evidence.reason === "indeterminate") return blocked();
      return conflict("object_unverified", retrieval.artifact);
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
  const storage = new CompositionArtifactStorage(client);

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
  if (!(await isVerticalJpeg1080x1920(bytes))) {
    return conflict("object_invalid");
  }

  // (4) Evidência esperada montada SOMENTE pela F60.1.
  const expected = buildObjectEvidence({
    storeId: destination.storeId,
    campaignId: destination.campaignId,
    operationId: destination.operationId,
    role: destination.role,
    origin: EXPANSION_ORIGIN,
    sourceKind: "internal_artifact",
    sourceArtifactId: source.id,
    sourceOrigin: "composition_artifact",
    sourceChecksumSha256: source.checksumSha256,
    width: EXPANSION_TARGET.width,
    height: EXPANSION_TARGET.height,
    mimeType: EXPANSION_TARGET.mimeType,
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
    provenance: derivedProvenance(source),
  });
  if (!expected.ok) return conflict("object_unverified");

  const evidence = verifyObjectEvidence(info.metadata, expected.evidence);
  if (!evidence.ok) return conflict("object_unverified");

  // (5) Órfão íntegro e verificado: a F60.1 cria a linha (adoção), sem upload e
  // sem chamada paga.
  const persisted = await persistCompositionArtifact(
    {
      identity: destination,
      authorization,
      bytes,
      origin: EXPANSION_ORIGIN,
      source: { kind: "internal_artifact", artifactId: source.id },
    },
    { client },
  );

  if (persisted.kind === "created" || persisted.kind === "reused") {
    const adoptedRow = await getArtifactByIdentity(destination, client);
    if (adoptedRow.kind === "read_failed") return blocked();
    if (adoptedRow.kind === "absent") return conflict("object_unverified");
    return Object.freeze({
      kind: "adopted" as const,
      artifact: adoptedRow.record,
      bytes,
    });
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
