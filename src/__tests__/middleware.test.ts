// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("middleware matcher", () => {
  it("includes new protected routes", async () => {
    const mod = await import("@/middleware");
    expect(mod.config.matcher).toContain("/dashboard");
    expect(mod.config.matcher).toContain("/campanhas/:path*");
    expect(mod.config.matcher).toContain("/loja");
    expect(mod.config.matcher).toContain("/conta");
  });

  it("excludes old routes (handled by next.config.ts redirects)", async () => {
    const mod = await import("@/middleware");
    expect(mod.config.matcher).not.toContain("/");
    expect(mod.config.matcher).not.toContain("/store/:path*");
    expect(mod.config.matcher).not.toContain("/campanha/:path*");
    expect(mod.config.matcher).not.toContain("/minhas-campanhas");
  });

  it("retains auth and api routes", async () => {
    const mod = await import("@/middleware");
    expect(mod.config.matcher).toContain("/login");
    expect(mod.config.matcher).toContain("/signup");
    expect(mod.config.matcher).toContain("/api/:path*");
  });
});
