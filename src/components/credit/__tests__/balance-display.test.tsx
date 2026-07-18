// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { BalanceDisplay } from "@/components/credit/balance-display";

describe("BalanceDisplay", () => {
  it("renders green badge for normal balance (≥3)", () => {
    const html = renderToString(<BalanceDisplay balance={5} />);
    expect(html).toContain("5 créditos");
    expect(html).toContain("text-accent-green");
  });

  it("renders yellow badge for low balance (>0 and <3)", () => {
    const html = renderToString(<BalanceDisplay balance={2} />);
    expect(html).toContain("2 créditos");
    expect(html).toContain("text-accent-amber");
  });

  it("renders red badge for zero balance with CTA", () => {
    const html = renderToString(
      <BalanceDisplay balance={0} showCta={true} ctaHref="/conta" />,
    );
    expect(html).toContain("0 créditos");
    expect(html).toContain("text-accent-red");
    expect(html).toContain("Solicitar créditos");
    expect(html).toContain("/conta");
  });

  it("renders no-store fallback without alert badge", () => {
    const html = renderToString(<BalanceDisplay balance={0} hasStore={false} />);
    expect(html).toContain("0 créditos");
    expect(html).toContain("text-accent-green");
    expect(html).not.toContain("Solicitar créditos");
  });
});
