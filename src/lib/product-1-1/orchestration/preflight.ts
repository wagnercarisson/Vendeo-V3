import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import {
  assertEligibleModelPair,
  type ImageModelPairConfig,
} from "@/lib/ai/image-model-pair";
import type { CurrentImageGenerationConfig } from "@/lib/ai/image-generation-config-snapshot";
import { resolveImageModelPairConfig } from "@/lib/ai/image-model-pair-config-service";
import {
  assertImagePairExecutable,
  type ImagePairCostResolution,
} from "@/lib/ai-cost/image-pair-pricing";
import type { ImagePairCapacityPricingStatus } from "@/lib/ai-cost/types";

/**
 * F56.2b1b (B1B-D3/D4, F3, C5, REQ-56.2.2-03) — preflight **fail-closed** do novo
 * fluxo Produto 1:1, executado ANTES de reserva e provider.
 *
 * Ordem (C5): resolver configuração UMA vez → validar pricing `complete` para
 * principal e fallback → (o orquestrador compõe/congela e persiste) → reserva →
 * provider. O preflight **não** constrói nem persiste snapshot/evidência: ele
 * devolve a configuração resolvida (par principal/fallback + versão/origem) e a
 * cobertura de pricing como a FONTE ÚNICA consumida pelo orquestrador.
 *
 * F3 — resolução única: a configuração vigente é lida/resolvida EXATAMENTE uma
 * vez; após o congelamento nenhuma configuração mutável é relida para a mesma
 * operação. Config ausente/incompleta/divergente é erro identificável (fail-
 * closed), nunca um default silencioso, e a cobertura de pricing incompleta de
 * QUALQUER par (principal ou fallback) bloqueia a execução sem reserva/provider.
 *
 * F2 — recuperação de pré-reserva: quando `campaignId` é informado, o preflight
 * classifica a evidência congelada do snapshot existente. `repairable` (snapshot+
 * binding sem evidência) NÃO lança — é devolvido em `frozenEvidence` para o
 * orquestrador reparar ANTES de reservar/chamar provider; `corrupt` (snapshot sem
 * binding) é fail-closed. A reserva/provider permanecem bloqueados até a
 * evidência estar completa (garantido pelo passo de persistência/reparo).
 *
 * O fluxo NÃO invoca revisor automático de imagem — a decisão de arte é
 * programática (spec `product-1-1-generation-orchestration/spec.md:134`).
 *
 * `deps` é injetável para testes puros: quando todos os deps são fornecidos, a
 * função não toca banco/provider/crédito.
 */

const SNAPSHOT_TABLE = "image_generation_config_snapshots";
const EVIDENCE_TABLE = "product_1_1_snapshot_frozen_evidence";
const BINDING_TABLE = "product_1_1_snapshot_content_binding";

/**
 * Estado da evidência congelada de um snapshot de novo fluxo existente (C3/F6/F2).
 *
 * F2 — o preflight DISTINGUE um estado PARCIAL REPARÁVEL de um estado CORROMPIDO
 * não executável:
 * - `no_snapshot`: nenhum snapshot para a campanha (nova entrada).
 * - `complete`: snapshot + evidência congelada presentes (replay ok).
 * - `repairable`: snapshot + binding presentes, mas evidência AUSENTE (estado
 *   parcial de uma chamada anterior) — o orquestrador DEVE reparar (persistir a
 *   evidência para o MESMO snapshot) ANTES de reservar/chamar provider.
 * - `corrupt`: snapshot SEM binding — estado não executável ⇒ fail-closed.
 */
export type SnapshotFrozenEvidenceState =
  | { readonly kind: "no_snapshot" }
  | { readonly kind: "complete"; readonly snapshotOriginalId: string }
  | { readonly kind: "repairable"; readonly snapshotOriginalId: string }
  | { readonly kind: "corrupt"; readonly snapshotOriginalId: string };

export interface NewFlowPreflightDeps {
  readonly campaignId?: string;
  /** Resolve a configuração vigente (F3 — chamado no máximo uma vez). */
  readonly resolveConfig?: () => Promise<CurrentImageGenerationConfig>;
  /** Exige pricing `complete` para principal E fallback (fail-closed). */
  readonly assertExecutable?: (
    pair: ImageModelPairConfig,
  ) => Promise<ImagePairCapacityPricingStatus>;
  /** Custo por tentativa (por alvo) quando completo (D-22). */
  readonly resolveCost?: (pair: ImageModelPairConfig) => Promise<ImagePairCostResolution>;
  /** Verifica se um snapshot de novo fluxo existente tem evidência congelada. */
  readonly resolveFrozenEvidenceState?: (
    campaignId: string,
  ) => Promise<SnapshotFrozenEvidenceState>;
}

export interface NewFlowPreflightResult {
  /** Configuração resolvida — fonte única do par/versão/origem (F3/C5). */
  readonly config: CurrentImageGenerationConfig;
  readonly pricing: ImagePairCapacityPricingStatus;
  readonly attemptCost?: ImagePairCostResolution;
  /**
   * F2 — estado da evidência congelada do snapshot existente (quando `campaignId`
   * é informado). `repairable` NÃO é erro: sinaliza ao orquestrador que ele DEVE
   * reparar (persistir a evidência para o MESMO snapshot) ANTES de reservar/chamar
   * provider. Reserva/provider permanecem bloqueados até a evidência estar completa.
   */
  readonly frozenEvidence?: SnapshotFrozenEvidenceState;
}

export type NewFlowPreflightErrorCode =
  | "frozen_evidence_corrupt"
  | "snapshot_read_failed"
  | "evidence_read_failed"
  | "binding_read_failed";

/** Erro tipado do preflight — bloqueia sem reserva/provider. */
export class NewFlowPreflightError extends Error {
  readonly code: NewFlowPreflightErrorCode;

  constructor(code: NewFlowPreflightErrorCode, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "NewFlowPreflightError";
    this.code = code;
  }
}

async function defaultResolveConfig(): Promise<CurrentImageGenerationConfig> {
  const resolved = await resolveImageModelPairConfig();
  return {
    primary: resolved.primary,
    fallback: resolved.fallback,
    origin: resolved.origin,
    configVersionId: resolved.configVersionId,
  };
}

async function defaultAssertExecutable(
  pair: ImageModelPairConfig,
): Promise<ImagePairCapacityPricingStatus> {
  return assertImagePairExecutable(pair);
}

async function defaultResolveFrozenEvidenceState(
  campaignId: string,
): Promise<SnapshotFrozenEvidenceState> {
  const { data: snapshot, error: snapshotError } = await (
    supabaseAdmin as unknown as SupabaseClient
  )
    .from(SNAPSHOT_TABLE)
    .select("id")
    .eq("campaign_id", campaignId)
    .maybeSingle<{ id: string }>();
  if (snapshotError) {
    throw new NewFlowPreflightError("snapshot_read_failed", snapshotError.message);
  }
  if (!snapshot) return { kind: "no_snapshot" };

  const { data: evidence, error: evidenceError } = await (
    supabaseAdmin as unknown as SupabaseClient
  )
    .from(EVIDENCE_TABLE)
    .select("id")
    .eq("snapshot_original_id", snapshot.id)
    .maybeSingle<{ id: string }>();
  if (evidenceError) {
    throw new NewFlowPreflightError("evidence_read_failed", evidenceError.message);
  }
  if (evidence) return { kind: "complete", snapshotOriginalId: snapshot.id };

  // F2 — sem evidência: o binding persistido (fonte de comparação do reparo)
  // distingue o estado PARCIAL REPARÁVEL do estado CORROMPIDO (snapshot sem binding).
  const { data: binding, error: bindingError } = await (
    supabaseAdmin as unknown as SupabaseClient
  )
    .from(BINDING_TABLE)
    .select("snapshot_original_id")
    .eq("snapshot_original_id", snapshot.id)
    .maybeSingle<{ snapshot_original_id: string }>();
  if (bindingError) {
    throw new NewFlowPreflightError("binding_read_failed", bindingError.message);
  }

  return binding
    ? { kind: "repairable", snapshotOriginalId: snapshot.id }
    : { kind: "corrupt", snapshotOriginalId: snapshot.id };
}

/**
 * Executa o preflight fail-closed: resolve a configuração UMA vez (F3), valida o
 * par contra o catálogo elegível, classifica a evidência congelada de um snapshot
 * existente e exige pricing `complete` para principal e fallback. Não constrói/
 * persiste snapshot nem toca reserva/provider.
 *
 * F2 — o estado `repairable` (snapshot+binding sem evidência) NÃO lança: é
 * devolvido em `frozenEvidence` para o orquestrador reparar ANTES de reservar/
 * chamar provider. O estado `corrupt` (snapshot SEM binding) é fail-closed. Falhas
 * de leitura permanecem fatais (`NewFlowPreflightError`).
 */
export async function runNewFlowPreflight(
  deps: NewFlowPreflightDeps = {},
): Promise<NewFlowPreflightResult> {
  const resolveConfig = deps.resolveConfig ?? defaultResolveConfig;
  const config = await resolveConfig(); // F3 — resolução ÚNICA
  assertEligibleModelPair(config.primary);
  assertEligibleModelPair(config.fallback);

  let frozenEvidence: SnapshotFrozenEvidenceState | undefined;
  if (deps.campaignId) {
    const resolveFrozenEvidenceState =
      deps.resolveFrozenEvidenceState ?? defaultResolveFrozenEvidenceState;
    const state = await resolveFrozenEvidenceState(deps.campaignId);
    // F2 — corrompido (snapshot sem binding) ⇒ fail-closed, sem reserva/provider.
    // `repairable` NÃO lança: o orquestrador repara antes de reservar/chamar provider.
    if (state.kind === "corrupt") {
      throw new NewFlowPreflightError("frozen_evidence_corrupt", state.snapshotOriginalId);
    }
    frozenEvidence = state;
  }

  // IN-04: `frozenEvidence` é uma SUPERFÍCIE DE CONTRATO/TESTE — o orquestrador
  // NÃO a consome para decidir efeitos; o reparo de `repairable` é aplicado
  // incondicionalmente por `persistProductOneToOneSnapshot` (o caminho CORRETO) e o
  // fail-closed de `corrupt` é reforçado pela própria RPC. A classificação existe
  // para o contrato de preflight (`snapshot-preflight.contract.test.ts`) — não é um
  // bug de comportamento, apenas uma saída não consumida em runtime.

  const pairConfig: ImageModelPairConfig = {
    primary: config.primary,
    fallback: config.fallback,
  };

  const assertExecutable = deps.assertExecutable ?? defaultAssertExecutable;
  const pricing = await assertExecutable(pairConfig);

  if (!deps.resolveCost) {
    return frozenEvidence ? { config, pricing, frozenEvidence } : { config, pricing };
  }
  const attemptCost = await deps.resolveCost(pairConfig);
  return frozenEvidence
    ? { config, pricing, attemptCost, frozenEvidence }
    : { config, pricing, attemptCost };
}
