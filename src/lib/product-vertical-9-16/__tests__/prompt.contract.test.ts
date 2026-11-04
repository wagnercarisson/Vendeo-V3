// @vitest-environment node
import { describe, expect, it } from "vitest";

import baselineJson from "@/lib/product-1-1/__tests__/fixtures/prompt-composition.baseline.json";
import {
  COMPOSER_VERSION,
  PROMPT_BLOCK_LABELS,
  PROMPT_BLOCK_ORDER,
  composeProductPrompt,
} from "@/lib/product-1-1/prompt-composition";
import {
  PRODUCT_1_1_PROMPT_POLICY_REGISTRY,
  resolveProductOneToOnePromptPolicies,
} from "@/lib/product-1-1/policies/registry";
import type {
  ProductPromptCompositionBriefing,
  ProductPromptPolicyResolutionInput,
  ResolvedProductPromptPolicies,
} from "@/lib/product-1-1/policies/types";
import { formato11Policy } from "@/lib/product-1-1/policies/formato-1-1";
import { SAFE_AREA_9_16_VERSION } from "../safe-area";
import { composeVerticalProductPrompt } from "../prompt/composition";
import {
  FORMATO_9_16_POLICY_VERSION,
  VERTICAL_COMPOSER_VERSION,
  resolveVerticalPromptPolicies,
} from "../prompt/registry";
import { formato916Policy } from "../prompt/policy-formato-9-16";

interface FrozenCase {
  readonly briefing: ProductPromptCompositionBriefing;
  readonly expected: {
    readonly text: string;
    readonly blocks: Readonly<Record<string, string>>;
    readonly policyVersions: Readonly<Record<string, string>>;
  };
}

interface FrozenBaseline {
  readonly promptBase: string;
  readonly references: readonly string[];
  readonly cases: readonly FrozenCase[];
}

const baseline = baselineJson as unknown as FrozenBaseline;
const fixture = baseline.cases[0];

function defaultInput() {
  return {
    briefing: fixture.briefing,
    promptBase: baseline.promptBase,
    references: baseline.references,
  };
}

describe("F59 — seam aditivo do compositor (default 1:1 byte-idêntico)", () => {
  it("sem opções é deep-equal a opções vazias e ao baseline 1:1", () => {
    const withoutOptions = composeProductPrompt(defaultInput());
    const withEmptyOptions = composeProductPrompt(defaultInput(), {});

    expect(withEmptyOptions).toEqual(withoutOptions);
    expect(withEmptyOptions.text).toBe(withoutOptions.text);
    expect(withoutOptions.text).toBe(fixture.expected.text);
    expect(withoutOptions.blocks).toEqual(fixture.expected.blocks);
    expect(withoutOptions.policyVersions).toEqual(
      fixture.expected.policyVersions,
    );
  });

  it("mantém COMPOSER_VERSION e o tipo alargado aceita versão própria", () => {
    const standard = composeProductPrompt(defaultInput());
    expect(standard.composerVersion).toBe(COMPOSER_VERSION);
    expect(COMPOSER_VERSION).toBe("48.2.4-prompt-composer-v7");

    const custom = composeProductPrompt(defaultInput(), {
      composerVersion: "f59-vertical-9-16-composer-v1",
    });
    expect(custom.composerVersion).toBe("f59-vertical-9-16-composer-v1");
    expect(custom.text).toBe(standard.text);
  });

  it("preserva os 7 rótulos e a ordem dos blocos", () => {
    expect(Object.keys(PROMPT_BLOCK_LABELS)).toHaveLength(7);
    const composition = composeProductPrompt(defaultInput());
    const present = PROMPT_BLOCK_ORDER.filter(
      (label) => composition.blocks[label] !== undefined,
    );
    expect(Object.keys(composition.blocks)).toEqual(present);
  });

  it("usa o resolver injetado e espelha suas versões sem mutar o default", () => {
    const input = defaultInput();
    const resolver = (
      resolutionInput: ProductPromptPolicyResolutionInput,
    ): ResolvedProductPromptPolicies => {
      const base = resolveProductOneToOnePromptPolicies(resolutionInput);
      return {
        contributions: [
          ...base.contributions,
          {
            block: PROMPT_BLOCK_LABELS.intent,
            lines: ["EXTRA DO RESOLVEDOR"],
          },
        ],
        versions: { ...base.versions, custom: "custom-v1" },
      };
    };

    const standard = composeProductPrompt(input);
    const custom = composeProductPrompt(input, {
      resolver,
      composerVersion: "custom-composer",
    });

    expect(custom.blocks[PROMPT_BLOCK_LABELS.intent]).toBe(
      `${standard.blocks[PROMPT_BLOCK_LABELS.intent]}\nEXTRA DO RESOLVEDOR`,
    );
    for (const label of PROMPT_BLOCK_ORDER) {
      if (label === PROMPT_BLOCK_LABELS.intent) continue;
      expect(custom.blocks[label]).toBe(standard.blocks[label]);
    }
    expect(custom.policyVersions.custom).toBe("custom-v1");

    const after = composeProductPrompt(input);
    expect(after).toEqual(standard);
  });
});

describe("F59 — política de formato 9:16, resolvedor e compositor vertical", () => {
  it("define a política vertical versionada com uma única contribuição no bloco de intenção", () => {
    expect(FORMATO_9_16_POLICY_VERSION).toBe("f59-9-16-v1");
    expect(formato916Policy.id).toBe("policy.formato.9-16");
    expect(formato916Policy.dimension).toBe("formato");
    expect(formato916Policy.value).toBe("9:16");
    const contributions = formato916Policy.contributions(defaultInput());
    expect(contributions).toHaveLength(1);
    expect(contributions[0].block).toBe(PROMPT_BLOCK_LABELS.intent);
    const joined = contributions[0].lines.join(" ");
    expect(joined).toContain("9:16");
    expect(joined).toMatch(/14%/);
    expect(joined).toMatch(/35%/);
    expect(joined).toMatch(/6%/);
    expect(joined).toMatch(/30%/);
    expect(joined).toContain("referência de entrega 1080 × 1920");
    for (const line of contributions[0].lines) {
      if (line.includes("px")) {
        expect(line).toContain("referência de entrega 1080 × 1920");
      }
    }
  });

  it("resolve as 9 versões esperadas sem mutar o registry 1:1", () => {
    const registryBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY;
    const formatoBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato;
    const intencaoBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY.intencao;
    const resolved = resolveVerticalPromptPolicies({
      briefing: fixture.briefing,
      references: baseline.references,
    });

    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY).toBe(registryBefore);
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato).toBe(formatoBefore);
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.intencao).toBe(intencaoBefore);
    expect(resolved.versions).toEqual({
      intencao: "48.2.6-oferta-v2",
      formato: "f59-9-16-v1",
      tipoConteudo: "48.2.6-produto-v4",
      estrutura: "48.2.4-peca-unica-v1",
      tema: "48.2.4-tema-nenhum-v1",
      geral: "48.2.5-general-integrity-v1",
      fundo: "48.2.6-background-direction-v2",
      identidade: "48.2.6-identity-context-v1",
      safeArea: SAFE_AREA_9_16_VERSION,
    });
    expect(Object.keys(resolved.versions)).toHaveLength(9);
    expect(resolved.versions.formato).not.toBe("48.2.4-formato-1-1-v1");
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato?.["1:1"]).toBe(
      formato11Policy,
    );
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato?.["9:16"]).toBeUndefined();
  });

  it("compõe o prompt vertical com versão própria e base 1:1 reaproveitada", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    const standard = composeProductPrompt(defaultInput());

    expect(VERTICAL_COMPOSER_VERSION).toBe("f59-vertical-9-16-composer-v1");
    expect(composition.composerVersion).toBe(VERTICAL_COMPOSER_VERSION);
    expect(composition.promptBaseVersion).toBe(standard.promptBaseVersion);
    expect(composition.text).toContain("9:16");
    expect(composition.text).toMatch(/14%/);
    expect(composition.text).toMatch(/35%/);
    expect(composition.text).toMatch(/6%/);
    expect(composition.text).toMatch(/30%/);
    expect(composition.text).toContain("referência de entrega 1080 × 1920");
    expect(composition.text).toMatch(/letterbox/);
    expect(composition.text).toMatch(/guias/);
  });

  it("mantém 7 blocos na ordem e nunca cita pixel sem o rótulo de entrega", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    const present = PROMPT_BLOCK_ORDER.filter(
      (label) => composition.blocks[label] !== undefined,
    );
    expect(Object.keys(composition.blocks)).toEqual(present);
    expect(Object.keys(composition.blocks).length).toBeLessThanOrEqual(7);

    for (const content of Object.values(composition.blocks)) {
      for (const line of content.split("\n")) {
        if (/(269|672|65|324 × 768) px/.test(line)) {
          expect(line).toContain("referência de entrega 1080 × 1920");
        }
      }
    }
  });

  it("a versão custom não altera os blocos 1:1 de identidade/produto/comercial", () => {
    const vertical = composeVerticalProductPrompt(defaultInput());
    const standard = composeProductPrompt(defaultInput());
    for (const label of [
      PROMPT_BLOCK_LABELS.identity,
      PROMPT_BLOCK_LABELS.product,
      PROMPT_BLOCK_LABELS.commercial,
    ]) {
      expect(vertical.blocks[label]).toBe(standard.blocks[label]);
    }
  });
});
