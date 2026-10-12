import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ImageGenerationConfigMissingError,
  resolveConfigForNewCampaign,
  type CurrentImageGenerationConfig,
  type ImageGenerationConfigSnapshot,
} from "@/lib/ai/image-generation-config-snapshot";
import { assertEligibleModelPair } from "@/lib/ai/image-model-pair";
import type { ProductOneToOneBackgroundDirection } from "@/lib/product-1-1/background-direction";
import type { ProductOneToOneIntent } from "@/lib/product-1-1/intent-selection";

/**
 * F56.2b1b (B1B-D3 / REQ-56.2.2-02 / C3 / C5) — persistência do snapshot
 * congelado e da sua evidência congelada, ANTES de qualquer reserva/provider.
 *
 * O snapshot é uma cópia por valor do par modelo/qualidade + versão + origem
 * (reuso do contrato F56.1 `resolveConfigForNewCampaign`); a evidência congela o
 * briefing, as referências/seleções (intenção, direção de fundo, imagens) e as
 * versões de composição (base, compositor, políticas) na relação dedicada e
 * imutável `product_1_1_snapshot_frozen_evidence`.
 *
 * F6: a identidade da campanha/operação (`campaignId` + `operationId`) tem origem
 * EXPLÍCITA, é gravada tanto no snapshot quanto na evidência e é a MESMA usada
 * pelo artefato e pela operação. C3: persistir a MESMA identidade é idempotente
 * (reusa snapshot/evidência); conteúdo divergente para a mesma identidade é
 * recusado (`operation_identity_conflict`) sem gravar.
 *
 * Fronteira (LOCAL-ONLY): a migration `20261009000003` é apenas AUTORADA neste
 * plano; é aplicada somente na instância isolada no Plano 09. Nenhum efeito
 * financeiro/provider ocorre aqui — o client é injetável e o módulo não chama
 * provider.
 */

const SNAPSHOT_TABLE = "image_generation_config_snapshots";
const EVIDENCE_TABLE = "product_1_1_snapshot_frozen_evidence";

const SNAPSHOT_COLUMNS =
  "id, campaign_id, primary_model, primary_quality, fallback_model, fallback_quality, config_version_id, origin";

const EVIDENCE_COLUMNS =
  "id, snapshot_original_id, campaign_id, operation_id, campaign_intent, background_direction, briefing, reference_selections, base_version, composer_version, policy_versions";

/** Referência/seleção congelada no snapshot (imagem de produto/identidade/referência). */
export interface ProductOneToOneEvidenceReference {
  readonly kind: "product" | "identity" | "reference";
  readonly id: string;
  readonly storagePath?: string;
}

/**
 * Evidência congelada do snapshot: briefing, referências/seleções e versões de
 * composição, mais a associação persistida `campaign_id`+`operation_id` (C3/F6).
 */
export interface ProductOneToOneFrozenEvidence {
  readonly campaignId: string;
  readonly operationId: string;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly briefing: string;
  readonly referenceSelections: readonly ProductOneToOneEvidenceReference[];
  readonly baseVersion: string;
  readonly composerVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
}

export interface BuildProductOneToOneFrozenEvidenceInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly briefing: string;
  readonly referenceSelections?: readonly ProductOneToOneEvidenceReference[];
  readonly baseVersion: string;
  readonly composerVersion: string;
  readonly policyVersions?: Readonly<Record<string, string>>;
}

/** Contexto do builder do snapshot (ids/relógio injetáveis para testes). */
export interface BuildProductOneToOneSnapshotContext {
  readonly campaignId: string;
  readonly runId?: string;
  readonly traceId?: string;
  readonly now?: () => string;
  readonly generateVersionId?: () => string;
}

/** Códigos determinísticos de falha de persistência do snapshot/evidência. */
export type ProductOneToOneSnapshotPersistErrorCode =
  | "snapshot_persist_failed"
  | "snapshot_read_failed"
  | "frozen_evidence_persist_failed"
  | "evidence_read_failed"
  | "operation_identity_conflict";

/** Erro tipado de persistência — lança e BLOQUEIA a operação (sem reserva/provider). */
export class ProductOneToOneSnapshotPersistError extends Error {
  readonly code: ProductOneToOneSnapshotPersistErrorCode;

  constructor(code: ProductOneToOneSnapshotPersistErrorCode, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "ProductOneToOneSnapshotPersistError";
    this.code = code;
  }
}

export interface PersistProductOneToOneSnapshotResult {
  readonly snapshotOriginalId: string;
  readonly reused: boolean;
}

interface SnapshotRow {
  id: string;
  campaign_id: string;
  primary_model: string;
  primary_quality: string;
  fallback_model: string;
  fallback_quality: string;
  config_version_id: string;
  origin: string;
}

interface EvidenceRow {
  id: string;
  snapshot_original_id: string;
  campaign_id: string;
  operation_id: string;
  campaign_intent: string;
  background_direction: string;
  briefing: string;
  reference_selections: unknown;
  base_version: string;
  composer_version: string;
  policy_versions: unknown;
}

/**
 * Congela a configuração vigente para uma nova campanha (cópia por valor),
 * resolvendo o snapshot via contrato F56.1. Config ausente/inválida lança erro
 * fail-closed — nunca um default.
 */
export function buildProductOneToOneSnapshot(
  currentConfig: CurrentImageGenerationConfig,
  context: BuildProductOneToOneSnapshotContext,
): ImageGenerationConfigSnapshot {
  if (!currentConfig) throw new ImageGenerationConfigMissingError();
  assertEligibleModelPair(currentConfig.primary);
  assertEligibleModelPair(currentConfig.fallback);

  return resolveConfigForNewCampaign(currentConfig, context.campaignId, {
    now: context.now,
    generateVersionId: context.generateVersionId,
    runId: context.runId,
    traceId: context.traceId,
  });
}

/**
 * Constrói a evidência congelada por valor: mutações posteriores do contexto não
 * alteram o valor retornado (arrays/objetos clonados e congelados).
 */
export function buildProductOneToOneFrozenEvidence(
  input: BuildProductOneToOneFrozenEvidenceInput,
): ProductOneToOneFrozenEvidence {
  return Object.freeze({
    campaignId: input.campaignId,
    operationId: input.operationId,
    campaignIntent: input.campaignIntent,
    backgroundDirection: input.backgroundDirection,
    briefing: input.briefing,
    referenceSelections: Object.freeze(
      (input.referenceSelections ?? []).map((reference) =>
        Object.freeze({ ...reference }),
      ),
    ),
    baseVersion: input.baseVersion,
    composerVersion: input.composerVersion,
    policyVersions: Object.freeze({ ...(input.policyVersions ?? {}) }),
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, inner]) => `${JSON.stringify(key)}:${stableJson(inner)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function snapshotMatches(
  row: SnapshotRow,
  snapshot: ImageGenerationConfigSnapshot,
): boolean {
  return (
    row.campaign_id === snapshot.campaignId &&
    row.primary_model === snapshot.primaryModel &&
    row.primary_quality === snapshot.primaryQuality &&
    row.fallback_model === snapshot.fallbackModel &&
    row.fallback_quality === snapshot.fallbackQuality &&
    row.config_version_id === snapshot.configVersionId &&
    row.origin === snapshot.origin
  );
}

function evidenceMatches(
  row: EvidenceRow,
  evidence: ProductOneToOneFrozenEvidence,
): boolean {
  return (
    row.campaign_id === evidence.campaignId &&
    row.operation_id === evidence.operationId &&
    row.campaign_intent === evidence.campaignIntent &&
    row.background_direction === evidence.backgroundDirection &&
    row.briefing === evidence.briefing &&
    row.base_version === evidence.baseVersion &&
    row.composer_version === evidence.composerVersion &&
    stableJson(row.reference_selections) === stableJson(evidence.referenceSelections) &&
    stableJson(row.policy_versions) === stableJson(evidence.policyVersions)
  );
}

async function findSnapshotByCampaign(
  client: SupabaseClient,
  campaignId: string,
): Promise<SnapshotRow | null> {
  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select(SNAPSHOT_COLUMNS)
    .eq("campaign_id", campaignId)
    .maybeSingle<SnapshotRow>();
  if (error) {
    throw new ProductOneToOneSnapshotPersistError("snapshot_read_failed", error.message);
  }
  return data ?? null;
}

async function findEvidenceByIdentity(
  client: SupabaseClient,
  campaignId: string,
  operationId: string,
): Promise<EvidenceRow | null> {
  const { data, error } = await client
    .from(EVIDENCE_TABLE)
    .select(EVIDENCE_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("operation_id", operationId)
    .maybeSingle<EvidenceRow>();
  if (error) {
    throw new ProductOneToOneSnapshotPersistError("evidence_read_failed", error.message);
  }
  return data ?? null;
}

async function insertSnapshot(
  client: SupabaseClient,
  snapshot: ImageGenerationConfigSnapshot,
): Promise<string> {
  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .insert({
      campaign_id: snapshot.campaignId,
      primary_model: snapshot.primaryModel,
      primary_quality: snapshot.primaryQuality,
      fallback_model: snapshot.fallbackModel,
      fallback_quality: snapshot.fallbackQuality,
      config_version_id: snapshot.configVersionId,
      origin: snapshot.origin,
      run_id: snapshot.runId ?? null,
      trace_id: snapshot.traceId ?? null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    throw new ProductOneToOneSnapshotPersistError("snapshot_persist_failed", error.message);
  }
  if (!data) {
    throw new ProductOneToOneSnapshotPersistError(
      "snapshot_persist_failed",
      "missing_insert_result",
    );
  }
  return data.id;
}

async function insertEvidenceRow(
  client: SupabaseClient,
  snapshotOriginalId: string,
  evidence: ProductOneToOneFrozenEvidence,
): Promise<void> {
  const { error } = await client
    .from(EVIDENCE_TABLE)
    .insert({
      snapshot_original_id: snapshotOriginalId,
      campaign_id: evidence.campaignId,
      operation_id: evidence.operationId,
      campaign_intent: evidence.campaignIntent,
      background_direction: evidence.backgroundDirection,
      briefing: evidence.briefing,
      reference_selections: evidence.referenceSelections,
      base_version: evidence.baseVersion,
      composer_version: evidence.composerVersion,
      policy_versions: evidence.policyVersions,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
}

async function insertEvidence(
  client: SupabaseClient,
  snapshotOriginalId: string,
  evidence: ProductOneToOneFrozenEvidence,
): Promise<void> {
  try {
    await insertEvidenceRow(client, snapshotOriginalId, evidence);
  } catch (error) {
    throw new ProductOneToOneSnapshotPersistError(
      "frozen_evidence_persist_failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

/**
 * Persiste o snapshot e a evidência congelada com a MESMA identidade explícita
 * (F6/C3). Falha do insert da evidência é tipada e bloqueia a operação. A MESMA
 * identidade é idempotente; conteúdo divergente para a mesma identidade é
 * recusado sem gravar.
 */
export async function persistProductOneToOneSnapshot(
  client: SupabaseClient,
  snapshot: ImageGenerationConfigSnapshot,
  evidence: ProductOneToOneFrozenEvidence,
): Promise<PersistProductOneToOneSnapshotResult> {
  if (snapshot.campaignId !== evidence.campaignId) {
    throw new ProductOneToOneSnapshotPersistError(
      "operation_identity_conflict",
      "campaign_id_mismatch",
    );
  }

  const existingSnapshot = await findSnapshotByCampaign(client, snapshot.campaignId);
  if (existingSnapshot) {
    if (!snapshotMatches(existingSnapshot, snapshot)) {
      throw new ProductOneToOneSnapshotPersistError(
        "operation_identity_conflict",
        "snapshot_divergent",
      );
    }

    const existingEvidence = await findEvidenceByIdentity(
      client,
      evidence.campaignId,
      evidence.operationId,
    );
    if (existingEvidence) {
      if (!evidenceMatches(existingEvidence, evidence)) {
        throw new ProductOneToOneSnapshotPersistError(
          "operation_identity_conflict",
          "evidence_divergent",
        );
      }
      return { snapshotOriginalId: existingSnapshot.id, reused: true };
    }

    await insertEvidence(client, existingSnapshot.id, evidence);
    return { snapshotOriginalId: existingSnapshot.id, reused: true };
  }

  const snapshotOriginalId = await insertSnapshot(client, snapshot);
  await insertEvidence(client, snapshotOriginalId, evidence);
  return { snapshotOriginalId, reused: false };
}
