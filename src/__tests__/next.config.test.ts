// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("next.config.ts redirects", () => {
  it("has 5 redirect entries", async () => {
    const mod = await import("../../next.config");
    const config = mod.default || mod;
    const redirects = await config.redirects();
    expect(redirects).toHaveLength(5);
  });

  it("redirects / to /dashboard with 301", async () => {
    const mod = await import("../../next.config");
    const config = mod.default || mod;
    const redirects = await config.redirects();
    const rootRedirect = redirects.find(
      (r: { source: string }) => r.source === "/",
    );
    expect(rootRedirect).toBeDefined();
    expect(rootRedirect.destination).toBe("/dashboard");
    expect(rootRedirect.statusCode).toBe(301);
  });

  it("redirects /minhas-campanhas to /campanhas with 301", async () => {
    const mod = await import("../../next.config");
    const config = mod.default || mod;
    const redirects = await config.redirects();
    const r = redirects.find(
      (r: { source: string }) => r.source === "/minhas-campanhas",
    );
    expect(r).toBeDefined();
    expect(r.destination).toBe("/campanhas");
    expect(r.statusCode).toBe(301);
  });

  it("redirects /campanha/:id to /campanhas/:id with 301", async () => {
    const mod = await import("../../next.config");
    const config = mod.default || mod;
    const redirects = await config.redirects();
    const r = redirects.find(
      (r: { source: string }) => r.source === "/campanha/:id",
    );
    expect(r).toBeDefined();
    expect(r.destination).toBe("/campanhas/:id");
    expect(r.statusCode).toBe(301);
  });

  it("redirects /store to /loja with 301", async () => {
    const mod = await import("../../next.config");
    const config = mod.default || mod;
    const redirects = await config.redirects();
    const r = redirects.find(
      (r: { source: string }) => r.source === "/store",
    );
    expect(r).toBeDefined();
    expect(r.destination).toBe("/loja");
    expect(r.statusCode).toBe(301);
  });

  it("redirects /campaign/preview to /campanhas/nova with 301", async () => {
    const mod = await import("../../next.config");
    const config = mod.default || mod;
    const redirects = await config.redirects();
    const r = redirects.find(
      (r: { source: string }) => r.source === "/campaign/preview",
    );
    expect(r).toBeDefined();
    expect(r.destination).toBe("/campanhas/nova");
    expect(r.statusCode).toBe(301);
  });
});
