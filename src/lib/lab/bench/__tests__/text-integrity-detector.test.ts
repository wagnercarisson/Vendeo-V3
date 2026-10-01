// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectBenchTextIntegrityFields,
  createBenchTextIntegrityRevision,
  detectBenchTextIntegrity,
  TEXT_INTEGRITY_POLICY_VERSION,
} from "../domain/text-integrity-detector";
import type { BenchTextIntegrityPair } from "../domain/schemas";

describe("text-integrity-detector — contrato versionado e cobertura canônica", () => {
  it("coleta somente os quatro campos livres na ordem normativa e preserva os valores", () => {
    const productWithControlledValues = {
      name: " Café  voce!! ",
      description: "descrição\noriginal",
      mandatoryArtworkText: "linha 1\nlinha 2",
      priceCents: 1299,
      originalPriceCents: 2500,
      preserveImageContext: true,
    };
    const fields = collectBenchTextIntegrityFields({
      product: productWithControlledValues,
      promptBase: "  prompt-base\tsem normalização  ",
    });

    expect(TEXT_INTEGRITY_POLICY_VERSION).toBe("48.2.5-text-integrity-v1");
    expect(fields).toEqual([
      { field: "product.name", value: " Café  voce!! " },
      { field: "product.description", value: "descrição\noriginal" },
      { field: "product.mandatoryArtworkText", value: "linha 1\nlinha 2" },
      { field: "promptBase", value: "  prompt-base\tsem normalização  " },
    ]);
    expect(fields.map(({ field }) => field)).toEqual([
      "product.name",
      "product.description",
      "product.mandatoryArtworkText",
      "promptBase",
    ]);
  });

  it("usa strings vazias estáveis para campos opcionais ausentes", () => {
    expect(
      collectBenchTextIntegrityFields({
        product: { name: "Produto" },
        promptBase: "",
      }),
    ).toEqual([
      { field: "product.name", value: "Produto" },
      { field: "product.description", value: "" },
      { field: "product.mandatoryArtworkText", value: "" },
      { field: "promptBase", value: "" },
    ]);
  });

  it("revisa exatamente os pares serializados, sem normalizar Unicode nem whitespace", () => {
    const precomposed: BenchTextIntegrityPair[] = [{ field: "promptBase", value: "café  " }];
    const decomposed: BenchTextIntegrityPair[] = [{ field: "promptBase", value: "cafe\u0301  " }];

    expect(createBenchTextIntegrityRevision(precomposed)).toBe(
      createBenchTextIntegrityRevision(precomposed),
    );
    expect(createBenchTextIntegrityRevision(precomposed)).not.toBe(
      createBenchTextIntegrityRevision(decomposed),
    );
    expect(createBenchTextIntegrityRevision(precomposed)).not.toBe(
      createBenchTextIntegrityRevision([{ field: "promptBase", value: "café" }]),
    );
  });
});

describe("text-integrity-detector — alertas conservadores, ordenados e literais", () => {
  it.each([
    {
      label: "pontuação duplicada suspeita",
      value: "Oferta!!",
      ruleId: "punctuation_repeated",
      excerpt: "!!",
    },
    {
      label: "caractere repetido suspeito",
      value: "Camisaaada",
      ruleId: "character_repeated_suspicious",
      excerpt: "aaa",
    },
    {
      label: "espaçamento repetido",
      value: "Café  especial",
      ruleId: "spacing_anomaly",
      excerpt: "  ",
    },
    {
      label: "palavra adjacente repetida com acento",
      value: "Café café",
      ruleId: "adjacent_word_repeat",
      excerpt: "Café café",
    },
    {
      label: "padrão PT-BR possivelmente sem acento",
      value: "Produto imperdivel",
      ruleId: "ptbr_imperdivel_without_accent",
      excerpt: "imperdivel",
    },
  ])("sinaliza $label sem reescrever o conteúdo", ({ value, ruleId, excerpt }) => {
    const pair: BenchTextIntegrityPair = { field: "promptBase", value };
    const before = structuredClone(pair);
    const alerts = detectBenchTextIntegrity([pair]);

    expect(alerts).toContainEqual({
      field: "promptBase",
      excerpt,
      reason: expect.any(String),
      ruleId,
    });
    expect(pair).toEqual(before);
    expect(alerts.every((alert) => alert.reason.length > 0)).toBe(true);
  });

  it("ordena primeiro pelo campo canônico e depois pela posição no texto", () => {
    const fields: BenchTextIntegrityPair[] = [
      { field: "product.name", value: "voce??" },
      { field: "promptBase", value: "nao!!" },
    ];

    const alerts = detectBenchTextIntegrity(fields);

    expect(alerts.map(({ field, ruleId }) => [field, ruleId])).toEqual([
      ["product.name", "ptbr_voce_without_accent"],
      ["product.name", "punctuation_repeated"],
      ["promptBase", "ptbr_nao_without_accent"],
      ["promptBase", "punctuation_repeated"],
    ]);
  });

  it("repete os mesmos alertas para entrada idêntica e não sugere correção lexical completa", () => {
    const fields: BenchTextIntegrityPair[] = [
      { field: "product.name", value: "MArCa QX-7" },
      { field: "product.description", value: "Termo técnico ZR-200" },
      { field: "product.mandatoryArtworkText", value: "Lote A-10" },
      { field: "promptBase", value: "Café... especial" },
    ];

    const first = detectBenchTextIntegrity(fields);
    const second = detectBenchTextIntegrity(fields);

    expect(first).toEqual(second);
    expect(first).toEqual([]);
  });

  it("sugere grafias sem acento sem bloquear marcas ou afirmar erro absoluto", () => {
    const fields: BenchTextIntegrityPair[] = [
      { field: "product.name", value: "NaoBrand voce" },
      { field: "product.description", value: "Café promocao especial" },
      { field: "product.mandatoryArtworkText", value: "Lote tecnico" },
      { field: "promptBase", value: "imperdivel" },
    ];

    const alerts = detectBenchTextIntegrity(fields);

    expect(alerts.map(({ field, ruleId }) => [field, ruleId])).toEqual([
      ["product.name", "ptbr_voce_without_accent"],
      ["product.description", "ptbr_promocao_without_accent"],
      ["promptBase", "ptbr_imperdivel_without_accent"],
    ]);
    expect(alerts.every(({ reason }) => /pode|confira/i.test(reason))).toBe(true);
  });

  it("limita excerpts longos sem corromper acentos ou substituir os valores", () => {
    const value = "!".repeat(120);
    const alerts = detectBenchTextIntegrity([{ field: "product.description", value }]);

    expect(alerts[0].excerpt.length).toBe(80);
    expect(alerts[0].excerpt).toBe("!".repeat(79) + "…");
    expect(value).toBe("!".repeat(120));
  });
});

describe("text-integrity-detector — limitações e isolamento", () => {
  it("não contém rede, provider, ambiente ou acesso a Supabase", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/text-integrity-detector.ts"),
      "utf8",
    );

    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("OpenAI");
    expect(source).not.toContain("dictionary");
  });
});
