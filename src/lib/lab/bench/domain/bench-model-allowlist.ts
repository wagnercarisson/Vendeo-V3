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
 * ## Confirmados pelo spike (CHECKPOINT 1) ≠ geração habilitada
 *
 * A allowlist lista os **alvos confirmados pelo spike** (`docs/lab/48-2-2-spike-models.md`).
 * Após o CHECKPOINT 1, ambos os modelos do primeiro recorte (`gpt-image-2` e
 * `gpt-image-2.5-flare`) foram confirmados no **caminho direto `images`** — as
 * entradas abaixo refletem essa decisão. Constar aqui ainda **não habilita
 * geração**: a geração é gated pelo `enabled` do preset (`preset-registry.ts`) e
 * pela aprovação humana do CHECKPOINT 2. O protocolo `responses` **não** foi
 * exigido por nenhum modelo confirmado e por isso **não** é adicionado aqui.
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
