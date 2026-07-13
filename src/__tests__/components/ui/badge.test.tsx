// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders ready variant with green styling", () => {
    const html = renderToString(<Badge variant="ready">Pronto</Badge>);
    expect(html).toContain("text-accent-green");
    expect(html).toContain("Pronto");
  });

  it("renders error variant with red styling", () => {
    const html = renderToString(<Badge variant="error">Erro</Badge>);
    expect(html).toContain("text-accent-red");
    expect(html).toContain("Erro");
  });

  it("renders default variant with neutral styling", () => {
    const html = renderToString(<Badge variant="default">Rascunho</Badge>);
    expect(html).toContain("text-text-secondary");
    expect(html).toContain("Rascunho");
  });
});
