import { AiGateway } from "@/lib/ai/gateway";
import type { AiModelResolver } from "@/lib/ai/model-resolver";
import type { AiProtocol } from "@/lib/ai/model-resolver";
import type {
  AiAdapterRegistry,
  AiInvocationRequest,
} from "@/lib/ai/types";
import { BenchImagesAdapter } from "@/lib/ai/adapters/bench-images";
import { defaultAdapterRegistry } from "@/lib/ai/adapters/registry";
import type { BenchPreset } from "../domain/preset-registry";
import { BenchPresetResolver } from "./bench-model-resolver";

/**
 * Runtime do harness da **bancada de geração** (F48.2.2, D8).
 *
 * Compõe uma instância **própria** de `AiGateway` (nunca reabre o gateway de
 * produção) com o resolver de preset (`BenchPresetResolver`) e um adapter
 * registry que registra o **adapter `Images` dedicado da bancada** (`quality`
 * propagado) **apenas** aqui — o `ImagesAdapter` produtivo e o
 * `defaultAdapterRegistry` permanecem intocados (T-48-2-2-25).
 *
 * O harness é **single-shot**: o resolver devolve `fallback: undefined` e a
 * execução invoca a capability uma única vez, sem retry e sem segunda chamada
 * paga (T-48-2-2-26).
 */

/**
 * Registry de adapters da bancada: `images` resolve para o adapter dedicado; os
 * demais protocolos delegam **em modo leitura** ao registry padrão (nenhum
 * adapter produtivo é alterado ou substituído no registry padrão).
 */
export function createBenchAdapterRegistry(
  params: { fallbackRegistry?: AiAdapterRegistry } = {},
): AiAdapterRegistry {
  const benchImages = new BenchImagesAdapter();
  const fallback = params.fallbackRegistry ?? defaultAdapterRegistry;

  return {
    get: (protocol: AiProtocol) => {
      if (protocol === "images") return benchImages;
      return fallback.get(protocol);
    },
  };
}

/**
 * Compõe o gateway da bancada com o resolver de preset (single-shot). Reutiliza
 * o padrão de `createLabGateway` — sem alterar o runtime do laboratório A/B.
 */
export function createBenchGateway(params: {
  preset: BenchPreset;
  adapters: AiAdapterRegistry;
  fallbackResolver: AiModelResolver;
}): AiGateway {
  const resolver = new BenchPresetResolver({
    preset: params.preset,
    fallbackResolver: params.fallbackResolver,
  });
  return new AiGateway(resolver, params.adapters);
}

/**
 * Monta a requisição explícita e controlada da bancada: prompt, imagens de
 * produto (ordem/papel recebidos), tamanho e **qualidade** do preset, além do
 * `signal` (timeout/cancelamento).
 *
 * O **logo/assinatura do branding não entra** aqui: `identityImageUrl` é
 * deliberadamente omitido — apenas imagens de produto enviadas por upload são
 * referências (T-48-2-2-29).
 */
export function buildBenchInvocationRequest(params: {
  preset: BenchPreset;
  prompt: string;
  productImagesDataUrls?: readonly string[];
  signal?: AbortSignal;
  timeout?: number;
}): AiInvocationRequest {
  return {
    prompt: params.prompt,
    productImagesDataUrls: params.productImagesDataUrls ? [...params.productImagesDataUrls] : [],
    size: params.preset.size,
    quality: params.preset.quality,
    ...(params.signal ? { signal: params.signal } : {}),
    ...(params.timeout !== undefined ? { timeout: params.timeout } : {}),
  };
}
