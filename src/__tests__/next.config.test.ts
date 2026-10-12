// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/** Invoca `headers()` do `next.config.ts` (que lê o ambiente no momento da chamada). */
async function getHeaders(): Promise<HeaderRule[]> {
  const mod = await import("../../next.config");
  const config: { headers?: () => Promise<unknown> } = mod.default || mod;
  const fn = config.headers;
  if (typeof fn !== "function") throw new Error("headers is not a function");
  const result = await fn();
  if (!Array.isArray(result)) throw new Error("headers did not return array");
  return result as HeaderRule[];
}

const PER_ROUTE_SOURCES = ["/auth/:path*", "/api/:path*", "/docs/:path*"] as const;

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

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

describe("next.config.ts headers() — X-Robots-Tag por rota (D-09)", () => {
  it("publica as 3 regras fixas de noindex", async () => {
    const headers = await getHeaders();
    for (const source of PER_ROUTE_SOURCES) {
      const rule = headers.find((h) => h.source === source);
      expect(rule).toBeDefined();
      expect(rule!.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex" }]);
    }
  });
});

describe("next.config.ts headers() — regra global só fora de produção confirmada (D-03/D-06)", () => {
  it("fora de produção (VERCEL_ENV ausente) inclui a regra global noindex, nofollow", async () => {
    delete process.env.VERCEL_ENV;
    vi.resetModules();

    const headers = await getHeaders();
    const global = headers.find((h) => h.source === "/(.*)");
    expect(global).toBeDefined();
    expect(global!.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
  });

  it("em produção confirmada não inclui regra global e mantém as 3 por rota", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.resetModules();

    const headers = await getHeaders();
    expect(headers.find((h) => h.source === "/(.*)")).toBeUndefined();
    expect(headers.map((h) => h.source)).toEqual([...PER_ROUTE_SOURCES]);
  });
});

describe("next.config.ts headers() — nunca emite Disallow (D-06/D-07)", () => {
  it("não emite Disallow fora de produção", async () => {
    delete process.env.VERCEL_ENV;
    vi.resetModules();

    const headers = await getHeaders();
    expect(JSON.stringify(headers)).not.toMatch(/disallow/i);
  });

  it("não emite Disallow em produção confirmada", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.resetModules();

    const headers = await getHeaders();
    expect(JSON.stringify(headers)).not.toMatch(/disallow/i);
  });
});
