import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../render-markdown";

describe("renderMarkdown", () => {
  it("renders h2, paragraphs and lists", () => {
    const md = [
      "## O que mudou",
      "",
      "Agora o Vendeo mostra os dados pendentes da loja.",
      "",
      "- Item um",
      "- Item dois",
    ].join("\n");

    const html = renderMarkdown(md);
    expect(html).toContain("<h2>O que mudou</h2>");
    expect(html).toContain("<p>Agora o Vendeo mostra os dados pendentes da loja.</p>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item um</li>");
    expect(html).toContain("<li>Item dois</li>");
  });

  it("renders bold as strong inside the correct element", () => {
    const md = "Ganhe **10 créditos** de boas-vindas.";
    const html = renderMarkdown(md);

    expect(html).toContain("<strong>10 créditos</strong>");
    expect(html).not.toContain("**");
  });

  it("escapes raw html so it is never interpretable", () => {
    const md = "<script>alert('x')</script> e <b>texto</b>";
    const html = renderMarkdown(md);

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
  });

  it("throws on unsupported h1 heading syntax", () => {
    expect(() => renderMarkdown("# Heading")).toThrow(/não suportada|Sintaxe/i);
  });

  it("throws on links and images", () => {
    expect(() => renderMarkdown("Veja [mais](https://vendeo.tech)")).toThrow(/não suportada|Sintaxe/i);
    expect(() => renderMarkdown("![imagem](url.png)")).toThrow(/não suportada|Sintaxe/i);
  });
});
