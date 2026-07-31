// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ChangelogList } from "../changelog-list";
import { ChangelogCard } from "../changelog-card";
import type { ChangelogEntry } from "@/lib/changelog/types";

function makeEntry(
  overrides: Partial<ChangelogEntry["frontmatter"]> = {},
  body = "",
): ChangelogEntry {
  return {
    frontmatter: {
      id: "entry-1",
      title: "Título de teste",
      date: "2026-07-31",
      category: "feature",
      importance: "minor",
      announcement: "none",
      ...overrides,
    },
    body,
    slug: "2026-07-31-entry",
  };
}

describe("ChangelogList", () => {
  it("renderiza 3 ChangelogCard na ordem recebida com badge de categoria da cor correta", () => {
    const entries = [
      makeEntry({ id: "e1", title: "Primeira", category: "feature" }),
      makeEntry({ id: "e2", title: "Segunda", category: "improvement" }),
      makeEntry({ id: "e3", title: "Terceira", category: "fix" }),
    ];
    const html = renderToString(<ChangelogList entries={entries} />);

    const idx1 = html.indexOf("Primeira");
    const idx2 = html.indexOf("Segunda");
    const idx3 = html.indexOf("Terceira");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx3).toBeGreaterThan(idx2);

    expect(html).toContain("accent-green");
    expect(html).toContain("accent-blue");
    expect(html).toContain("accent-amber");
  });

  it("renderiza estado vazio tratado sem lançar quando array vazio", () => {
    const html = renderToString(<ChangelogList entries={[]} />);
    expect(html).toContain("Nenhuma novidade por enquanto");
  });
});

describe("ChangelogCard", () => {
  it("formata data dd/mm/aaaa sem shift de fuso (2026-07-31 → 31/07/2026)", () => {
    const html = renderToString(
      <ChangelogCard entry={makeEntry({ date: "2026-07-31" })} />,
    );
    expect(html).toContain("31/07/2026");
    expect(html).not.toContain("30/07/2026");
  });

  it("renderiza markdown com h2, p, ul e escapa script cru (sanitização em profundidade)", () => {
    const entry = makeEntry(
      {},
      "## O que mudou\n\nUm parágrafo <script>alert('xss')</script> aqui.\n\n- Item 1\n- Item 2",
    );
    const html = renderToString(<ChangelogCard entry={entry} />);
    expect(html).toContain("<h2>O que mudou</h2>");
    expect(html).toContain("<p>");
    expect(html).toContain("<ul>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});
