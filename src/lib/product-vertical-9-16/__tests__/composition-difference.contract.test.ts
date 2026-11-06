// @vitest-environment node
import { describe, expect, it } from "vitest";

import { composeProductPrompt } from "@/lib/product-1-1/prompt-composition";
import { formato11Policy } from "@/lib/product-1-1/policies/formato-1-1";
import type { CopyDirectorInput } from "@/lib/copy/schema";
import { composeVerticalProductPrompt } from "../prompt/composition";
import { VERTICAL_COMPOSITION_FIXTURES } from "./fixtures/vertical-briefings";

describe("F59 — composição editorial vertical vs. contrato 1:1", () => {
  it("tem exatamente 9 briefings cobrindo 3 intenções × 3 fundos", () => {
    expect(VERTICAL_COMPOSITION_FIXTURES).toHaveLength(9);
    expect(new Set(VERTICAL_COMPOSITION_FIXTURES.map((f) => f.intent))).toEqual(
      new Set(["offer", "spotlight", "exclusive"]),
    );
    expect(
      new Set(VERTICAL_COMPOSITION_FIXTURES.map((f) => f.backgroundDirection)),
    ).toEqual(new Set(["studio", "ambient", "original"]));
    for (const fixture of VERTICAL_COMPOSITION_FIXTURES) {
      if (fixture.backgroundDirection === "original") {
        expect(fixture.references).toHaveLength(1);
      }
    }
  });

  it.each(VERTICAL_COMPOSITION_FIXTURES.map((f) => [f.id, f] as const))(
    "%s não herda os blocos do 1:1 e mantém o formato fora do prompt-base",
    (_id, fixture) => {
      const input = {
        briefing: fixture.briefing,
        promptBase: fixture.promptBase,
        references: fixture.references,
      };
      const square = composeProductPrompt(input);
      const vertical = composeVerticalProductPrompt({
        ...input,
        attachments: [{ kind: "product" }, { kind: "identity" }],
      });

      expect(Object.keys(square.blocks)).toContain("INTENÇÃO E FORMATO");
      expect(square.composerVersion).toBe("48.2.4-prompt-composer-v7");
      expect(vertical.text).not.toContain("[IDENTIDADE E DIREÇÃO VISUAL]");
      expect(vertical.text).not.toContain("[PRODUTO E IMAGENS DE REFERÊNCIA]");
      expect(vertical.text).not.toContain("[CONDIÇÕES COMERCIAIS]");
      expect(vertical.text).not.toContain("[INTENÇÃO E FORMATO]");
      expect(vertical.text).not.toContain("[INSTRUÇÕES DO PROMPT-BASE]");
      expect(vertical.text).not.toContain(
        "[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]",
      );
      expect(vertical.text).toContain("[REFERÊNCIAS]");
      expect(vertical.text).toContain("[DADOS DA CAMPANHA]");
      expect(vertical.text).toContain("[COMPOSIÇÃO]");
      expect(vertical.text).toContain("[ÁREA DE COMPOSIÇÃO]");
    },
  );

  it.each(VERTICAL_COMPOSITION_FIXTURES.map((f) => [f.id, f] as const))(
    "%s emite o bloco compacto sem coordenadas em pixels",
    (_id, fixture) => {
      const vertical = composeVerticalProductPrompt({
        briefing: fixture.briefing,
        promptBase: fixture.promptBase,
        references: fixture.references,
      });
      const block = vertical.blocks["ÁREA DE COMPOSIÇÃO"];
      expect(block).toContain(
        "Crie uma composição publicitária compacta na região central superior da imagem.",
      );
      expect(block).toContain(
        "Reserve os 14% superiores, os 35% inferiores e 6% de cada lateral",
      );
      expect(block).toContain(
        "últimos 30% da largura e 40% da altura",
      );
      expect(block).not.toMatch(/px|1152×2048|1080×1920|x=|y=|0,9375/);
      expect(
        vertical.text.match(/Crie uma composição publicitária compacta/g),
      ).toHaveLength(1);
      expect(vertical.text).not.toMatch(/1152×2048|1080×1920|0,9375|homologa/i);
    },
  );

  it.each(VERTICAL_COMPOSITION_FIXTURES.map((f) => [f.id, f] as const))(
    "%s numera as referências conforme a ordem real dos anexos",
    (_id, fixture) => {
      const vertical = composeVerticalProductPrompt({
        briefing: fixture.briefing,
        promptBase: fixture.promptBase,
        references: fixture.references,
        attachments: [
          { kind: "product" },
          { kind: "reference" },
          { kind: "identity" },
        ],
      });
      expect(vertical.text).toContain("Imagem 1: produto anunciado.");
      expect(vertical.text).toContain(
        "Imagem 2: referência adicional do produto.",
      );
      expect(vertical.text).toContain("Imagem 3: ativo da loja.");
      expect(vertical.text).not.toMatch(/Imagem 4:/);
    },
  );

  it("registra versões verticais sem contaminar as versões 1:1", () => {
    const fixture = VERTICAL_COMPOSITION_FIXTURES[0];
    const input = {
      briefing: fixture.briefing,
      promptBase: fixture.promptBase,
      references: fixture.references,
    };
    const square = composeProductPrompt(input);
    const vertical = composeVerticalProductPrompt(input);

    expect(square.policyVersions.formato).toBe(formato11Policy.version);
    expect(square.policyVersions.safeArea).toBeUndefined();
    expect(vertical.policyVersions.formato).toBe("f59-9-16-v6");
    expect(vertical.policyVersions.safeArea).toBe("safe-area-9-16-v1");
    expect(vertical.policyVersions.intencao).toBe(square.policyVersions.intencao);
    expect(vertical.policyVersions.tipoConteudo).toBe(
      square.policyVersions.tipoConteudo,
    );
    expect(vertical.composerVersion).not.toBe(square.composerVersion);
  });

  it("usa o mesmo contrato de Copy Director, sem novo input por formato", () => {
    const input: CopyDirectorInput = {
      productName: "Produto fixture",
      description: "Descrição",
      commercialFrame: "Oferta",
      campaignIntent: "offer",
      storeName: "Loja fixture",
      segment: "Varejo",
    };
    expect(input.campaignIntent).toBe("offer");
    expect(Object.keys(input)).not.toContain("campaignFormat");
  });
});
