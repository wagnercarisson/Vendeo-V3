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

  it("main has responsive padding px-4 py-6 sm:px-6", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    expect(html).toContain("px-4 py-6 sm:px-6");
  });

  it("wrapper uses min-h-dvh and not h-screen (document scroll)", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    expect(html).toContain("min-h-dvh");
    expect(html).not.toContain("h-screen");
  });

  it("main has no internal scroll (localized: snippet around px-4 py-6 sm:px-6 has no overflow-auto)", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    const marker = "px-4 py-6 sm:px-6";
    const markerIndex = html.indexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const mainSnippet = html.slice(markerIndex - 200, markerIndex + 200);
    expect(mainSnippet).not.toContain("overflow-auto");
  });

  it("layout: sidebar sticky with own scroll, topbar sticky, min-w-0 guards", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    expect(html).toContain("sticky top-0");
    expect(html).toContain("h-dvh");
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("sticky top-0 z-30");
    expect(html).toContain("min-w-0");
    expect(html).toContain("min-h-0 min-w-0");
  });

  it("renders the desktop brand link and keeps the nav non-shrinking", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );

    expect(html).toContain('aria-label="Vendeo — ir para o dashboard"');
    expect(html).toContain('src="/landing/vendeo-logo-dark.webp"');
    expect(html).toContain("flex-col");
    expect(html).toContain("md:flex");
    expect(html).toContain("shrink-0");
  });

  it("renders exactly one signature, only in the desktop sidebar", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    const signatureCount = (
      html.match(/<img src="\/brand\/vendeo-signature\.png"/g) ?? []
    ).length;

    expect(signatureCount).toBe(1);
    expect(html).toContain('data-signature-visible="false"');
  });

  it("keeps the mobile symbol in the topbar and the logo in the drawer", () => {
    const html = renderToString(
      <AppShell user={{ claims: { email: "test@test.com" } }}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    const symbolCount = (
      html.match(/<img src="\/icons\/icon-512x512\.png"/g) ?? []
    ).length;
    const logoCount = (
      html.match(/<img src="\/landing\/vendeo-logo-dark\.webp"/g) ?? []
    ).length;

    expect(symbolCount).toBe(1);
    expect(logoCount).toBe(2);
  });
});
