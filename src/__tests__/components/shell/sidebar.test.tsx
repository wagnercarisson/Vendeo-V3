// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { Sidebar } from "@/components/shell/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/campanhas"),
}));

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

  it("highlights active route with accent class", () => {
    const html = renderToString(<Sidebar />);
    expect(html).toContain("bg-accent-green/10");
    const campanhasIndex = html.indexOf("Campanhas");
    const activeClassIndex = html.lastIndexOf("bg-accent-green/10", campanhasIndex);
    expect(activeClassIndex).not.toBe(-1);
  });
});
