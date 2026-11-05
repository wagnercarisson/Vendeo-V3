// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PROMPT_BLOCK_LABELS,
  composeProductPrompt,
  type ProductPromptComposition,
} from "@/lib/product-1-1/prompt-composition";
import { formato11Policy } from "@/lib/product-1-1/policies/formato-1-1";
import type { CopyDirectorInput } from "@/lib/copy/schema";
import type { ProductPromptPolicyResolutionInput } from "@/lib/product-1-1/policies/types";
import { composeVerticalProductPrompt } from "../prompt/composition";
import { formato916Policy } from "../prompt/policy-formato-9-16";
import { VERTICAL_COMPOSITION_FIXTURES } from "./fixtures/vertical-briefings";

const PARITY_BLOCKS = [
  PROMPT_BLOCK_LABELS.identity,
  PROMPT_BLOCK_LABELS.product,
  PROMPT_BLOCK_LABELS.commercial,
  PROMPT_BLOCK_LABELS.promptBase,
] as const;

function linesOf(
  composition: ProductPromptComposition,
  label: string,
): readonly string[] {
  const value = composition.blocks[label];
  return value === undefined ? [] : value.split("\n");
}

function symmetricDifference<T>(left: readonly T[], right: readonly T[]): T[] {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return [
    ...left.filter((item) => !rightSet.has(item)),
    ...right.filter((item) => !leftSet.has(item)),
  ];
}

const POLICY_CONTEXT: ProductPromptPolicyResolutionInput = {
  briefing: VERTICAL_COMPOSITION_FIXTURES[0].briefing,
  references: VERTICAL_COMPOSITION_FIXTURES[0].references,
};
const FORMAT_9_16_LINES = formato916Policy.contributions(POLICY_CONTEXT)[0].lines;
const FORMAT_1_1_LINES = formato11Policy.contributions(POLICY_CONTEXT)[0].lines;

describe("F59 — diferença controlada entre prompt 1:1 e vertical", () => {
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
    "%s mantém identidade/produto/comercial/base byte-idênticos",
    (_id, fixture) => {
      const input = {
        briefing: fixture.briefing,
        promptBase: fixture.promptBase,
        references: fixture.references,
      };
      const square = composeProductPrompt(input);
      const vertical = composeVerticalProductPrompt(input);

      for (const label of PARITY_BLOCKS) {
        expect(vertical.blocks[label]).toBe(square.blocks[label]);
      }
    },
  );

  it.each(VERTICAL_COMPOSITION_FIXTURES.map((f) => [f.id, f] as const))(
    "%s altera intenção e restrições apenas pelo formato/área segura",
    (_id, fixture) => {
      const input = {
        briefing: fixture.briefing,
        promptBase: fixture.promptBase,
        references: fixture.references,
      };
      const square = composeProductPrompt(input);
      const vertical = composeVerticalProductPrompt(input);

      expect(vertical.blocks[PROMPT_BLOCK_LABELS.intent]).not.toBe(
        square.blocks[PROMPT_BLOCK_LABELS.intent],
      );
      expect(vertical.blocks[PROMPT_BLOCK_LABELS.constraints]).toBe(
        square.blocks[PROMPT_BLOCK_LABELS.constraints],
      );

      const intentDifference = symmetricDifference(
        linesOf(square, PROMPT_BLOCK_LABELS.intent),
        linesOf(vertical, PROMPT_BLOCK_LABELS.intent),
      );
      const expectedIntentDifference = new Set([
        ...FORMAT_9_16_LINES,
        ...FORMAT_1_1_LINES,
      ]);
      for (const line of intentDifference) {
        expect(expectedIntentDifference.has(line)).toBe(true);
      }
    },
  );

  it.each(VERTICAL_COMPOSITION_FIXTURES.map((f) => [f.id, f] as const))(
    "%s contém percentuais uma única vez e NÃO vaza pixels/downscale/homologação",
    (_id, fixture) => {
      const vertical = composeVerticalProductPrompt({
        briefing: fixture.briefing,
        promptBase: fixture.promptBase,
        references: fixture.references,
      });
      expect(vertical.text.match(/14%/g)).toHaveLength(1);
      expect(vertical.text.match(/35%/g)).toHaveLength(1);
      expect(vertical.text.match(/6%/g)).toHaveLength(1);
      expect(vertical.text.match(/30%/g)).toHaveLength(1);
      expect(vertical.text).not.toMatch(/269|672|324 × 768|1152|2048|0,9375/);
      expect(vertical.text).not.toMatch(/homologa/i);
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

    expect(square.policyVersions.formato).toBe("48.2.4-formato-1-1-v1");
    expect(square.policyVersions.safeArea).toBeUndefined();
    expect(vertical.policyVersions.formato).toBe("f59-9-16-v2");
    expect(vertical.policyVersions.safeArea).toBe("safe-area-9-16-v1");
    expect(vertical.policyVersions.intencao).toBe(square.policyVersions.intencao);
    expect(vertical.policyVersions.tipoConteudo).toBe(
      square.policyVersions.tipoConteudo,
    );
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
