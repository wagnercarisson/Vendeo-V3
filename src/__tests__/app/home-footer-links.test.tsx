// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Rodapé da home após a inclusão de `/padarias`.
 *
 * A change permite uma única alteração visível na home: o link “Padarias” ao
 * lado de “Floriculturas”. O teste renderiza a home com as dependências
 * irrelevantes mockadas e confirma rótulos, destinos e ordem relativa.
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

describe("home — rodapé com Padarias ao lado de Floriculturas", () => {
  it("renderiza os dois links na ordem aprovada e com os destinos corretos", async () => {
    vi.resetModules();
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(await Home());

    const floriculturas = html.indexOf('href="/floriculturas"');
    const padarias = html.indexOf('href="/padarias"');

    expect(floriculturas).toBeGreaterThan(-1);
    expect(padarias).toBeGreaterThan(floriculturas);
    expect(html).toContain(">Floriculturas</a>");
    expect(html).toContain(">Padarias</a>");
    expect(html.match(/href="\/padarias"/g) ?? []).toHaveLength(1);
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
      "/login",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});
