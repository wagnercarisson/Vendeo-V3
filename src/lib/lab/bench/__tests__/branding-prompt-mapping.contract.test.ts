// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PROMPT_BLOCK_LABELS } from "../domain/prompt-composer";
import {
  buildBrandingPromptContributions,
  selectVisualDirection,
  VISUAL_DIRECTION_CHAIN,
} from "../domain/branding-prompt-mapping";
import type { BrandingPromptContribution } from "../domain/branding-prompt-mapping";
import type {
  BenchExperimentalBriefing,
  BenchExperimentalVisualDirection,
} from "../domain/experimental-briefing";
import type { BenchConfig } from "../domain/schemas";

/**
 * Contrato do **mapeamento mínimo de branding** (F48.2.4, D8;
 * spec `lab-bench-branding`).
 *
 * Prova, sem nenhuma chamada de rede/IA:
 *  - `storeName` + `brandColor` sempre presentes;
 *  - **um único** campo de direção visual pela cadeia travada (nunca os cinco);
 *  - tipografia no bloco próprio `[DIREÇÃO TIPOGRÁFICA]`;
 *  - demais campos apenas na evidência;
 *  - determinismo (mesma entrada ⇒ mesma seleção);
 *  - ausência de dedup semântica/embedding (seleção posicional);
 *  - ausência de sobreposição com as orientações exclusivas de oferta/produto.
 */

const CONFIG: BenchConfig = {
  pipeline: "manual-direto",
  formato: "1:1",
  modelo: "gpt-image-2",
  qualidade: "low",
  intencao: "oferta",
  tipoConteudo: "produto",
  estrutura: "peca-unica",
  tema: "nenhum",
};

const EMPTY_DIRECTION: BenchExperimentalVisualDirection = {
  campaignBrief: null,
  campaignGuidelines: null,
  visualStyle: null,
  visualTone: null,
  brandPersonality: null,
};

function makeBriefing(overrides: {
  storeName?: string;
  brandColor?: string;
  typographyDirection?: string | null;
  visualDirection?: Partial<BenchExperimentalVisualDirection>;
} = {}): BenchExperimentalBriefing {
  return {
    backgroundDirection: "studio",
    storeId: "11111111-1111-4111-8111-111111111111",
    storeName: overrides.storeName ?? "Loja Exemplo",
    segment: "moda-calcados-acessorios",
    visualDirection: { ...EMPTY_DIRECTION, ...(overrides.visualDirection ?? {}) },
    typographyDirection:
      overrides.typographyDirection === undefined
        ? "Poppins para títulos; Open Sans para textos"
        : overrides.typographyDirection,
    brandColor: overrides.brandColor ?? "#22C55E",
    product: { name: "Camiseta básica", description: "100% algodão" },
    commercial: {
      intent: "offer",
      originalPriceText: null,
      discountedPriceText: null,
      badge: null,
      validity: null,
      preserveImageContext: false,
    },
    constraints: { mandatoryArtworkText: null },
    config: CONFIG,
  };
}

function linesOf(
  contributions: readonly BrandingPromptContribution[],
  block: string,
): string[] {
  return contributions
    .filter((contribution) => contribution.block === block)
    .flatMap((contribution) => contribution.lines);
}

// ─── Sempre nome + cor ───────────────────────────────────────────────────────

describe("branding mapping — nome e cor sempre presentes", () => {
  it("inclui storeName e brandColor no bloco de identidade", () => {
    const contributions = buildBrandingPromptContributions(makeBriefing());
    const identity = linesOf(contributions, PROMPT_BLOCK_LABELS.identity);

    expect(identity).toContain("Loja: Loja Exemplo");
    expect(identity).toContain("Cor da marca: #22C55E");
  });

  it("preserva nome e cor mesmo sem nenhuma direção visual", () => {
    const contributions = buildBrandingPromptContributions(
      makeBriefing({ visualDirection: EMPTY_DIRECTION, typographyDirection: null }),
    );
    const identity = linesOf(contributions, PROMPT_BLOCK_LABELS.identity);

    expect(identity).toEqual(["Loja: Loja Exemplo", "Cor da marca: #22C55E"]);
  });
});

// ─── Um único campo de direção visual ────────────────────────────────────────

describe("branding mapping — um único campo de direção visual", () => {
  const ALL_FIVE: BenchExperimentalVisualDirection = {
    campaignBrief: "Campanha focada em oferta de moda",
    campaignGuidelines: "Sempre destacar o preço",
    visualStyle: "Minimalista",
    visualTone: "Comercial",
    brandPersonality: "Próxima e confiável",
  };

  it("com os cinco campos preenchidos, envia apenas o primeiro da cadeia", () => {
    const contributions = buildBrandingPromptContributions(
      makeBriefing({ visualDirection: ALL_FIVE }),
    );
    const identity = linesOf(contributions, PROMPT_BLOCK_LABELS.identity);

    expect(identity).toContain("Brief da marca: Campanha focada em oferta de moda");
    for (const label of [
      "Diretrizes de campanha:",
      "Estilo visual:",
      "Tom visual:",
      "Personalidade da marca:",
    ]) {
      expect(identity.some((line) => line.startsWith(label))).toBe(false);
    }
  });

  it("nunca envia os cinco campos simultaneamente", () => {
    const contributions = buildBrandingPromptContributions(
      makeBriefing({ visualDirection: ALL_FIVE }),
    );
    const identity = linesOf(contributions, PROMPT_BLOCK_LABELS.identity);
    const visualLines = VISUAL_DIRECTION_CHAIN.filter((step) =>
      identity.some((line) => line.startsWith(`${step.label}:`)),
    );

    expect(visualLines.length).toBe(1);
  });

  it("cai para o primeiro não vazio da cadeia", () => {
    const contributions = buildBrandingPromptContributions(
      makeBriefing({ visualDirection: { ...EMPTY_DIRECTION, visualTone: "Comercial" } }),
    );
    const identity = linesOf(contributions, PROMPT_BLOCK_LABELS.identity);

    expect(identity).toContain("Tom visual: Comercial");
    expect(selectVisualDirection({ ...EMPTY_DIRECTION, brandPersonality: "Séria" })).toEqual({
      label: "Personalidade da marca",
      value: "Séria",
    });
    expect(selectVisualDirection(EMPTY_DIRECTION)).toBeNull();
  });
});

// ─── Tipografia no bloco próprio ─────────────────────────────────────────────

describe("branding mapping — direção tipográfica no bloco próprio", () => {
  it("envia typographyDirection em [DIREÇÃO TIPOGRÁFICA]", () => {
    const contributions = buildBrandingPromptContributions(makeBriefing());
    const typography = linesOf(contributions, PROMPT_BLOCK_LABELS.typography);

    expect(typography).toEqual([
      "Direção tipográfica: Poppins para títulos; Open Sans para textos",
    ]);
  });

  it("não coloca a tipografia no bloco de identidade", () => {
    const contributions = buildBrandingPromptContributions(makeBriefing());
    const identity = linesOf(contributions, PROMPT_BLOCK_LABELS.identity);

    expect(identity.some((line) => line.includes("Poppins"))).toBe(false);
  });

  it("omite o bloco de tipografia quando ausente", () => {
    const contributions = buildBrandingPromptContributions(
      makeBriefing({ typographyDirection: null }),
    );

    expect(contributions.some((c) => c.block === PROMPT_BLOCK_LABELS.typography)).toBe(false);
  });
});

// ─── Demais campos apenas na evidência ───────────────────────────────────────

describe("branding mapping — demais campos permanecem apenas na evidência", () => {
  it("segmento e demais campos não entram no prompt", () => {
    const contributions = buildBrandingPromptContributions(makeBriefing());
    const allLines = contributions.flatMap((contribution) => contribution.lines).join("\n");

    expect(allLines).not.toContain("moda-calcados-acessorios");
    expect(allLines).not.toContain("Segmento");
    expect(allLines).not.toContain("subsegment");
    expect(allLines).not.toContain("toneOfVoice");
    expect(allLines).not.toContain("positioning");
    expect(allLines).not.toContain("slogan");
    expect(allLines).not.toContain("profileStatus");
  });
});

// ─── Determinismo e ausência de dedup semântica ──────────────────────────────

describe("branding mapping — determinismo e ausência de dedup semântica", () => {
  it("mesma entrada ⇒ mesma seleção", () => {
    const briefing = makeBriefing({
      visualDirection: { campaignBrief: "A", visualStyle: "B" },
    });

    expect(buildBrandingPromptContributions(briefing)).toEqual(
      buildBrandingPromptContributions(briefing),
    );
  });

  it("a seleção é posicional, independente do conteúdo (sem dedup por texto)", () => {
    // Conteúdo idêntico em dois degraus: o primeiro da cadeia vence (posição).
    const contributions = buildBrandingPromptContributions(
      makeBriefing({ visualDirection: { visualStyle: "Comercial", visualTone: "Comercial" } }),
    );
    const identity = linesOf(contributions, PROMPT_BLOCK_LABELS.identity);

    expect(identity).toContain("Estilo visual: Comercial");
    expect(identity.some((line) => line.startsWith("Tom visual:"))).toBe(false);
  });

  it("o módulo não usa embeddings/similaridade nem IA", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/branding-prompt-mapping.ts"),
      "utf8",
    );
    // Apenas as linhas de import são inspecionadas (a prova de independência).
    const imports = source
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import"))
      .join("\n")
      .toLowerCase();

    for (const forbidden of ["embedding", "similarity", "cosine", "openai", "@google", "policies"]) {
      expect(imports).not.toContain(forbidden);
    }
  });
});

// ─── Sem sobreposição com oferta/produto ─────────────────────────────────────

describe("branding mapping — sem sobreposição com as políticas de oferta/produto", () => {
  it("não repete orientações comerciais nem de produto", () => {
    const contributions = buildBrandingPromptContributions(
      makeBriefing({ visualDirection: { campaignBrief: "Campanha de moda" } }),
    );
    const allLines = contributions
      .flatMap((contribution) => contribution.lines)
      .map((line) => line.toLowerCase());

    for (const commercial of ["preço", "desconto", "selo", "validade"]) {
      expect(allLines.some((line) => line.includes(commercial))).toBe(false);
    }
    for (const product of ["elemento principal", "embalagem", "benefício"]) {
      expect(allLines.some((line) => line.includes(product))).toBe(false);
    }
  });
});
