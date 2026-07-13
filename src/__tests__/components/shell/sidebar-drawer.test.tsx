// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { SidebarDrawer } from "@/components/shell/sidebar-drawer";

describe("SidebarDrawer", () => {
  it("renders when open with navigation links", () => {
    const html = renderToString(<SidebarDrawer isOpen={true} onClose={() => {}} />);
    expect(html).toContain("Dashboard");
    expect(html).toContain("Campanhas");
    expect(html).toContain("Loja");
    expect(html).toContain("Conta");
    expect(html).toContain("z-50");
  });

  it("renders hidden when closed", () => {
    const html = renderToString(<SidebarDrawer isOpen={false} onClose={() => {}} />);
    expect(html).toContain("-translate-x-full");
  });
});
