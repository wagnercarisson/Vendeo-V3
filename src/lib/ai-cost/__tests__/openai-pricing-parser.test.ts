import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OpenAiPricingParseError,
  parseOpenAiStandardPricing,
} from "../openai-pricing-parser";
import {
  OPENAI_PRICING_INVENTORY,
  type OpenAiPricingInventoryEntry,
} from "../openai-pricing-inventory";

const FIXTURE = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/ai-cost/__tests__/fixtures/openai-pricing-standard.md",
  ),
  "utf8",
);

const TEXT_ONLY: readonly OpenAiPricingInventoryEntry[] = [
  { model: "gpt-4o", label: "GPT-4o", kind: "text", qualities: [null] },
];

function parseFixture(
  inventory: readonly OpenAiPricingInventoryEntry[] = OPENAI_PRICING_INVENTORY,
) {
  return parseOpenAiStandardPricing(FIXTURE, inventory);
}

describe("parseOpenAiStandardPricing — tabela Standard", () => {
  it("extrai os quatro modelos textuais do inventário", () => {
    const parsed = parseFixture(TEXT_ONLY);

    expect(parsed).toEqual([
      {
        model: "gpt-4o",
        kind: "text",
        inputTextUsdPer1M: 2.5,
        cachedInputTextUsdPer1M: 1.25,
        outputTextUsdPer1M: 10,
        inputImageUsdPer1M: null,
        cachedInputImageUsdPer1M: null,
        outputImageUsdPer1M: null,
      },
    ]);
  });

  it("usa Standard, nunca Batch/Flex/Fast", () => {
    const parsed = parseFixture();
    const byModel = new Map(parsed.map((row) => [row.model, row]));

    expect(byModel.get("gpt-5.5")).toMatchObject({
      inputTextUsdPer1M: 5,
      cachedInputTextUsdPer1M: 0.5,
      outputTextUsdPer1M: 30,
    });
    expect(byModel.get("gpt-6-luna")).toMatchObject({
      inputTextUsdPer1M: 0.1,
      cachedInputTextUsdPer1M: 0.01,
      outputTextUsdPer1M: 0.5,
    });
    expect(byModel.get("gpt-4o")).toMatchObject({
      inputTextUsdPer1M: 2.5,
      cachedInputTextUsdPer1M: 1.25,
      outputTextUsdPer1M: 10,
    });
    expect(byModel.get("gpt-4o-mini")).toMatchObject({
      inputTextUsdPer1M: 0.15,
      cachedInputTextUsdPer1M: 0.075,
      outputTextUsdPer1M: 0.6,
    });
  });

  it("distingue entrada textual (5) de entrada de imagem (8) e saída de imagem (30)", () => {
    const parsed = parseFixture();
    const image = parsed.find((row) => row.model === "gpt-image-2.5-flare");

    expect(image).toMatchObject({
      kind: "image",
      inputTextUsdPer1M: 5,
      cachedInputTextUsdPer1M: 1.25,
      outputTextUsdPer1M: null,
      inputImageUsdPer1M: 8,
      cachedInputImageUsdPer1M: 2,
      outputImageUsdPer1M: 30,
    });
  });

  it("modelo ausente do inventário → erro (nunca estimativa de outro modelo)", () => {
    const markdown = FIXTURE.replace(
      "| gpt-4o | $2.50 | $10.00 | $1.25 |",
      "| outro-modelo | $2.50 | $10.00 | $1.25 |",
    );

    expect(() => parseOpenAiStandardPricing(markdown, TEXT_ONLY)).toThrowError(
      expect.objectContaining({ code: "missing_model" }),
    );
  });

  it("modelo/dimensão duplicado no Standard → erro de ambiguidade", () => {
    const markdown = FIXTURE.replace(
      "| gpt-4o | $2.50 | $10.00 | $1.25 |",
      "| gpt-4o | $2.50 | $10.00 | $1.25 |\n| gpt-4o | $2.50 | $10.00 | $1.25 |",
    );

    expect(() => parseOpenAiStandardPricing(markdown, TEXT_ONLY)).toThrowError(
      expect.objectContaining({ code: "duplicate_model_dimension" }),
    );
  });

  it("modalidade inesperada para modelo do inventário → erro", () => {
    const markdown = FIXTURE.replace(
      "| gpt-image-2 | Text | $5.00 | - | $1.25 |",
      "| gpt-image-2 | Audio | $5.00 | - | $1.25 |",
    );

    expect(() => parseOpenAiStandardPricing(markdown, OPENAI_PRICING_INVENTORY)).toThrowError(
      expect.objectContaining({ code: "unknown_modality" }),
    );
  });

  it("zero explícito é válido; ausência ('-') não vira zero", () => {
    const zeroMarkdown = FIXTURE.replace(
      "| gpt-4o | $2.50 | $10.00 | $1.25 |",
      "| gpt-4o | $2.50 | $10.00 | $0.00 |",
    );
    const zero = parseOpenAiStandardPricing(zeroMarkdown, TEXT_ONLY)[0];
    expect(zero.cachedInputTextUsdPer1M).toBe(0);

    const absentMarkdown = FIXTURE.replace(
      "| gpt-4o | $2.50 | $10.00 | $1.25 |",
      "| gpt-4o | $2.50 | $10.00 | - |",
    );
    const absent = parseOpenAiStandardPricing(absentMarkdown, TEXT_ONLY)[0];
    expect(absent.cachedInputTextUsdPer1M).toBeNull();
  });

  it("dimensão obrigatória ausente ('-') → erro, não zero", () => {
    const markdown = FIXTURE.replace(
      "| gpt-4o | $2.50 | $10.00 | $1.25 |",
      "| gpt-4o | $2.50 | - | $1.25 |",
    );

    expect(() => parseOpenAiStandardPricing(markdown, TEXT_ONLY)).toThrowError(
      expect.objectContaining({ code: "missing_dimension" }),
    );
  });

  it("preço inválido → erro de parsing (não zero nem fallback)", () => {
    const markdown = FIXTURE.replace(
      "| gpt-4o | $2.50 | $10.00 | $1.25 |",
      "| gpt-4o | $abc | $10.00 | $1.25 |",
    );

    expect(() => parseOpenAiStandardPricing(markdown, TEXT_ONLY)).toThrowError(
      expect.objectContaining({ code: "invalid_price" }),
    );
  });

  it("erro de parsing carrega apenas código seguro", () => {
    try {
      parseOpenAiStandardPricing("# Pricing\nsem tabela", TEXT_ONLY);
      throw new Error("deveria falhar");
    } catch (err) {
      expect(err).toBeInstanceOf(OpenAiPricingParseError);
      expect((err as OpenAiPricingParseError).code).toBe("missing_model");
      expect(String((err as Error).message)).not.toContain("<html");
    }
  });
});
