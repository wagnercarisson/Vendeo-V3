// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Sidebar } from "@/components/shell/sidebar";

describe("Sidebar", () => {
  it("renders 4 navigation links", () => {
    const html = renderToString(<Sidebar />);
    expect(html).toContain("Dashboard");
    expect(html).toContain("Campanhas");
    expect(html).toContain("Loja");
    expect(html).toContain("Conta");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/campanhas"');
    expect(html).toContain('href="/loja"');
    expect(html).toContain('href="/conta"');
  });
});
