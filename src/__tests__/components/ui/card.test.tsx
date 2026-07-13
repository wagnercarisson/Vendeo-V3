// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Card } from "@/components/ui/card";

describe("Card", () => {
  it("renders with base classes and children", () => {
    const html = renderToString(<Card><p>Conteúdo</p></Card>);
    expect(html).toContain("bg-bg-surface");
    expect(html).toContain("border");
    expect(html).toContain("rounded-xl");
    expect(html).toContain("<p>Conteúdo</p>");
  });
});
