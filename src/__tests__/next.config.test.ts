// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const SENTINEL = "VENDEO_LAB_ISOLATED_DIST";
const LAB_DIST_DIR = "supabase/.temp/landing-lab/.next-web";
const LAB_TSCONFIG = "tsconfig.landing-lab.json";

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

type LoadedConfig = {
  distDir?: string;
  typescript?: { tsconfigPath?: string };
  redirects?: () => Promise<unknown>;
  headers?: () => Promise<unknown>;
};

const ORIGINAL_SENTINEL = process.env[SENTINEL];

async function loadConfig(): Promise<LoadedConfig> {
  vi.resetModules();
  const mod = await import("../../next.config");
  return (mod.default || mod) as LoadedConfig;
}

async function getRedirects(config: LoadedConfig) {
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

async function getHeaders(config: LoadedConfig): Promise<HeaderRule[]> {
  const fn = config.headers;
  if (typeof fn !== "function") throw new Error("headers is not a function");
  const result = await fn();
  if (!Array.isArray(result)) throw new Error("headers did not return array");
  return result as HeaderRule[];
}

const PER_ROUTE_SOURCES = ["/auth/:path*", "/api/:path*", "/docs/:path*"] as const;

afterEach(() => {
  if (ORIGINAL_SENTINEL === undefined) delete process.env[SENTINEL];
  else process.env[SENTINEL] = ORIGINAL_SENTINEL;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("next.config.ts — distDir isolado do laboratório", () => {
  beforeEach(() => {
    delete process.env[SENTINEL];
  });

  it("sem sentinel mantém comportamento padrão (sem distDir/tsconfig custom)", async () => {
    const config = await loadConfig();
    expect(config.distDir).toBeUndefined();
    expect(config.typescript?.tsconfigPath).toBeUndefined();
  });

  it("com sentinel ativa distDir e tsconfig dedicados", async () => {
    process.env[SENTINEL] = "true";
    const config = await loadConfig();
    expect(config.distDir).toBe(LAB_DIST_DIR);
    expect(config.typescript?.tsconfigPath).toBe(LAB_TSCONFIG);
  });

  it("sentinel com valor diferente não ativa o modo isolado", async () => {
    process.env[SENTINEL] = "1";
    const config = await loadConfig();
    expect(config.distDir).toBeUndefined();
    expect(config.typescript?.tsconfigPath).toBeUndefined();
  });
});

describe("next.config.ts redirects", () => {
  beforeEach(() => {
    delete process.env[SENTINEL];
  });

  it("tem 4 redirects independentes do modo do laboratório", async () => {
    const config = await loadConfig();
    expect(await getRedirects(config)).toHaveLength(4);
  });

  it("não redireciona / (landing pública)", async () => {
    const config = await loadConfig();
    const redirects = await getRedirects(config);
    expect(redirects.find((r) => r.source === "/")).toBeUndefined();
  });

  it("redirects canônicos com 301", async () => {
    const config = await loadConfig();
    const redirects = await getRedirects(config);
    const expected: Array<[string, string]> = [
      ["/minhas-campanhas", "/campanhas"],
      ["/campanha/:id", "/campanhas/:id"],
      ["/store", "/loja"],
      ["/campaign/preview", "/campanhas/nova"],
    ];
    for (const [source, destination] of expected) {
      const r = redirects.find((entry) => entry.source === source);
      expect(r, `redirect ausente: ${source}`).toBeDefined();
      expect(r!.destination).toBe(destination);
      expect(r!.statusCode).toBe(301);
    }
  });

  it("mantém os mesmos 4 redirects no modo isolado do laboratório", async () => {
    process.env[SENTINEL] = "true";
    const config = await loadConfig();
    const redirects = await getRedirects(config);
    expect(redirects).toHaveLength(4);
    expect(config.distDir).toBe(LAB_DIST_DIR);
  });
});

describe("next.config.ts headers() — X-Robots-Tag por rota (D-09)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.VERCEL_ENV;
  });

  it("publica as 3 regras fixas de noindex", async () => {
    const config = await loadConfig();
    const headers = await getHeaders(config);
    for (const source of PER_ROUTE_SOURCES) {
      const rule = headers.find((h) => h.source === source);
      expect(rule).toBeDefined();
      expect(rule!.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex" }]);
    }
  });

  it("fora de produção inclui a regra global noindex, nofollow", async () => {
    delete process.env.VERCEL_ENV;
    const config = await loadConfig();
    const headers = await getHeaders(config);
    const global = headers.find((h) => h.source === "/(.*)");
    expect(global).toBeDefined();
    expect(global!.headers).toEqual([
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ]);
  });

  it("em produção confirmada não inclui regra global e mantém as 3 por rota", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const config = await loadConfig();
    const headers = await getHeaders(config);
    expect(headers.find((h) => h.source === "/(.*)")).toBeUndefined();
    expect(headers.map((h) => h.source)).toEqual([...PER_ROUTE_SOURCES]);
  });

  it("não emite Disallow fora de produção", async () => {
    delete process.env.VERCEL_ENV;
    const config = await loadConfig();
    const headers = await getHeaders(config);
    expect(JSON.stringify(headers)).not.toMatch(/disallow/i);
  });

  it("não emite Disallow em produção confirmada", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const config = await loadConfig();
    const headers = await getHeaders(config);
    expect(JSON.stringify(headers)).not.toMatch(/disallow/i);
  });
});
