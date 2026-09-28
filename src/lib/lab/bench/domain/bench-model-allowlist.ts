import type { AiProtocol, AiProvider } from "@/lib/ai/model-resolver";

/**
 * Allowlist própria da bancada de geração (F48.2.2, D7) — **autoridade dos
 * presets da bancada**.
 *
 * Módulo **puro** (apenas tipos importados) — sem I/O, sem `process.env` e sem
 * importar o client administrativo do Supabase.
 *
 * ## Independência da allowlist produtiva
 *
 * Esta allowlist é **independente** do `MODEL_ALLOWLIST` produtivo
 * (`src/lib/ai/model-registry.ts`): um modelo confirmado pelo spike e ausente da
 * allowlist de produção (ex.: `gpt-image-2.5-flare`) PODE constar aqui. O
 * `MODEL_ALLOWLIST` produtivo **não** é importado como interseção obrigatória nem
 * alterado (regressão).
 *
 * ## Candidatos sob investigação ≠ geração habilitada
 *
 * A allowlist lista os **alvos candidatos sob investigação do spike**. Constar
 * aqui **não habilita geração**: a geração é gated pelo `enabled` do preset
 * (`preset-registry.ts`), e **nenhum preset está habilitado** antes do
 * CHECKPOINT 1 (todos `enabled: false` com motivo). O plano 04 habilita apenas os
 * presets confirmados pelo spike.
 */

export const BENCH_MODEL_ALLOWLIST: Record<AiProvider, Record<string, readonly AiProtocol[]>> = {
  openai: {
    "gpt-image-2": ["images"],
    "gpt-image-2.5-flare": ["images"],
  },
  gemini: {},
};

/**
 * Confirma que `provider`/`model`/`protocol` constam da allowlist da bancada.
 * Lança quando o provider, o modelo ou o protocolo estão fora da allowlist —
 * antes de qualquer chamada paga.
 */
export function assertBenchTargetAllowed(
  provider: AiProvider,
  model: string,
  protocol: AiProtocol,
): void {
  const providerModels = BENCH_MODEL_ALLOWLIST[provider];
  if (!providerModels) {
    throw new Error(
      `[bench-model-allowlist] provider "${provider}" fora da allowlist da bancada`,
    );
  }
  const allowedProtocols = providerModels[model];
  if (!allowedProtocols) {
    throw new Error(
      `[bench-model-allowlist] modelo "${model}" fora da allowlist da bancada (provider "${provider}")`,
    );
  }
  if (!allowedProtocols.includes(protocol)) {
    throw new Error(
      `[bench-model-allowlist] protocolo "${protocol}" incompatível com o modelo "${model}" na bancada`,
    );
  }
}
