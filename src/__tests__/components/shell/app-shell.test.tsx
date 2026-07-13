// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { AppShell } from "@/components/shell/app-shell";

describe("AppShell", () => {
  it("renders sidebar, topbar and children", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    expect(html).toContain("Dashboard");
    expect(html).toContain("Campanhas");
    expect(html).toContain("Nova Campanha");
    expect(html).toContain("Vendeo");
    expect(html).toContain("<p>Conteúdo</p>");
  });

  it("tolerates store = null (no store dependency)", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "storeless@test.com" } }}>
        <p>Dashboard</p>
      </AppShell>,
    );
    expect(html).toContain("Dashboard");
    expect(html).toContain("storeless@test.com");
  });
});
