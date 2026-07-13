import { describe, it, expect } from "vitest";

describe("microcopy constants", () => {
  it("all 5 constants have icon, title, and description as non-empty strings", async () => {
    const mod = await import("@/lib/onboarding/microcopy");

    const constants = [
      mod.DASHBOARD_NO_STORE,
      mod.DASHBOARD_NO_CAMPAIGNS,
      mod.DASHBOARD_PLACEHOLDER,
      mod.CAMPAIGNS_NO_STORE,
      mod.CAMPAIGNS_NO_CAMPAIGNS,
    ];

    expect(constants).toHaveLength(5);

    for (const c of constants) {
      expect(c.icon).toBeDefined();
      expect(typeof c.title).toBe("string");
      expect(c.title.length).toBeGreaterThan(0);
      expect(typeof c.description).toBe("string");
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it("DASHBOARD_PLACEHOLDER has no ctaLabel", async () => {
    const { DASHBOARD_PLACEHOLDER } = await import(
      "@/lib/onboarding/microcopy"
    );
    expect(DASHBOARD_PLACEHOLDER.ctaLabel).toBeUndefined();
    expect(DASHBOARD_PLACEHOLDER.ctaHref).toBeUndefined();
  });

  it("constants with ctaLabel also have non-empty ctaHref", async () => {
    const mod = await import("@/lib/onboarding/microcopy");

    const withCta = [
      mod.DASHBOARD_NO_STORE,
      mod.DASHBOARD_NO_CAMPAIGNS,
      mod.CAMPAIGNS_NO_STORE,
      mod.CAMPAIGNS_NO_CAMPAIGNS,
    ];

    for (const c of withCta) {
      expect(c.ctaLabel).toBeDefined();
      expect(c.ctaLabel!.length).toBeGreaterThan(0);
      expect(c.ctaHref).toBeDefined();
      expect(c.ctaHref!.length).toBeGreaterThan(0);
    }
  });
});
