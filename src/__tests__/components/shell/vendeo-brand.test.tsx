// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { VendeoBrandLink } from "@/components/shell/vendeo-brand";

describe("VendeoBrandLink", () => {
  it("renders the horizontal logo as a /dashboard link", () => {
    const html = renderToString(<VendeoBrandLink variant="logo" />);

    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('aria-label="Vendeo — ir para o dashboard"');
    expect(html).toContain('src="/landing/vendeo-logo-dark.webp"');
    expect(html).toContain('width="384"');
    expect(html).toContain('height="82"');
    expect(html).toContain("h-8 w-auto max-w-[168px]");
  });

  it("renders the symbol variant for the mobile topbar", () => {
    const html = renderToString(
      <VendeoBrandLink variant="symbol" className="md:hidden" />,
    );

    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('aria-label="Vendeo — ir para o dashboard"');
    expect(html).toContain('src="/icons/icon-512x512.png"');
    expect(html).toContain('width="512"');
    expect(html).toContain('height="512"');
    expect(html).toContain("h-9 w-9");
    expect(html).toContain("md:hidden");
  });

  it("has a 44x44 target and a visible keyboard focus ring", () => {
    const html = renderToString(<VendeoBrandLink variant="logo" />);

    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("min-w-[44px]");
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("focus-visible:ring-accent-blue");
    expect(html).toContain("focus-visible:ring-offset-bg-surface");
  });
});
