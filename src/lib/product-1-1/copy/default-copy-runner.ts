import "server-only";

import { CopyDirectorService } from "@/lib/copy/copy-director-service";
import { buildCommercialFrame, buildDeterministicCopy } from "@/lib/copy/mapper";
import type { CopyDirectorInput, CopyDirectorResult } from "@/lib/copy/schema";
import type { CampaignIntent } from "@/lib/campaign/types";
import { createDefaultTelemetryContext } from "@/lib/ai/telemetry-sink";
import { defaultAiGateway } from "@/lib/ai";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiTelemetryContext } from "@/lib/ai/types";
import {
  isUnknownPilotOutcome,
  type PilotPaidCallHandle,
  type PilotPaidCallKind,
  type PilotSpendGate,
} from "@/lib/product-1-1/pilot/spend-control";
import {
  computeCopyEstimate,
  type PilotCopyPricing,
} from "@/lib/product-1-1/pilot/copy-estimate";
import { AiModelPricingService } from "@/lib/ai-cost/ai-model-pricing";

import type { CopyCommit, CopyDelivery } from "./copy-state";

/**
 * F56.2b1b — corrida DEFAULT da copy do Produto 1:1 (correção de integração do
 * Plano 08 — gap 1).
 *
 * Conecta o MESMO caminho produtivo de copy usado pelo fluxo legado
 * (`CopyDirectorService` quando `copyDirectorEnabled`, senão `buildDeterministicCopy`)
 * como a implementação DEFAULT da copy do novo fluxo — sem fork do serviço. O
 * orquestrador usa este módulo quando `deps.copy` NÃO é fornecido, de modo que a
 * execução normal GERA copy (antes, nenhuma copy era gerada).
 *
 * O runner apenas GERA e devolve o texto entregue ao drenador via `commit(...)`
 * (a persistência latChada/limitada vive em `copy-state.ts`). A falha da copy
 * NUNCA bloqueia a entrega da imagem (o drenador é best-effort).
 *
 * `invoker` é injetável (testes usam um provider SIMULADO). Em produção o
 * default é o gateway padrão.
 */

/** Contexto (já resolvido server-side) necessário para gerar a copy. */
export interface ProductOneToOneCopyContext {
  readonly storeName: string;
  readonly segment: string;
  readonly toneOfVoice?: string;
  readonly positioning?: string;
  readonly shortDescription?: string;
  readonly slogan?: string;
  readonly brandPersonality?: string;
  readonly campaignGuidelines?: string;
  readonly badgeText?: string;
  readonly originalPriceCents?: number;
  readonly discountedPriceCents?: number;
}

/** Briefing mínimo (produto + comercial) já congelado pelo orquestrador. */
export interface ProductOneToOneCopyBriefing {
  readonly product: { readonly name: string; readonly description?: string | null };
  readonly commercial: {
    readonly intent: CampaignIntent;
    readonly originalPriceText?: string | null;
    readonly discountedPriceText?: string | null;
    readonly badge?: string | null;
    readonly validity?: string | null;
  };
}

export interface DefaultProductOneToOneCopyRunnerInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly briefing: ProductOneToOneCopyBriefing;
  readonly copyContext: ProductOneToOneCopyContext;
  readonly copyDirectorEnabled: boolean;
  readonly usdBrlRateAtGeneration?: number | null;
  readonly creditValueBrlAtGeneration?: number | null;
  readonly runId?: string;
  readonly traceId?: string;
}

export interface DefaultProductOneToOneCopyRunnerDeps {
  /** Invocador do gateway (default `defaultAiGateway`; testes: SIMULADO). */
  readonly invoker?: AiInvoker;
  /** Contexto de telemetria da copy (default `createDefaultTelemetryContext`). */
  readonly createTelemetry?: (input: {
    campaignId: string;
    storeId: string;
    runId?: string;
    traceId?: string;
  }) => AiTelemetryContext;
  /**
   * F56.2b2a (B2.1 / lacuna 3) — alvo EXPLÍCITO do provider desta tentativa,
   * decidido SERVER-SIDE (`primary` na 1ª tentativa; `fallback` na tentativa
   * seguinte, após a espera da política). Cada tentativa faz UMA chamada ao
   * provider com o alvo informado.
   */
  readonly target?: "primary" | "fallback";
  /**
   * F56.2b2c (B2.3) — gate de gasto do piloto (INATIVO se ausente). Contabiliza a
   * COPY por chamada; só `acquired` autoriza o provider da copy.
   */
  readonly pilotSpend?: PilotSpendGate;
  /** Kind da chamada de copy (`copy_initial` default; `copy_auto`/`copy_manual` na recuperação). */
  readonly callKind?: PilotPaidCallKind;
  /**
   * Estimativa conservadora (USD) da chamada de copy. OBRIGATÓRIA quando o gate do
   * piloto está ARMADO (`pilotSpend` presente): ausência ⇒ a chamada é BLOQUEADA
   * (nunca contabilizada como US$ 0).
   */
  readonly estimatedUsd?: number;
  /** Leitura do PRICING do ALVO PREPARADO (default: `AiModelPricingService`). */
  readonly readCopyPricing?: (target: {
    provider: string;
    model: string;
  }) => Promise<PilotCopyPricing | null>;
  /** Sequência real da tentativa (default 0) — contabilidade por chamada. */
  readonly attemptSeq?: number;
}

/** Leitor DEFAULT do pricing do alvo preparado (falha/ausência ⇒ `null`). */
async function defaultReadCopyPricing(target: {
  provider: string;
  model: string;
}): Promise<PilotCopyPricing | null> {
  const result = await new AiModelPricingService().getModelPricing({
    provider: target.provider as never,
    model: target.model,
  });
  // O piloto exige pricing CADASTRADO válido — o bootstrap `code_default` NÃO
  // é aceito (fora do piloto o comportamento legado permanece).
  if (!result || !result.pricing || result.versionId === "code_default") return null;
  const input = result.pricing.inputCostUsd;
  const output = result.pricing.outputCostUsd;
  if (input == null || output == null) return null;
  return { inputUsdPer1M: input, outputUsdPer1M: output, versionId: result.versionId };
}

/** Contrato estrutural consumido pelo orquestrador (`ProductOneToOneCopyOps`). */
export interface ProductOneToOneCopyRunnerOps {
  readonly runCopy: (input: {
    campaignId: string;
    operationId: string;
    signal: AbortSignal;
    commit: CopyCommit;
  }) => Promise<void>;
}

function buildCopyInput(
  input: DefaultProductOneToOneCopyRunnerInput,
): CopyDirectorInput {
  const { product, commercial } = input.briefing;
  const ctx = input.copyContext;
  const campaignIntent = commercial.intent;
  const commercialFrame = buildCommercialFrame(campaignIntent, {
    badgeText: ctx.badgeText,
    originalPriceCents: ctx.originalPriceCents,
    discountedPriceCents: ctx.discountedPriceCents,
  });
  return {
    productName: product.name,
    description: product.description ?? undefined,
    commercialFrame,
    campaignIntent,
    storeName: ctx.storeName,
    segment: ctx.segment,
    toneOfVoice: ctx.toneOfVoice,
    positioning: ctx.positioning,
    shortDescription: ctx.shortDescription,
    slogan: ctx.slogan,
    brandPersonality: ctx.brandPersonality,
    campaignGuidelines: ctx.campaignGuidelines,
  };
}

function deliveryFromResult(result: CopyDirectorResult): CopyDelivery {
  return {
    copyText: result.caption,
    payload: result as unknown as Record<string, unknown>,
  };
}

/**
 * Cria a corrida DEFAULT da copy. Gera via `CopyDirectorService` (caminho
 * produtivo legado) com fallback determinístico quando a flag está desligada.
 */
export function createDefaultProductOneToOneCopyOps(
  input: DefaultProductOneToOneCopyRunnerInput,
  deps: DefaultProductOneToOneCopyRunnerDeps = {},
): ProductOneToOneCopyRunnerOps {
  const createTelemetry =
    deps.createTelemetry ??
    ((ctx: { campaignId: string; storeId: string; runId?: string; traceId?: string }) =>
      createDefaultTelemetryContext({
        operationRunId: ctx.runId ?? ctx.campaignId,
        operationRunType: "campaign_delivery",
        traceId: ctx.traceId ?? ctx.campaignId,
        storeId: ctx.storeId,
        campaignId: ctx.campaignId,
        attemptNumber: 0,
        // F46-04 (D3) — snapshot econômico propagado (nunca fallback silencioso).
        usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
        creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
      }));

  const generate = async (signal: AbortSignal): Promise<CopyDelivery> => {
    const copyInput = buildCopyInput(input);

    if (!input.copyDirectorEnabled) {
      const deterministic = buildDeterministicCopy(input.briefing.commercial.intent, {
        productName: input.briefing.product.name,
        storeName: input.copyContext.storeName,
        commercialFrame: copyInput.commercialFrame,
        discountedPriceCents: input.copyContext.discountedPriceCents,
        badgeText: input.copyContext.badgeText,
      });
      return deliveryFromResult(deterministic);
    }

    const invoker = deps.invoker ?? defaultAiGateway;
    const telemetry = createTelemetry({
      campaignId: input.campaignId,
      storeId: input.storeId,
      runId: input.runId,
      traceId: input.traceId,
    });

    // F56.2b2c (B2.3) — gate de gasto do piloto POR CHAMADA (INATIVO se ausente).
    const pilotSpend = deps.pilotSpend;
    const callKind: PilotPaidCallKind = deps.callKind ?? "copy_initial";
    const attemptSeq = deps.attemptSeq ?? 0;
    const target = deps.target ?? "primary";
    let pilotHandle: PilotPaidCallHandle | undefined;
    let copyEstimate: number | undefined;
    let pinnedInvoker: AiInvoker | undefined;
    if (pilotSpend) {
      // Coerência por chamada (opção 2): preparar o alvo UMA vez; pricing e
      // estimativa DESTE mesmo alvo; preparação ausente ou pricing inválido
      // BLOQUEIA sem provider. Caminho legado (sem gate) inalterado.
      if (!invoker.prepare || !invoker.invokePrepared) {
        throw new Error("pilot_spend_blocked:preparation_unsupported");
      }
      const prepared = await invoker.prepare("campaign_copy", target);
      const pricing = await (deps.readCopyPricing ?? defaultReadCopyPricing)({
        provider: prepared.provider,
        model: prepared.model,
      });
      // REGISTRA a versão de pricing efetivamente usada (vinculada ao alvo).
      console.info(
        "[pilot-copy] pricing version=%s provider=%s model=%s",
        pricing?.versionId ?? "unknown",
        prepared.provider,
        prepared.model,
      );
      const estimate = computeCopyEstimate(pricing);
      if (estimate === null) {
        throw new Error("pilot_spend_blocked:pricing_unavailable");
      }
      copyEstimate = estimate;
      const decision = await pilotSpend.beginPaidCall({
        campaignId: input.campaignId,
        operationId: input.operationId,
        kind: callKind,
        attemptSeq,
        estimatedUsd: estimate,
      });
      if (!decision.acquired) {
        throw new Error(`pilot_spend_blocked:${decision.reason}`);
      }
      pilotHandle = decision.handle;
      // Invocação PREPARADA — mesmo alvo/versão de pricing da estimativa.
      pinnedInvoker = {
        hasFallback: (capability) => invoker.hasFallback(capability),
        invoke: (_capability, request, tel) => invoker.invokePrepared!(prepared, request, tel),
      };
    }

    const service = new CopyDirectorService(pinnedInvoker ?? invoker);

    // F56.2b2a (lacuna 3) — EXATAMENTE UMA chamada ao provider por tentativa: o
    // alvo é EXPLÍCITO e decidido SERVER-SIDE; NÃO existe fallback INTERNO
    // dentro do MESMO acionamento. O alvo de fallback, quando aplicável, é a
    // TENTATIVA SEGUINTE (adquirida após a espera da política).
    try {
      const result = await service.generateCopy(copyInput, {
        signal,
        telemetry,
        target,
      });
      if (pilotSpend && pilotHandle) {
        await pilotSpend.endPaidCall({ handle: pilotHandle, actualEstimatedUsd: copyEstimate });
      }
      return deliveryFromResult(result);
    } catch (error) {
      if (pilotSpend && pilotHandle) {
        // M3 — falha do gate é REGISTRADA SEPARADAMENTE; o erro ORIGINAL é relançado
        // (natureza desconhecida preservada). Nunca converte em retry/failed/estorno.
        try {
          if (signal.aborted || isUnknownPilotOutcome(error)) {
            await pilotSpend.markUnknown({ handle: pilotHandle, reason: "timeout_or_unknown" });
          } else {
            await pilotSpend.endPaidCall({ handle: pilotHandle, actualEstimatedUsd: copyEstimate });
          }
        } catch (gateError) {
          console.error(
            "[pilot-spend] falha ao encerrar/marcar a chamada de copy:",
            String(gateError instanceof Error ? gateError.message : gateError),
          );
        }
      }
      throw error;
    }
  };

  return {
    runCopy: async ({ signal, commit }) => {
      const delivery = await generate(signal);
      await commit(delivery);
    },
  };
}
