// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Rodapé da home após a inclusão de `/padarias` e da página de campanhas.
 *
 * A change permite uma única alteração visível na home: o novo link
 * “Mercados e mercearias” no rodapé compartilhado, ao lado dos destinos já
 * existentes. O teste renderiza a home com as dependências irrelevantes mockadas
 * e confirma rótulos, destinos e ordem relativa.
 */

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: vi.fn(async () => ({ publicSignupEnabled: false })),
}));

vi.mock("@/lib/changelog/get-changelog", () => ({
  getAllEntries: vi.fn(async () => []),
}));

vi.mock("@/components/changelog/changelog-list", () => ({
  ChangelogList: () => null,
}));

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => null,
}));

describe("home — rodapé com as páginas públicas na ordem aprovada", () => {
  it("renderiza os quatro links na ordem aprovada e com os destinos corretos", async () => {
    vi.resetModules();
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(await Home());

    const floriculturas = html.indexOf('href="/floriculturas"');
    const padarias = html.indexOf('href="/padarias"');
    const mercados = html.indexOf('href="/ofertas-para-mercados"');
    const campanhas = html.indexOf('href="/campanhas-para-sua-loja"');

    expect(floriculturas).toBeGreaterThan(-1);
    expect(padarias).toBeGreaterThan(floriculturas);
    expect(mercados).toBeGreaterThan(padarias);
    expect(campanhas).toBeGreaterThan(mercados);
    expect(html).toContain(">Floriculturas</a>");
    expect(html).toContain(">Padarias</a>");
    expect(html).toContain(">Mercados e mercearias</a>");
    expect(html).toContain(">Campanhas sem complicação</a>");
    expect(html.match(/href="\/padarias"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="\/ofertas-para-mercados"/g) ?? []).toHaveLength(1);
    expect(
      html.match(/href="\/campanhas-para-sua-loja"/g) ?? [],
    ).toHaveLength(1);
  });

  it("preserva os demais links do rodapé", async () => {
    vi.resetModules();
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(await Home());

    for (const href of [
      "/termos",
      "/privacidade",
      "/uso-aceitavel",
      "/floriculturas",
      "/padarias",
      "/ofertas-para-mercados",
      "/campanhas-para-sua-loja",
      "/login",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("agrupa a navegação e preserva contato, novidades e aviso legal", async () => {
    vi.resetModules();
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Explore o Vendeo");
    expect(html).toContain("Institucional");
    expect(html).toContain(">Contato</a>");
    expect(html).toContain(">Novidades</button>");
    expect(html).toContain(">Entrar</a>");
    expect(html).toContain(
      "As lojas e campanhas apresentadas são exemplos demonstrativos",
    );
    expect(html).not.toContain(">Voltar ao Vendeo</a>");
    expect(html).not.toContain('aria-current="page"');
  });
});
