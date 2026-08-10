// @vitest-environment node
import { describe, it, expect } from "vitest";

async function getRedirects() {
  const mod = await import("../../next.config");
  const config: { redirects?: () => Promise<unknown> } = mod.default || mod;
  const fn = config.redirects;
  if (typeof fn !== "function") throw new Error("redirects is not a function");
  const result = await fn();
  if (!Array.isArray(result)) throw new Error("redirects did not return array");
  return result as Array<{
    source: string;
    destination: string;
    statusCode: number;
  }>;
}

describe("next.config.ts redirects", () => {
  it("has 4 redirect entries", async () => {
    const redirects = await getRedirects();
    expect(redirects).toHaveLength(4);
  });

  it("does not redirect / (landing pública)", async () => {
    const redirects = await getRedirects();
    expect(redirects.find((r) => r.source === "/")).toBeUndefined();
  });

  it("redirects /minhas-campanhas to /campanhas with 301", async () => {
    const redirects = await getRedirects();
    const r = redirects.find((r) => r.source === "/minhas-campanhas")!;
    expect(r.destination).toBe("/campanhas");
    expect(r.statusCode).toBe(301);
  });

  it("redirects /campanha/:id to /campanhas/:id with 301", async () => {
    const redirects = await getRedirects();
    const r = redirects.find((r) => r.source === "/campanha/:id")!;
    expect(r.destination).toBe("/campanhas/:id");
    expect(r.statusCode).toBe(301);
  });

  it("redirects /store to /loja with 301", async () => {
    const redirects = await getRedirects();
    const r = redirects.find((r) => r.source === "/store")!;
    expect(r.destination).toBe("/loja");
    expect(r.statusCode).toBe(301);
  });

  it("redirects /campaign/preview to /campanhas/nova with 301", async () => {
    const redirects = await getRedirects();
    const r = redirects.find((r) => r.source === "/campaign/preview")!;
    expect(r.destination).toBe("/campanhas/nova");
    expect(r.statusCode).toBe(301);
  });
});
