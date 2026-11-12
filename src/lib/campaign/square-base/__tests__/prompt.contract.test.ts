// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  PROMPT_BLOCK_LABELS,
  composeProductPrompt,
} from "@/lib/product-1-1/prompt-composition";
import { PRODUCT_1_1_PROMPT_BASE } from "@/lib/product-1-1/prompt-base";

import {
  buildSquareBasePromptInput,
  composeSquareBasePrompt,
  type SquareBasePromptContent,
} from "../prompt";
import type { SquareBaseInput } from "../types";

const PRODUCT_IMAGE_0 = "data:image/png;base64,AAAA";
const PRODUCT_IMAGE_1 = "data:image/png;base64,BBBB";
const IDENTITY_IMAGE = "data:image/png;base64,CCCC";

const DIRECTIVE = "Aplique o logo no canto superior direito.";

const HASH_0 = "a".repeat(64);
const HASH_1 = "b".repeat(64);
const HASH_IDENTITY = "c".repeat(64);

const BRIEFING: SquareBasePromptContent["briefing"] = {
  backgroundDirection: "studio",
  product: { name: "Cafeteira Italiana", description: "Aço inox" },
  commercial: {
    intent: "offer",
    originalPriceText: "R$ 299,00",
    discountedPriceText: "R$ 199,00",
    badge: "Oferta",
    validity: "até domingo",
  },
  constraints: { mandatoryArtworkText: "Frete grátis" },
};

const SELECTIONS = [
  { kind: "product" as const, id: HASH_0, index: 0 },
  { kind: "reference" as const, id: HASH_1, index: 1 },
  { kind: "identity" as const, id: HASH_IDENTITY, index: 2 },
];

const CONTENT: SquareBasePromptContent = {
  briefing: BRIEFING,
  identityDirective: DIRECTIVE,
  referenceSelections: SELECTIONS,
};

/** Composição 1:1 equivalente: mesmo input, montado como o orquestrador 1:1. */
function composeOneToOne(): ReturnType<typeof composeProductPrompt> {
  return composeProductPrompt({
    briefing: BRIEFING,
    promptBase: PRODUCT_1_1_PROMPT_BASE.content,
    references: SELECTIONS.filter((selection) => selection.kind !== "identity").map(
      (selection) => selection.id,
    ),
    contributions: [{ block: PROMPT_BLOCK_LABELS.identity, lines: [DIRECTIVE] }],
    attachments: [
      { kind: "product" },
      { kind: "reference" },
      { kind: "identity" },
    ],
  });
}

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.4 prompt — equivalência byte a byte com o 1:1", () => {
  it("texto, blocos e versões são idênticos à composição 1:1 equivalente", () => {
    const expected = composeOneToOne();
    const actual = composeSquareBasePrompt(CONTENT);

    expect(actual.text).toBe(expected.text);
    expect(actual.blocks).toEqual(expected.blocks);
    expect(actual.composerVersion).toBe(expected.composerVersion);
    expect(actual.promptBaseVersion).toBe(expected.promptBaseVersion);
    expect(actual.policyVersions).toEqual(expected.policyVersions);
    expect(actual.promptBaseVersion).toBe(PRODUCT_1_1_PROMPT_BASE.version);
  });

  it("é determinístico: duas composições do mesmo conteúdo são byte-idênticas", () => {
    expect(composeSquareBasePrompt(CONTENT).text).toBe(
      composeSquareBasePrompt(CONTENT).text,
    );
  });
});

describe("F60.4 prompt — referências, identidade e anexos", () => {
  it("anexos saem na ordem produto → referências → identidade", () => {
    const input = buildSquareBasePromptInput(CONTENT);
    expect(input.attachments).toEqual([
      { kind: "product" },
      { kind: "reference" },
      { kind: "identity" },
    ]);
  });

  it("referências excluem a identidade", () => {
    const input = buildSquareBasePromptInput(CONTENT);
    expect(input.references).toEqual([HASH_0, HASH_1]);
    expect(input.references).not.toContain(HASH_IDENTITY);
  });

  it("sem referenceSelections, as referências vêm de frozen.references (fallback legado)", () => {
    const content: SquareBasePromptContent = {
      briefing: BRIEFING,
      identityDirective: null,
      referenceSelections: [],
      references: ["ref-a", "ref-b"],
    };

    const input = buildSquareBasePromptInput(content);
    expect(input.references).toEqual(["ref-a", "ref-b"]);
    expect(input.attachments).toEqual([{ kind: "product" }, { kind: "reference" }]);
    expect(input.contributions).toEqual([]);
    expect(composeSquareBasePrompt(content).text).toContain(
      "Imagens de referência: 2",
    );
  });

  it("sem directive de identidade não adiciona bloco de identidade", () => {
    const composition = composeSquareBasePrompt({
      briefing: BRIEFING,
      identityDirective: null,
      referenceSelections: [{ kind: "product", id: HASH_0, index: 0 }],
    });

    expect(composition.blocks[PROMPT_BLOCK_LABELS.identity]).toBeUndefined();
    expect(composeOneToOne().blocks[PROMPT_BLOCK_LABELS.identity]).toBe(DIRECTIVE);
  });

  it("a contagem de imagens de referência reflete apenas as não-identidade", () => {
    const composition = composeSquareBasePrompt({
      briefing: BRIEFING,
      identityDirective: null,
      referenceSelections: [
        { kind: "product", id: HASH_0, index: 0 },
        { kind: "identity", id: HASH_IDENTITY, index: 1 },
      ],
    });

    expect(composition.text).toContain("Imagens de referência: 1");
  });
});

describe("F60.4 prompt — base de prompt só em dependência de teste", () => {
  it("SquareBaseInput não declara promptBase", () => {
    type HasPromptBase = "promptBase" extends keyof SquareBaseInput ? true : false;
    expectTypeOf<HasPromptBase>().toEqualTypeOf<false>();

    // @ts-expect-error — `promptBase` não é campo do contrato público
    const forbidden: SquareBaseInput["promptBase"] = "base-do-chamador";
    void forbidden;
  });

  it("sem injeção a base é PRODUCT_1_1_PROMPT_BASE.content", () => {
    expect(buildSquareBasePromptInput(CONTENT).promptBase).toBe(
      PRODUCT_1_1_PROMPT_BASE.content,
    );
  });

  it("deps.promptBase substitui a base apenas quando injetado", () => {
    const custom = composeSquareBasePrompt(CONTENT, {
      promptBase: "BASE CUSTOMIZADA DE TESTE",
    });

    expect(custom.text).toContain("BASE CUSTOMIZADA DE TESTE");
    expect(custom.text).not.toContain(PRODUCT_1_1_PROMPT_BASE.content);
    expect(composeSquareBasePrompt(CONTENT).text).toContain(
      PRODUCT_1_1_PROMPT_BASE.content,
    );
    // A versão da base continua sendo a do contrato (nenhuma versão nova).
    expect(custom.promptBaseVersion).toBe(PRODUCT_1_1_PROMPT_BASE.version);
  });
});

describe("F60.4 prompt — fronteira de módulo", () => {
  it("prompt.ts é módulo puro (sem server-only/sharp/Supabase/crypto/fs)", () => {
    const source = readFileSync(sourcePath("../prompt.ts"), "utf8");
    expect(source).not.toMatch(/import\s+"server-only"/);
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/node:crypto/);
    expect(source).not.toMatch(/node:fs/);
  });

  it("não cria prompt/política/versão nova", () => {
    const source = readFileSync(sourcePath("../prompt.ts"), "utf8");
    expect(source).not.toMatch(/composerVersion\s*:/);
    expect(source).not.toMatch(/resolver\s*:/);
    expect(source).not.toMatch(/PROMPT_BASE_VERSION\s*=/);
  });
});
