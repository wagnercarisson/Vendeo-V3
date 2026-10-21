// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MetadataRoute } from "next";

/**
 * `robots.txt` (`src/app/robots.ts`) — F51.2 / D-03 / D-07 / T-51.2-04-02/03.
 *
 * O ambiente é lido dentro da função `robots()`, então cada cenário reimporta o
 * módulo com `vi.resetModules()` + import dinâmico após reconfigurar o ambiente
 * com `vi.stubEnv(...)`.
 *
 * Regras cobertas:
 * - sob produção confirmada + origem canônica validada ⇒ sitemap absoluto e
 *   regra permissiva (`allow: "/"`);
 * - fora da condição combinada (preview, local, origem não canônica, env
 *   ausente) ⇒ **sem** `sitemap` divergente, permanecendo permissivo;
 * - nenhum ambiente emite `Disallow` (o `noindex` precisa ser legível pelo robô).
 */

const CANONICAL = "https://vendeo.tech";
const PREVIEW_URL = "vendeo-git-x.vercel.app";

function normalizeRules(
  rules: MetadataRoute.Robots["rules"],
): Array<Record<string, unknown>> {
  return (Array.isArray(rules) ? rules : [rules]) as Array<Record<string, unknown>>;
}

async function getRobots(): Promise<MetadataRoute.Robots> {
  vi.resetModules();
  const mod = await import("@/app/robots");
  return mod.default();
}

function resetEnv(): void {
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("VERCEL_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
}

beforeEach(() => {
  vi.resetModules();
  resetEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robots.ts — sitemap absoluto só sob a condição combinada (D-03/D-07)", () => {
  it("produção + origem canônica ⇒ sitemap absoluto e regra permissiva allow:/", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const result = await getRobots();

    expect(result.sitemap).toBe("https://vendeo.tech/sitemap.xml");
    expect(normalizeRules(result.rules)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: "*", allow: "/" }),
      ]),
    );
  });

  it("preview ⇒ sem propriedade sitemap e ainda permissivo", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", PREVIEW_URL);

    const result = await getRobots();

    expect(result.sitemap).toBeUndefined();
    expect(normalizeRules(result.rules).some((rule) => rule.allow === "/")).toBe(true);
  });

  it("local (VERCEL_ENV ausente) ⇒ sem sitemap e permissivo", async () => {
    const result = await getRobots();

    expect(result.sitemap).toBeUndefined();
    expect(normalizeRules(result.rules).some((rule) => rule.allow === "/")).toBe(true);
  });

  it("produção + origem www (não canônica) ⇒ sem sitemap divergente", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vendeo.tech");

    const result = await getRobots();

    expect(result.sitemap).toBeUndefined();
  });

  it("produção + NEXT_PUBLIC_SITE_URL ausente ⇒ sem sitemap", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const result = await getRobots();

    expect(result.sitemap).toBeUndefined();
  });
});

describe("robots.ts — nunca bloqueia a leitura do noindex (D-06/D-07)", () => {
  it("nenhum ambiente testado emite Disallow (produção incluída)", async () => {
    const scenarios: Array<Record<string, string>> = [
      { VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: CANONICAL },
      { VERCEL_ENV: "preview", VERCEL_URL: PREVIEW_URL },
      {},
    ];

    for (const scenario of scenarios) {
      resetEnv();
      for (const [key, value] of Object.entries(scenario)) {
        vi.stubEnv(key, value);
      }

      const result = await getRobots();
      expect(JSON.stringify(result)).not.toMatch(/disallow/i);
    }
  });

  it("nenhuma regra contém source/disallow bloqueando /login, /termos ou /docs", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const result = await getRobots();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("/login");
    expect(serialized).not.toContain("/termos");
    expect(serialized).not.toContain("/docs");

    for (const rule of normalizeRules(result.rules)) {
      expect(rule.disallow).toBeUndefined();
      expect(rule.source).toBeUndefined();
    }
  });
});
