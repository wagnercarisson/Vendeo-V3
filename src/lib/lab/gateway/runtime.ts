import { AiGateway } from "@/lib/ai/gateway";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiModelResolver, AiModelTarget } from "@/lib/ai/model-resolver";
import type {
  AiAdapterRegistry,
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
  AiTelemetrySink,
} from "@/lib/ai/types";
import { LabModelResolver } from "./lab-model-resolver";

/**
 * Runtime do harness de gateway do Laboratório de IA (F48.1, D6/D7/D14/D18).
 *
 * Composição de uma instância **paralela** de `AiGateway` com resolver
 * laboratorial (alvo fixo do experimento) — o gateway de produção permanece
 * intocado (T-48-1-32).
 *
 * Invocação **single-shot**: exatamente uma chamada `campaign_image` por run,
 * sem retry, sem alvo alternativo e sem consultar se existe fallback. É isso que
 * garante o custo previsível e a comparação A/B justa (T-48-1-31).
 */

export function createLabGateway(params: {
  fixedTarget: AiModelTarget;
  fallbackResolver: AiModelResolver;
  adapters: AiAdapterRegistry;
}): AiGateway {
  const resolver = new LabModelResolver({
    fixedTarget: params.fixedTarget,
    fallbackResolver: params.fallbackResolver,
  });
  return new AiGateway(resolver, params.adapters);
}

/**
 * Contexto de telemetria do run laboratorial. O tipo de run econômico reutiliza
 * `"campaign_delivery"` (o union tem exatamente 4 domínios, travado por teste);
 * a marcação própria do laboratório vive no snapshot do run (T-48-1-38).
 */
export function createLabTelemetryContext(params: {
  sink: AiTelemetrySink;
  operationRunId: string;
  traceId: string;
  storeId: string;
  userId?: string;
}): AiTelemetryContext {
  return {
    operationRunId: params.operationRunId,
    operationRunType: "campaign_delivery",
    traceId: params.traceId,
    storeId: params.storeId,
    userId: params.userId,
    sink: params.sink,
  };
}

/** Invoca a capacidade de imagem uma única vez, no alvo primário do resolver. */
export async function runLabCampaignImage(params: {
  gateway: AiInvoker;
  request: AiInvocationRequest;
  telemetry: AiTelemetryContext;
}): Promise<AiInvocationResult> {
  return params.gateway.invoke("campaign_image", params.request, params.telemetry);
}

/**
 * Composição padrão (produção local do laboratório).
 *
 * O import de `@/lib/ai` é **dinâmico** de propósito: o índice carrega o cliente
 * server-only do Supabase e não pode ser avaliado no load de um módulo importado
 * por testes (T-48-1-39). Testes injetam fakes e nunca tocam este caminho.
 */
export async function createDefaultLabRuntime(params: { fixedTarget: AiModelTarget }): Promise<{
  gateway: AiGateway;
  fallbackResolver: AiModelResolver;
  adapters: AiAdapterRegistry;
}> {
  const { defaultAiModelResolver, defaultAdapterRegistry } = await import("@/lib/ai");

  return {
    gateway: createLabGateway({
      fixedTarget: params.fixedTarget,
      fallbackResolver: defaultAiModelResolver,
      adapters: defaultAdapterRegistry,
    }),
    fallbackResolver: defaultAiModelResolver,
    adapters: defaultAdapterRegistry,
  };
}
