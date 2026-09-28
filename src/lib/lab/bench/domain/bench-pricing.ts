import type { AiProtocol, AiProvider } from "@/lib/ai/model-resolver";

/**
 * Pricing local da bancada (F48.2.2, D11/D12) — **módulo puro, versionado e sem
 * I/O**, chaveado pelo **preset completo** (`provider + model + protocol +
 * quality + size`).
 *
 * ## Por que existe (e por que NÃO reutiliza o pricing produtivo)
 *
 * O pricing produtivo (`resolveAiCost`/`ai_model_pricing`) é chaveado apenas por
 * `provider + model` e **não** distingue qualidade — é insuficiente para a
 * bancada, cujo custo varia com `quality`/`size` (D12). Este módulo é a fonte
 * **exclusiva** da estimativa da bancada e **não** importa nem chama o resolvedor
 * produtivo. O pricing vive **somente em código** (`bench-pricing.ts`), **sem
 * tabela de pricing** no banco (D17) — o bootstrap nunca persiste pricing.
 *
 * ## Modo confirmado pelo spike (CHECKPOINT 1)
 *
 * O spike (`docs/lab/48-2-2-spike-models.md`) confirmou o modo **`token_based`**
 * para ambos os modelos: cobrança por tokens de imagem (entrada/saída), com
 * `usage` token-based. `per_image` (preço fixo por imagem) é um modo suportado
 * pelo contrato, mas nenhum preset confirmado o usa nesta fase. O
 * `unitPriceUsd` aqui é a **estimativa de saída** por peça (taxa de saída ×
 * tokens de saída estimados), usada quando o `usage` real ainda não existe —
 * **nunca** como multiplicação genérica de `usage × unitPriceUsd` (D11).
 */

/** Versão da regra de pricing local (rastreada em `cost_rule_version`). */
export const BENCH_PRICING_RULE_VERSION = "2026-09-bench-1";

/** Modo de cobrança do preset. `unknown` é usado quando não há entrada de pricing. */
export type BenchPricingMode = "per_image" | "token_based" | "unknown";

/** Cobertura do pricing para o preset: `complete`, `partial` ou `missing`. */
export type BenchPricingCoverage = "complete" | "partial" | "missing";

/** Taxas por token (USD por 1M tokens) — modo `token_based`. */
export interface BenchTokenRates {
  inputTextUsdPerMillion: number;
  inputImageUsdPerMillion: number;
  outputImageUsdPerMillion: number;
}

/** Entrada de pricing local, chaveada pelo preset completo. */
export interface BenchPricingEntry {
  provider: AiProvider;
  model: string;
  protocol: AiProtocol;
  quality: string;
  size: string;
  mode: BenchPricingMode;
  /** Estimativa de saída por peça (USD). */
  unitPriceUsd?: number;
  tokenRates?: BenchTokenRates;
  /** Tokens de saída estimados para o preset (distingue `low` de `medium`). */
  estimatedOutputTokens?: number;
  coverage: BenchPricingCoverage;
  ruleVersion: string;
}

/** Resultado da resolução de pricing para um preset. */
export interface BenchPricingResolution {
  mode: BenchPricingMode;
  unitPriceUsd?: number;
  tokenRates?: BenchTokenRates;
  estimatedOutputTokens?: number;
  coverage: BenchPricingCoverage;
  ruleVersion: string;
}

/** Chave de busca do pricing local — o preset completo. */
export interface BenchPricingKey {
  provider: AiProvider;
  model: string;
  protocol: AiProtocol;
  quality: string;
  size: string;
}

// ─── Taxas por token (pricing público oficial, consulta 2026-09-28) ──────────

/** `gpt-image-2`: texto US$2,50/M, imagem entrada US$4/M, saída US$15/M. */
const GPT_IMAGE_2_RATES: BenchTokenRates = {
  inputTextUsdPerMillion: 2.5,
  inputImageUsdPerMillion: 4,
  outputImageUsdPerMillion: 15,
};

/** `gpt-image-2.5-flare`: texto US$5/M, imagem entrada US$8/M, saída US$30/M. */
const GPT_IMAGE_2_5_FLARE_RATES: BenchTokenRates = {
  inputTextUsdPerMillion: 5,
  inputImageUsdPerMillion: 8,
  outputImageUsdPerMillion: 30,
};

/**
 * Tokens de saída estimados (formato 1:1) por qualidade. A referência pública do
 * spike para `gpt-image-2` é ~US$0,006 em `low` e ~US$0,053 em `medium`; com a
 * taxa de saída de US$15/M, isso equivale a ~400 e ~3533 tokens de saída.
 */
const ESTIMATED_OUTPUT_TOKENS_BY_QUALITY: Record<string, number> = {
  low: 400,
  medium: 3533,
};

function estimateOutputUnitPriceUsd(rates: BenchTokenRates, outputTokens: number): number {
  return (rates.outputImageUsdPerMillion * outputTokens) / 1_000_000;
}

function tokenBasedEntry(params: {
  model: string;
  quality: string;
  tokenRates: BenchTokenRates;
  coverage: BenchPricingCoverage;
  size?: string;
}): BenchPricingEntry {
  const estimatedOutputTokens = ESTIMATED_OUTPUT_TOKENS_BY_QUALITY[params.quality];
  return {
    provider: "openai",
    model: params.model,
    protocol: "images",
    quality: params.quality,
    size: params.size ?? "1024x1024",
    mode: "token_based",
    tokenRates: params.tokenRates,
    estimatedOutputTokens,
    unitPriceUsd: estimateOutputUnitPriceUsd(params.tokenRates, estimatedOutputTokens),
    coverage: params.coverage,
    ruleVersion: BENCH_PRICING_RULE_VERSION,
  };
}

/**
 * Pricing local da bancada, chaveado por `provider + model + protocol + quality
 * + size`. `low` e `medium` têm entradas distintas (tokens de saída distintos ⇒
 * `unitPriceUsd` distinto).
 *
 * Cobertura: `gpt-image-2` é `complete` (referência pública por peça publicada);
 * `gpt-image-2.5-flare` é `partial` (taxas por token publicadas, sem referência
 * pública por peça — a estimativa de saída é derivada).
 */
export const BENCH_PRICING_ENTRIES: readonly BenchPricingEntry[] = [
  tokenBasedEntry({
    model: "gpt-image-2",
    quality: "low",
    tokenRates: GPT_IMAGE_2_RATES,
    coverage: "complete",
  }),
  tokenBasedEntry({
    model: "gpt-image-2",
    quality: "medium",
    tokenRates: GPT_IMAGE_2_RATES,
    coverage: "complete",
  }),
  tokenBasedEntry({
    model: "gpt-image-2.5-flare",
    quality: "low",
    tokenRates: GPT_IMAGE_2_5_FLARE_RATES,
    coverage: "partial",
  }),
  tokenBasedEntry({
    model: "gpt-image-2.5-flare",
    quality: "medium",
    tokenRates: GPT_IMAGE_2_5_FLARE_RATES,
    coverage: "partial",
  }),
];

/**
 * Resolve o pricing local pelo preset completo. Combinação ausente devolve
 * `coverage: "missing"` (nunca o pricing produtivo por `provider + model`).
 */
export function resolveBenchPricing(key: BenchPricingKey): BenchPricingResolution {
  const entry = BENCH_PRICING_ENTRIES.find(
    (candidate) =>
      candidate.provider === key.provider &&
      candidate.model === key.model &&
      candidate.protocol === key.protocol &&
      candidate.quality === key.quality &&
      candidate.size === key.size,
  );

  if (!entry) {
    return { mode: "unknown", coverage: "missing", ruleVersion: BENCH_PRICING_RULE_VERSION };
  }

  return {
    mode: entry.mode,
    unitPriceUsd: entry.unitPriceUsd,
    tokenRates: entry.tokenRates,
    estimatedOutputTokens: entry.estimatedOutputTokens,
    coverage: entry.coverage,
    ruleVersion: entry.ruleVersion,
  };
}
