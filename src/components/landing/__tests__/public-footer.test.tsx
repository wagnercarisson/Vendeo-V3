// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/landing/novidades-link", () => ({
  NovidadesLink: () => <button type="button">Novidades</button>,
}));

import { PublicFooter } from "@/components/landing/public-footer";
import { PUBLIC_FOOTER_EXPLORE_LINKS } from "@/components/landing/public-footer-nav";

function render(
  currentPath: Parameters<typeof PublicFooter>[0]["currentPath"],
  context: "home" | "marketing",
): string {
  return renderToStaticMarkup(
    <PublicFooter
      currentPath={currentPath}
      context={context}
      novidadesEntries={context === "home" ? [] : undefined}
    />,
  );
}

describe("rodapé público compartilhado", () => {
  it("centraliza exatamente os quatro destinos aprovados, na ordem aprovada", () => {
    expect(PUBLIC_FOOTER_EXPLORE_LINKS).toEqual([
      { href: "/floriculturas", label: "Floriculturas" },
      { href: "/padarias", label: "Padarias" },
      { href: "/ofertas-para-mercados", label: "Mercados e mercearias" },
      {
        href: "/campanhas-para-sua-loja",
        label: "Campanhas sem complicação",
      },
    ]);

    const html = render("/floriculturas", "marketing");
    const floriculturas = html.indexOf('href="/floriculturas"');
    const padarias = html.indexOf('href="/padarias"');
    const mercados = html.indexOf('href="/ofertas-para-mercados"');
    const campanhas = html.indexOf('href="/campanhas-para-sua-loja"');

    expect(floriculturas).toBeGreaterThan(-1);
    expect(padarias).toBeGreaterThan(floriculturas);
    expect(mercados).toBeGreaterThan(padarias);
    expect(campanhas).toBeGreaterThan(mercados);
  });

  it("marca somente o destino atual com aria-current", () => {
    const labels: Record<string, string> = {
      "/floriculturas": "Floriculturas",
      "/padarias": "Padarias",
      "/ofertas-para-mercados": "Mercados e mercearias",
      "/campanhas-para-sua-loja": "Campanhas sem complicação",
    };

    for (const [currentPath, label] of Object.entries(labels)) {
      const html = render(
        currentPath as Parameters<typeof PublicFooter>[0]["currentPath"],
        "marketing",
      );
      expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
      expect(html).toMatch(
        new RegExp(
          `<a[^>]*aria-current="page"[^>]*href="${currentPath}"[^>]*>${label}</a>`,
        ),
      );
    }
  });

  it("não marca aria-current na home", () => {
    const html = render("/", "home");

    expect(html).not.toContain('aria-current="page"');
  });

  it("no contexto home preserva contato, novidades, entrada e aviso legal", () => {
    const html = render("/", "home");

    expect(html).toContain("Explore o Vendeo");
    expect(html).toContain("Institucional");
    expect(html).toContain(">Contato</a>");
    expect(html).toContain("mailto:");
    expect(html).toContain(">Novidades</button>");
    expect(html).toContain(">Entrar</a>");
    expect(html).toContain(
      "As lojas e campanhas apresentadas são exemplos demonstrativos",
    );
    expect(html).not.toContain(">Voltar ao Vendeo</a>");
  });

  it("no contexto marketing preserva o retorno à home e não duplica conteúdo da home", () => {
    const html = render("/padarias", "marketing");

    expect(html).toContain(">Voltar ao Vendeo</a>");
    expect(html).toContain('href="/"');
    expect(html).toContain(">Termos de Uso</a>");
    expect(html).toContain(">Política de Privacidade</a>");
    expect(html).toContain(">Uso Aceitável</a>");
    expect(html).toContain(">Entrar</a>");
    expect(html).not.toContain(">Contato</a>");
    expect(html).not.toContain(">Novidades</button>");
    expect(html).not.toContain(
      "As lojas e campanhas apresentadas são exemplos demonstrativos",
    );
  });

  it("mantém um único footer, link real e alvo de toque mínimo", () => {
    const html = render("/padarias", "marketing");

    expect(html.match(/<footer/g) ?? []).toHaveLength(1);
    expect(html.match(/<a\s/g) ?? []).toHaveLength(9);
    expect(html).toContain('href="/termos"');
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("focus-visible:ring-2");
  });
});
