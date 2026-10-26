/**
 * Inventário FECHADO dos modelos OpenAI cujas tarifas o Vendeo consome.
 *
 * Não é uma lista de todos os modelos publicados pela OpenAI: só entram os
 * modelos efetivamente usados pelos resolvedores/catálogo/configurações atuais.
 * Novos modelos exigem decisão explícita e entrada neste inventário.
 */

export type OpenAiPricingKind = "text" | "image";

export interface OpenAiPricingInventoryEntry {
  model: string;
  label: string;
  kind: OpenAiPricingKind;
  /** Qualidades persistidas para esta linha (null = linha legada sem qualidade). */
  qualities: readonly (string | null)[];
}

export const OPENAI_PRICING_PROVIDER = "openai" as const;
export const OPENAI_PRICING_SOURCE_URL =
  "https://developers.openai.com/api/docs/pricing.md" as const;
export const OPENAI_PRICING_HUMAN_URL =
  "https://developers.openai.com/api/docs/pricing" as const;

export const OPENAI_PRICING_QUALITY_ORDER: readonly (string | null)[] = [
  null,
  "low",
  "medium",
];

export const OPENAI_PRICING_INVENTORY: readonly OpenAiPricingInventoryEntry[] =
  Object.freeze([
    Object.freeze({
      model: "gpt-4o",
      label: "GPT-4o",
      kind: "text",
      qualities: [null],
    }),
    Object.freeze({
      model: "gpt-4o-mini",
      label: "GPT-4o mini",
      kind: "text",
      qualities: [null],
    }),
    Object.freeze({
      model: "gpt-5.5",
      label: "GPT-5.5",
      kind: "text",
      qualities: [null],
    }),
    Object.freeze({
      model: "gpt-6-luna",
      label: "GPT-6 Luna",
      kind: "text",
      qualities: [null],
    }),
    Object.freeze({
      model: "gpt-image-2",
      label: "GPT Image 2",
      kind: "image",
      qualities: [null, "low", "medium"],
    }),
    Object.freeze({
      model: "gpt-image-2.5-flare",
      label: "GPT Image 2.5 Flare",
      kind: "image",
      qualities: ["low", "medium"],
    }),
    Object.freeze({
      model: "gpt-image-2.5-sunburst",
      label: "GPT Image 2.5 Sunburst",
      kind: "image",
      qualities: ["low", "medium"],
    }),
  ]);

export const OPENAI_PRICING_MODELS: readonly string[] = Object.freeze(
  OPENAI_PRICING_INVENTORY.map((entry) => entry.model),
);

export function getOpenAiPricingInventoryEntry(
  model: string,
): OpenAiPricingInventoryEntry | null {
  return OPENAI_PRICING_INVENTORY.find((entry) => entry.model === model) ?? null;
}

export function getOpenAiPricingLabel(model: string): string {
  return getOpenAiPricingInventoryEntry(model)?.label ?? model;
}

/** Ordena qualidades na ordem canônica (null, low, medium). */
export function sortOpenAiPricingQualities(
  qualities: ReadonlyArray<string | null>,
): Array<string | null> {
  return [...qualities].sort(
    (a, b) =>
      OPENAI_PRICING_QUALITY_ORDER.indexOf(a) -
      OPENAI_PRICING_QUALITY_ORDER.indexOf(b),
  );
}

/** Quantidade de linhas de pricing esperadas no inventário (modelo+qualidade). */
export function countOpenAiPricingRows(): number {
  return OPENAI_PRICING_INVENTORY.reduce(
    (total, entry) => total + entry.qualities.length,
    0,
  );
}
