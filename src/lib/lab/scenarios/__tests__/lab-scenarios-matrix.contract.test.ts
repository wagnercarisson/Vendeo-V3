// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseLabScenarioContent } from "../schema";
import type { LabScenarioContent } from "../schema";
import { listScenarioFixtures } from "../service";

/**
 * Matriz representativa de nove cenários (F48.2.1, D4; specs `lab-scenarios` e
 * `lab-prompt-optimization`).
 *
 * Trava o contrato da matriz: exatamente nove cenários (3 `offer` + 3 `spotlight`
 * + 3 `exclusive`), todos `1:1`/`pt-BR`, aceitos por `parseLabScenarioContent`, e
 * **todo atributo obrigatório coberto por ao menos um cenário**. O mapa de
 * cobertura é declarado e verificado contra o conteúdo real das fixtures quando o
 * atributo é derivável.
 *
 * Nenhuma rede e nenhuma chamada paga.
 */

/** Atributos obrigatórios da matriz (D4 / spec `lab-prompt-optimization`). */
const REQUIRED_MATRIX_ATTRIBUTES = [
  "segmentos-comerciais-distintos",
  "preco-promocional-com-original",
  "preco-unico",
  "ausencia-obrigatoria-de-preco",
  "identidade-logo-ou-textual",
  "textos-obrigatorios",
  "aviso-ilustrativo",
  "validade",
  "ausencia-de-cta-e-hook",
  "multiplas-imagens-de-produto",
  "embalagem-com-textos-e-detalhes",
  "fotografia-contextual",
  "produto-a-ser-isolado",
  "nomes-longos",
  "condicao-invencao",
  "condicao-deformacao",
  "condicao-perda-de-identidade",
  "condicao-ilegibilidade",
  "condicao-tom-comercial-incorreto",
] as const;

type MatrixAttribute = (typeof REQUIRED_MATRIX_ATTRIBUTES)[number];

/**
 * Mapa de cobertura declarado: slug → atributos que aquele cenário cobre. É a
 * fonte da distribuição registrada junto da versão da matriz.
 */
const MATRIX_ATTRIBUTE_COVERAGE: Record<string, MatrixAttribute[]> = {
  "produto-oferta-preco": [
    "segmentos-comerciais-distintos",
    "preco-promocional-com-original",
    "multiplas-imagens-de-produto",
    "identidade-logo-ou-textual",
  ],
  "produto-oferta-texto-obrigatorio": [
    "textos-obrigatorios",
    "aviso-ilustrativo",
    "validade",
    "identidade-logo-ou-textual",
  ],
  "produto-oferta-logo": ["identidade-logo-ou-textual", "segmentos-comerciais-distintos"],
  "destaque-preco-promocional": [
    "segmentos-comerciais-distintos",
    "preco-promocional-com-original",
    "multiplas-imagens-de-produto",
    "embalagem-com-textos-e-detalhes",
    "condicao-ilegibilidade",
  ],
  "destaque-sem-preco-ambiente": [
    "segmentos-comerciais-distintos",
    "ausencia-obrigatoria-de-preco",
    "fotografia-contextual",
    "nomes-longos",
    "ausencia-de-cta-e-hook",
    "condicao-invencao",
  ],
  "destaque-textos-legais": [
    "segmentos-comerciais-distintos",
    "textos-obrigatorios",
    "aviso-ilustrativo",
    "validade",
    "identidade-logo-ou-textual",
    "condicao-tom-comercial-incorreto",
  ],
  "exclusivo-logo-preco-unico": [
    "identidade-logo-ou-textual",
    "preco-unico",
    "embalagem-com-textos-e-detalhes",
    "condicao-ilegibilidade",
    "segmentos-comerciais-distintos",
  ],
  "exclusivo-produto-isolado": [
    "produto-a-ser-isolado",
    "multiplas-imagens-de-produto",
    "ausencia-de-cta-e-hook",
    "condicao-deformacao",
    "segmentos-comerciais-distintos",
  ],
  "exclusivo-estresse-identidade": [
    "identidade-logo-ou-textual",
    "nomes-longos",
    "condicao-invencao",
    "condicao-perda-de-identidade",
    "condicao-tom-comercial-incorreto",
    "segmentos-comerciais-distintos",
  ],
};

/**
 * Verificação derivável: para atributos que podem ser lidos do conteúdo, o
 * cenário declarado no mapa **precisa** satisfazer o predicado. Mantém o mapa
 * honesto (não basta declarar cobertura).
 */
const DERIVED_ATTRIBUTE_CHECKS: Partial<Record<MatrixAttribute, (c: LabScenarioContent) => boolean>> = {
  "preco-promocional-com-original": (c) =>
    c.brief.offer.originalPriceCents !== undefined && c.brief.offer.discountedPriceCents !== undefined,
  "preco-unico": (c) =>
    c.brief.offer.discountedPriceCents !== undefined && c.brief.offer.originalPriceCents === undefined,
  "ausencia-obrigatoria-de-preco": (c) =>
    c.brief.offer.originalPriceCents === undefined && c.brief.offer.discountedPriceCents === undefined,
  "textos-obrigatorios": (c) => (c.brief.legalNotice?.mandatoryText?.length ?? 0) > 0,
  "aviso-ilustrativo": (c) => c.brief.legalNotice?.illustrativeNoticeEnabled === true,
  validade: (c) => (c.brief.offer.validityText?.length ?? 0) > 0,
  "ausencia-de-cta-e-hook": (c) => c.brief.offer.cta === undefined && c.brief.offer.hook === undefined,
  "multiplas-imagens-de-produto": (c) => c.images.length >= 2,
  "fotografia-contextual": (c) => c.brief.creativeContext?.preserveImageContext === true,
  "nomes-longos": (c) => c.brief.product.name.length >= 40,
};

async function fixturesBySlug(): Promise<Map<string, LabScenarioContent>> {
  const fixtures = await listScenarioFixtures();
  return new Map(fixtures.map((fixture) => [fixture.slug, fixture.content]));
}

describe("matriz de nove cenários — composição", () => {
  it("tem exatamente nove cenários (3 offer + 3 spotlight + 3 exclusive)", async () => {
    const fixtures = await listScenarioFixtures();
    const counts = { offer: 0, spotlight: 0, exclusive: 0 };

    for (const fixture of fixtures) {
      const intent = fixture.content.intent;
      if (intent === "offer" || intent === "spotlight" || intent === "exclusive") {
        counts[intent] += 1;
      }
    }

    expect(fixtures).toHaveLength(9);
    expect(counts).toEqual({ offer: 3, spotlight: 3, exclusive: 3 });
  });

  it("todos permanecem 1:1/pt-BR e são aceitos por parseLabScenarioContent", async () => {
    const fixtures = await listScenarioFixtures();

    for (const fixture of fixtures) {
      expect(fixture.content.format).toBe("1:1");
      expect(fixture.content.locale).toBe("pt-BR");
      expect(() => parseLabScenarioContent(fixture.content)).not.toThrow();
    }
  });

  it("o mapa de cobertura lista exatamente os nove slugs da matriz", async () => {
    const fixtures = await listScenarioFixtures();
    expect(Object.keys(MATRIX_ATTRIBUTE_COVERAGE).sort()).toEqual(
      fixtures.map((fixture) => fixture.slug).sort(),
    );
  });
});

describe("matriz de nove cenários — cobertura de atributos", () => {
  it("cada atributo obrigatório é coberto por ao menos um cenário", () => {
    const covered = new Set<MatrixAttribute>();
    for (const attributes of Object.values(MATRIX_ATTRIBUTE_COVERAGE)) {
      for (const attribute of attributes) covered.add(attribute);
    }

    const missing = REQUIRED_MATRIX_ATTRIBUTES.filter((attribute) => !covered.has(attribute));
    expect(missing).toEqual([]);
  });

  it("a cobertura declarada é confirmada pelo conteúdo real (atributos deriváveis)", async () => {
    const contents = await fixturesBySlug();

    for (const [attribute, predicate] of Object.entries(DERIVED_ATTRIBUTE_CHECKS)) {
      const slugs = Object.entries(MATRIX_ATTRIBUTE_COVERAGE)
        .filter(([, attributes]) => attributes.includes(attribute as MatrixAttribute))
        .map(([slug]) => slug);

      expect(slugs.length).toBeGreaterThan(0);
      const satisfied = slugs.some((slug) => {
        const content = contents.get(slug);
        return content ? predicate(content) : false;
      });
      expect(satisfied).toBe(true);
    }
  });

  it("a matriz cobre segmentos comerciais distintos", async () => {
    const contents = await fixturesBySlug();
    const segments = new Set(
      [...contents.values()].map((content) => content.store.segment),
    );

    expect(segments.size).toBeGreaterThanOrEqual(5);
  });
});
