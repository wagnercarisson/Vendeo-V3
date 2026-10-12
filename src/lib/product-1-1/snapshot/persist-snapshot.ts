import "server-only";
import { createHash } from "node:crypto";
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
 * F2 — recuperação controlada de pré-reserva com "content binding" (fonte de
 * comparação PERSISTIDA): o snapshot e o binding (fingerprint do conteúdo
 * congelado) são gravados ATOMICAMENTE pelo RPC
 * `product_1_1_persist_snapshot_with_binding` — garantindo que NUNCA exista
 * "snapshot sem binding" (só é possível "snapshot+binding sem evidência"). Um
 * estado parcial (binding existe, evidência ausente) é REPARADO inserindo a
 * evidência para o MESMO `snapshot_original_id`; o fingerprint recalculado é
 * comparado ao fingerprint persistido no binding — divergência ⇒
 * `operation_identity_conflict`. O snapshot congelado NUNCA é substituído.
 *
 * Fronteira (LOCAL-ONLY): a migration `20261009000003` é apenas AUTORADA neste
 * plano; é aplicada somente na instância isolada no Plano 09. Nenhum efeito
 * financeiro/provider ocorre aqui — o client é injetável e o módulo não chama
 * provider.
 */

const EVIDENCE_TABLE = "product_1_1_snapshot_frozen_evidence";
const PERSIST_SNAPSHOT_WITH_BINDING_RPC =
  "product_1_1_persist_snapshot_with_binding";

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

/**
 * F2 — fingerprint estável do conteúdo CONGELADO (a fonte de comparação
 * PERSISTIDA no binding `product_1_1_snapshot_content_binding`). Cobre exatamente
 * os campos congelados que definem a identidade do conteúdo: `campaignIntent`,
 * `backgroundDirection`, `briefing`, `referenceSelections`, `baseVersion`,
 * `composerVersion` e `policyVersions`. Determinístico: o MESMO conteúdo produz o
 * MESMO fingerprint (serialização estável + SHA-256), permitindo comparar o
 * conteúdo recebido em um reparo contra o conteúdo originalmente congelado.
 *
 * A identidade `(campaignId, operationId)` fica FORA do fingerprint: ela é a
 * chave do binding (comparada separadamente), não o conteúdo.
 */
export function computeContentFingerprint(
  content: Pick<
    ProductOneToOneFrozenEvidence,
    | "campaignIntent"
    | "backgroundDirection"
    | "briefing"
    | "referenceSelections"
    | "baseVersion"
    | "composerVersion"
    | "policyVersions"
  >,
): string {
  const payload = {
    campaignIntent: content.campaignIntent,
    backgroundDirection: content.backgroundDirection,
    briefing: content.briefing,
    referenceSelections: content.referenceSelections,
    baseVersion: content.baseVersion,
    composerVersion: content.composerVersion,
    policyVersions: content.policyVersions,
  };
  return createHash("sha256").update(stableJson(payload)).digest("hex");
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

/**
 * Resolve (or repair) a evidência de forma à prova de corrida (F1/F2).
 *
 * Pré-consulta `(campaign_id, operation_id)`: se existir, exige equivalência.
 * Caso contrário, TENTA o insert; em falha (UNIQUE por concorrência) RE-CONSULTA
 * e reusa a linha vencedora SOMENTE sob equivalência (reparo de estado parcial
 * NÃO substitui o snapshot: apenas completa a evidência ausente). Conteúdo
 * divergente ⇒ `operation_identity_conflict`; ausência persistente ⇒
 * `frozen_evidence_persist_failed`.
 */
async function ensureEvidence(
  client: SupabaseClient,
  snapshotOriginalId: string,
  evidence: ProductOneToOneFrozenEvidence,
): Promise<"inserted" | "reused"> {
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
    return "reused";
  }

  try {
    await insertEvidenceRow(client, snapshotOriginalId, evidence);
    return "inserted";
  } catch (error) {
    const racedEvidence = await findEvidenceByIdentity(
      client,
      evidence.campaignId,
      evidence.operationId,
    );
    if (racedEvidence) {
      if (!evidenceMatches(racedEvidence, evidence)) {
        throw new ProductOneToOneSnapshotPersistError(
          "operation_identity_conflict",
          "evidence_divergent",
        );
      }
      return "reused";
    }
    throw new ProductOneToOneSnapshotPersistError(
      "frozen_evidence_persist_failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

interface PersistSnapshotWithBindingRow {
  snapshot_original_id: string;
  reused: boolean;
  content_fingerprint: string;
}

function mapPersistRpcError(message: string | undefined | null): ProductOneToOneSnapshotPersistError {
  const text = message ?? "";
  if (text.includes("operation_identity_conflict")) {
    return new ProductOneToOneSnapshotPersistError("operation_identity_conflict", text);
  }
  return new ProductOneToOneSnapshotPersistError("snapshot_persist_failed", text || "unknown");
}

/**
 * F2 — grava o snapshot e o binding ATOMICAMENTE (única transação no Postgres) via
 * RPC `product_1_1_persist_snapshot_with_binding`, garantindo que NUNCA exista
 * "snapshot sem binding". Idempotente: reusa snapshot/binding existentes SOMENTE
 * sob equivalência (`operation_identity_conflict` em divergência). Devolve o
 * `snapshot_original_id` e o `content_fingerprint` PERSISTIDO (fonte de comparação
 * do reparo). Defesa em profundidade: o fingerprint retornado DEVE ser igual ao
 * fingerprint calculado do conteúdo recebido.
 */
async function persistSnapshotWithBinding(
  client: SupabaseClient,
  snapshot: ImageGenerationConfigSnapshot,
  operationId: string,
  contentFingerprint: string,
): Promise<PersistSnapshotWithBindingRow> {
  const { data, error } = await client.rpc(PERSIST_SNAPSHOT_WITH_BINDING_RPC, {
    p_campaign_id: snapshot.campaignId,
    p_primary_model: snapshot.primaryModel,
    p_primary_quality: snapshot.primaryQuality,
    p_fallback_model: snapshot.fallbackModel,
    p_fallback_quality: snapshot.fallbackQuality,
    p_config_version_id: snapshot.configVersionId,
    p_origin: snapshot.origin,
    p_operation_id: operationId,
    p_content_fingerprint: contentFingerprint,
    p_run_id: snapshot.runId ?? null,
    p_trace_id: snapshot.traceId ?? null,
  });
  if (error) throw mapPersistRpcError(error.message);

  // PostgREST devolve SETOF como array; toleramos também um objeto único.
  const row = (Array.isArray(data) ? data[0] : data) as
    | PersistSnapshotWithBindingRow
    | null
    | undefined;
  if (!row || typeof row.snapshot_original_id !== "string" || row.snapshot_original_id === "") {
    throw new ProductOneToOneSnapshotPersistError("snapshot_persist_failed", "missing_rpc_result");
  }

  // Defesa em profundidade (F2): o conteúdo PERSISTIDO deve ser o recebido.
  if (row.content_fingerprint !== contentFingerprint) {
    throw new ProductOneToOneSnapshotPersistError(
      "operation_identity_conflict",
      "content_fingerprint_divergent",
    );
  }

  return row;
}

/**
 * Persiste o snapshot + binding (atômico, via RPC) e a evidência congelada com a
 * MESMA identidade explícita (F6/C3). Falha do insert da evidência é tipada e
 * bloqueia a operação.
 *
 * F2 — escrita atômica: o snapshot e o binding (fingerprint do conteúdo congelado)
 * são gravados numa ÚNICA transação pelo RPC; assim o único estado parcial possível
 * é "snapshot+binding SEM evidência" (NUNCA "snapshot sem binding").
 *
 * F2 — recuperação controlada de pré-reserva: quando a evidência está ausente mas o
 * binding existe, o conteúdo recebido é comparado (fingerprint recalculado ×
 * fingerprint PERSISTIDO) e a evidência é inserida para o MESMO
 * `snapshot_original_id` — nunca substituindo o snapshot congelado — devolvendo
 * `{ snapshotOriginalId: <mesmo>, reused: true }`. Conteúdo divergente no reparo ⇒
 * `operation_identity_conflict`.
 *
 * F1 — à prova de corrida na evidência: pré-consulta + insert; em falha por
 * concorrência (UNIQUE), RE-CONSULTA e reusa SOMENTE sob equivalência; divergência
 * ⇒ `operation_identity_conflict`; ausência persistente ⇒
 * `frozen_evidence_persist_failed`.
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

  const contentFingerprint = computeContentFingerprint(evidence);

  // --- Snapshot + binding: escrita atômica e idempotente (F2). ---
  const bindingRow = await persistSnapshotWithBinding(
    client,
    snapshot,
    evidence.operationId,
    contentFingerprint,
  );
  const snapshotOriginalId = bindingRow.snapshot_original_id;

  // --- Evidência: pré-consulta + insert à prova de corrida + reparo (F1/F2). ---
  const evidenceOutcome = await ensureEvidence(client, snapshotOriginalId, evidence);

  return {
    snapshotOriginalId,
    reused: bindingRow.reused || evidenceOutcome === "reused",
  };
}
