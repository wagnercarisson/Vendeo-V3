import "server-only";

import { CopyDirectorService } from "@/lib/copy/copy-director-service";
import { buildCommercialFrame, buildDeterministicCopy } from "@/lib/copy/mapper";
import { isRetryableError } from "@/lib/copy/errors";
import type { CopyDirectorInput, CopyDirectorResult } from "@/lib/copy/schema";
import type { CampaignIntent } from "@/lib/campaign/types";
import { createDefaultTelemetryContext } from "@/lib/ai/telemetry-sink";
import { defaultAiGateway } from "@/lib/ai";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiTelemetryContext } from "@/lib/ai/types";

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

    const service = new CopyDirectorService(deps.invoker ?? defaultAiGateway);
    const telemetry = createTelemetry({
      campaignId: input.campaignId,
      storeId: input.storeId,
      runId: input.runId,
      traceId: input.traceId,
    });

    try {
      const result = await service.generateCopy(copyInput, {
        signal,
        telemetry,
        target: deps.target ?? "primary",
      });
      return deliveryFromResult(result);
    } catch (err) {
      if (isRetryableError(err) && (await service.hasFallback())) {
        const result = await service.generateCopy(copyInput, {
          signal,
          telemetry,
          target: "fallback",
        });
        return deliveryFromResult(result);
      }
      throw err;
    }
  };

  return {
    runCopy: async ({ signal, commit }) => {
      const delivery = await generate(signal);
      await commit(delivery);
    },
  };
}
