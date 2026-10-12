// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NOINDEX_ROBOTS } from "@/lib/seo/indexation-policy";

/**
 * `sitemap.xml` (`src/app/sitemap.ts`) — F51.2 / D-08 / T-51.2-04-01/04/05.
 *
 * O ambiente é lido dentro da função `sitemap()`, então cada cenário reimporta o
 * módulo com `vi.resetModules()` + import dinâmico após reconfigurar o ambiente
 * com `vi.stubEnv(...)`.
 *
 * Cobre produção válida (apenas a home), todas as combinações fail-closed, a
 * ausência de URLs privadas/legais/parametrizadas e, num único teste
 * consolidado, a coerência fail-closed entre home (`noindex`), `robots()` (sem
 * sitemap) e `sitemap()` (vazio) sob origem não canônica.
 */

const CANONICAL = "https://vendeo.tech";
const PREVIEW_URL = "vendeo-git-x.vercel.app";

const FORBIDDEN = [
  "/api",
  "/auth",
  "/admin",
  "/termos",
  "/privacidade",
  "/uso-aceitavel",
  "/novidades",
  "/docs",
  ".md",
];

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: vi.fn(async () => ({ publicSignupEnabled: false })),
}));

vi.mock("@/lib/changelog/get-changelog", () => ({
  getAllEntries: vi.fn(async () => []),
}));

vi.mock("@/components/changelog/changelog-list", () => ({
  ChangelogList: () => null,
}));

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => null,
}));

async function getSitemap() {
  vi.resetModules();
  const mod = await import("@/app/sitemap");
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

describe("sitemap.ts — apenas a home sob a condição combinada (D-03/D-08)", () => {
  it("produção + origem canônica ⇒ exatamente 1 entrada com URL absoluta e barra final", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const entries = await getSitemap();

    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe("https://vendeo.tech/");
  });
});

describe("sitemap.ts — fail-closed em qualquer outra combinação (D-03)", () => {
  it("preview ⇒ []", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", PREVIEW_URL);

    const entries = await getSitemap();

    expect(entries).toHaveLength(0);
  });

  it("local (VERCEL_ENV ausente) ⇒ []", async () => {
    const entries = await getSitemap();

    expect(entries).toHaveLength(0);
  });

  it("build local com NODE_ENV=production e VERCEL_ENV ausente ⇒ []", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const entries = await getSitemap();

    expect(entries).toHaveLength(0);
  });

  it("produção + origem www (não canônica) ⇒ []", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vendeo.tech");

    const entries = await getSitemap();

    expect(entries).toHaveLength(0);
  });

  it("produção + origem http ⇒ []", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://vendeo.tech");

    const entries = await getSitemap();

    expect(entries).toHaveLength(0);
  });

  it("produção + NEXT_PUBLIC_SITE_URL ausente ⇒ []", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const entries = await getSitemap();

    expect(entries).toHaveLength(0);
  });
});

describe("sitemap.ts — exclusões de URLs privadas/legais/parametrizadas (T-51.2-04-01)", () => {
  it("produção válida não anuncia /api, /auth, /admin, legais, /novidades, /docs, .md nem ?", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const serialized = JSON.stringify(await getSitemap());

    for (const forbidden of FORBIDDEN) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toContain("?");
  });
});

describe("sitemap.ts — coerência fail-closed consolidada (spec / tasks.md §4.4)", () => {
  it("origem não canônica ⇒ home noindex, robots() sem sitemap e sitemap() vazio (mesmo cenário)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vendeo.tech");
    vi.resetModules();

    const [pageMod, robotsMod, sitemapMod] = await Promise.all([
      import("@/app/page"),
      import("@/app/robots"),
      import("@/app/sitemap"),
    ]);

    // (a) metadata da home resolve para noindex.
    expect(pageMod.metadata.robots).toEqual(NOINDEX_ROBOTS);

    // (b) robots() não referencia nenhum sitemap.
    expect(robotsMod.default().sitemap).toBeUndefined();

    // (c) sitemap() retorna lista vazia.
    expect(sitemapMod.default()).toHaveLength(0);
  });
});
