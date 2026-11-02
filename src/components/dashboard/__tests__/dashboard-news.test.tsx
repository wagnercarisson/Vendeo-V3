// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

import { ptBRDashboardMessages } from "@/lib/i18n/dashboard";
import type { ChangelogEntry } from "@/lib/changelog/types";

import { DashboardNews } from "../dashboard-news";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const labels = ptBRDashboardMessages.news;

function makeEntry(
  overrides: Partial<ChangelogEntry["frontmatter"]> = {},
): ChangelogEntry {
  return {
    frontmatter: {
      id: "campanhas-mais-qualidade-novos-cenarios",
      title: "Campanhas com mais qualidade e novos cenários",
      date: "2026-10-19",
      milestone: "v1.5",
      category: "feature",
      importance: "major",
      announcement: "card",
      ...overrides,
    },
    body: "## O que mudou\n\n- Primeiro item do corpo completo.",
    slug: "2026-10-19-campanhas-mais-qualidade-novos-cenarios",
  };
}

describe("DashboardNews", () => {
  it("retorna nada sem entry", () => {
    const html = renderToString(
      <DashboardNews entry={null} excerpt="Trecho" labels={labels} />,
    );

    expect(html).toBe("");
  });

  it('retorna nada quando announcement é "none"', () => {
    const html = renderToString(
      <DashboardNews
        entry={makeEntry({ announcement: "none" })}
        excerpt="Trecho"
        labels={labels}
      />,
    );

    expect(html).toBe("");
  });

  it("renderiza anúncio compacto com título, data, trecho e ação", () => {
    const html = renderToString(
      <DashboardNews
        entry={makeEntry()}
        excerpt="Trecho editorial derivado."
        labels={labels}
      />,
    );

    expect(html).toContain("Campanhas com mais qualidade e novos cenários");
    expect(html).toContain("19/10/2026");
    expect(html).toContain("Trecho editorial derivado.");
    expect(html).toContain('href="/novidades"');
    expect(html).toContain(labels.view);
    expect(html).toContain(`aria-label="${labels.close}"`);
    expect(html).toContain(`aria-label="${labels.sectionLabel}"`);
  });

  it("delega lang=\"pt-BR\" ao anúncio compacto, sem corpo markdown", () => {
    const html = renderToString(
      <DashboardNews
        entry={makeEntry()}
        excerpt="Trecho editorial derivado."
        labels={labels}
      />,
    );

    expect(html).toContain('lang="pt-BR"');
    expect(html).not.toContain("<ul>");
    expect(html).not.toContain("Primeiro item do corpo completo.");
  });

  it("mantém título, data e ações quando o trecho é nulo", () => {
    const html = renderToString(
      <DashboardNews entry={makeEntry()} excerpt={null} labels={labels} />,
    );

    expect(html).toContain("Campanhas com mais qualidade e novos cenários");
    expect(html).toContain("19/10/2026");
    expect(html).toContain(labels.view);
    expect(html).not.toContain("<ul>");
  });

  it("usa rótulos localizados quando fornecidos", () => {
    const html = renderToString(
      <DashboardNews
        entry={makeEntry()}
        excerpt="Trecho editorial derivado."
        labels={{
          sectionLabel: "Novedades",
          view: "Ver novedades",
          close: "Cerrar anuncio",
        }}
      />,
    );

    expect(html).toContain("Ver novedades");
    expect(html).toContain('aria-label="Cerrar anuncio"');
    expect(html).toContain('aria-label="Novedades"');
  });
});
