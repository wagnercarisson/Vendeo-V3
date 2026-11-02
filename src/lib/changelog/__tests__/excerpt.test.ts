import { describe, it, expect } from "vitest";

import { buildAnnouncementExcerpt } from "../excerpt";

const FIXTURE_BODY = `## O que mudou

- A geração de campanhas ficou mais ágil, sem mudar o que você precisa fazer.
- A composição da arte ficou mais equilibrada.

## Por que isso importa

- Você ganha uma peça mais profissional.
`;

describe("buildAnnouncementExcerpt", () => {
  it("retorna o primeiro bloco textual, ignorando heading", () => {
    expect(buildAnnouncementExcerpt(FIXTURE_BODY)).toBe(
      "A geração de campanhas ficou mais ágil, sem mudar o que você precisa fazer.",
    );
  });

  it("não devolve heading nem marcador de lista", () => {
    const excerpt = buildAnnouncementExcerpt(FIXTURE_BODY);

    expect(excerpt).not.toContain("##");
    expect(excerpt).not.toContain("O que mudou");
    expect(excerpt).not.toMatch(/^-\s/);
  });

  it("remove negrito e mantém apenas o texto", () => {
    const body = `## O que mudou

- **Estúdio:** fundo limpo, na paleta da loja.
`;

    expect(buildAnnouncementExcerpt(body)).toBe(
      "Estúdio: fundo limpo, na paleta da loja.",
    );
  });

  it("remove links markdown mantendo o texto", () => {
    const body = `## O que mudou

- Veja [a novidade completa](https://exemplo.test/novidades) no painel.
`;

    expect(buildAnnouncementExcerpt(body)).toBe(
      "Veja a novidade completa no painel.",
    );
  });

  it("colapsa espaços em branco", () => {
    const body = `

      Texto    com     espaços
      e quebras de linha.

`;

    expect(buildAnnouncementExcerpt(body)).toBe(
      "Texto com espaços e quebras de linha.",
    );
  });

  it("corta em fronteira de palavra e acrescenta reticências", () => {
    const body = "palavra ".repeat(40);
    const excerpt = buildAnnouncementExcerpt(body, 30);

    expect(excerpt).not.toBeNull();
    expect(excerpt!.endsWith("…")).toBe(true);
    expect(excerpt!.slice(0, -1)).toBe("palavra palavra palavra");
    expect(excerpt!.length).toBeLessThanOrEqual(31);
  });

  it("retorna null para corpo vazio, apenas headings ou código", () => {
    expect(buildAnnouncementExcerpt("")).toBeNull();
    expect(buildAnnouncementExcerpt("\n\n   \n")).toBeNull();
    expect(buildAnnouncementExcerpt("## O que mudou\n\n## Por que importa\n")).toBeNull();
    expect(buildAnnouncementExcerpt("```\nconst x = 1;\n```\n")).toBeNull();
  });

  it("não inventa texto: o trecho deriva do corpo", () => {
    const excerpt = buildAnnouncementExcerpt(FIXTURE_BODY);

    expect(excerpt).not.toBeNull();
    expect(FIXTURE_BODY).toContain(excerpt!);
  });
});
