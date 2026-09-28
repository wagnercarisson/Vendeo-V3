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
 *
 * ## Estimativas de saída (correção do CHECKPOINT 2)
 *
 * Modelos diferentes consomem **quantidades diferentes** de tokens na mesma
 * qualidade, portanto a estimativa de tokens de saída é chaveada por
 * `model + quality + size` e **nunca** compartilhada entre modelos. Só entram
 * valores comprovados: `official_calculator` (calculador oficial) ou
 * `derived_from_published_price` (derivado de preço por peça publicado). Quando
 * um valor não está comprovado, ele fica **ausente** de propósito — não é
 * inventado nem reaproveitado de outro modelo.
 */

/** Versão da regra de pricing local (rastreada em `cost_rule_version`). */
export const BENCH_PRICING_RULE_VERSION = "2026-09-bench-1";

/** Modo de cobrança do preset. `unknown` é usado quando não há entrada de pricing. */
export type BenchPricingMode = "per_image" | "token_based" | "unknown";

/** Cobertura do pricing para o preset: `complete`, `partial` ou `missing`. */
export type BenchPricingCoverage = "complete" | "partial" | "missing";

/** Origem de uma estimativa de saída (auditoria). */
export type BenchEstimateSource = "official_calculator" | "derived_from_published_price";

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
  /** Estimativa de saída por peça (USD). Ausente quando não há valor comprovado. */
  unitPriceUsd?: number;
  tokenRates?: BenchTokenRates;
  /** Tokens de saída estimados para o preset (distingue `low` de `medium`). */
  estimatedOutputTokens?: number;
  /** Origem da estimativa de saída, quando houver. */
  estimateSource?: BenchEstimateSource;
  coverage: BenchPricingCoverage;
  ruleVersion: string;
}

/** Resultado da resolução de pricing para um preset. */
export interface BenchPricingResolution {
  mode: BenchPricingMode;
  unitPriceUsd?: number;
  tokenRates?: BenchTokenRates;
  estimatedOutputTokens?: number;
  estimateSource?: BenchEstimateSource;
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

// ─── Estimativas de saída por preset (model + quality + size) ────────────────

/**
 * Estimativa de tokens de saída, **específica de cada modelo** — nunca
 * compartilhada entre modelos.
 */
interface BenchOutputEstimate {
  estimatedOutputTokens: number;
  source: BenchEstimateSource;
}

/**
 * Estimativas comprovadas, chaveadas por `model + quality + size`.
 *
 * - `gpt-image-2`: ~US$0,006 (`low`) e ~US$0,053 (`medium`) por peça 1:1, pela
 *   referência pública; com a taxa de saída de US$15/M ⇒ ~400 e ~3533 tokens.
 * - `gpt-image-2.5-flare`: apenas o valor do **calculador oficial** — `low` com
 *   196 tokens de saída (~US$0,00588). `medium` **não** tem valor comprovado e
 *   fica **ausente de propósito** (não reaproveita os tokens do `gpt-image-2`).
 */
const ESTIMATED_OUTPUT_BY_PRESET: Readonly<Record<string, BenchOutputEstimate>> = {
  "gpt-image-2|low|1024x1024": {
    estimatedOutputTokens: 400,
    source: "derived_from_published_price",
  },
  "gpt-image-2|medium|1024x1024": {
    estimatedOutputTokens: 3533,
    source: "derived_from_published_price",
  },
  "gpt-image-2.5-flare|low|1024x1024": {
    estimatedOutputTokens: 196,
    source: "official_calculator",
  },
};

function outputEstimateKey(model: string, quality: string, size: string): string {
  return `${model}|${quality}|${size}`;
}

function estimateOutputUnitPriceUsd(rates: BenchTokenRates, outputTokens: number): number {
  return (rates.outputImageUsdPerMillion * outputTokens) / 1_000_000;
}

function tokenBasedEntry(params: {
  model: string;
  quality: string;
  size: string;
  tokenRates: BenchTokenRates;
  coverage: BenchPricingCoverage;
}): BenchPricingEntry {
  const estimate =
    ESTIMATED_OUTPUT_BY_PRESET[outputEstimateKey(params.model, params.quality, params.size)];
  return {
    provider: "openai",
    model: params.model,
    protocol: "images",
    quality: params.quality,
    size: params.size,
    mode: "token_based",
    tokenRates: params.tokenRates,
    estimatedOutputTokens: estimate?.estimatedOutputTokens,
    estimateSource: estimate?.source,
    unitPriceUsd:
      estimate === undefined
        ? undefined
        : estimateOutputUnitPriceUsd(params.tokenRates, estimate.estimatedOutputTokens),
    coverage: params.coverage,
    ruleVersion: BENCH_PRICING_RULE_VERSION,
  };
}

/**
 * Pricing local da bancada, chaveado por `provider + model + protocol + quality
 * + size`. `low` e `medium` têm entradas distintas.
 *
 * Cobertura: `gpt-image-2` é `complete`; `gpt-image-2.5-flare` é `partial`
 * (taxas publicadas preservadas; estimativa de saída só onde comprovada pelo
 * calculador oficial). Valores não comprovados ficam **ausentes**.
 */
export const BENCH_PRICING_ENTRIES: readonly BenchPricingEntry[] = [
  tokenBasedEntry({
    model: "gpt-image-2",
    quality: "low",
    size: "1024x1024",
    tokenRates: GPT_IMAGE_2_RATES,
    coverage: "complete",
  }),
  tokenBasedEntry({
    model: "gpt-image-2",
    quality: "medium",
    size: "1024x1024",
    tokenRates: GPT_IMAGE_2_RATES,
    coverage: "complete",
  }),
  tokenBasedEntry({
    model: "gpt-image-2.5-flare",
    quality: "low",
    size: "1024x1024",
    tokenRates: GPT_IMAGE_2_5_FLARE_RATES,
    coverage: "partial",
  }),
  tokenBasedEntry({
    model: "gpt-image-2.5-flare",
    quality: "medium",
    size: "1024x1024",
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
    estimateSource: entry.estimateSource,
    coverage: entry.coverage,
    ruleVersion: entry.ruleVersion,
  };
}
