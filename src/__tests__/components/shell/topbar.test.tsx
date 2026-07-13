// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Topbar } from "@/components/shell/topbar";

describe("Topbar", () => {
  it("renders CTA Nova Campanha", () => {
    const html = renderToString(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    expect(html).toContain("Nova Campanha");
    expect(html).toContain('href="/campanhas/nova"');
  });

  it("renders Vendeo branding", () => {
    const html = renderToString(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    expect(html).toContain("Vendeo");
  });
});
