// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Metadata } from "next";
import {
  HOME_TITLE,
  HOME_DESCRIPTION,
  SHARE_IMAGE_PATH,
  SHARE_IMAGE_WIDTH,
  SHARE_IMAGE_HEIGHT,
} from "@/lib/seo/home-metadata";
import {
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  HOME_CANONICAL_PATH,
} from "@/lib/seo/indexation-policy";

/**
 * Metadata da home (`src/app/page.tsx`).
 *
 * `robots` é computado no **carregamento do módulo** (`indexable =
 * isIndexableEnvironment()` roda no import), então cada cenário de ambiente
 * reimporta o módulo com `vi.resetModules()` + import dinâmico após
 * reconfigurar o ambiente com `vi.stubEnv(...)`.
 *
 * Mocks: apenas dependências irrelevantes para a metadata (flag de launch,
 * fonte do changelog e o GoogleButton, que puxaria o cliente Supabase browser).
 */

const OLD_TITLE = "Vendeo — Campanhas profissionais para sua loja";
const CANONICAL = "https://vendeo.tech";

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

async function loadPage(): Promise<{ metadata: Metadata; default: unknown }> {
  const mod = await import("@/app/page");
  return { metadata: mod.metadata, default: mod.default };
}

async function loadMetadataBase(): Promise<URL> {
  const layout = await import("@/app/layout");
  return layout.metadata.metadataBase as URL;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("VERCEL_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("page.tsx — metadata aprovada da home (D-04)", () => {
  it("title e description exatos", async () => {
    const { metadata } = await loadPage();
    expect(metadata.title).toBe(HOME_TITLE);
    expect(metadata.description).toBe(HOME_DESCRIPTION);
  });

  it("substitui a metadata antiga e preserva o componente Home", async () => {
    const { metadata, default: Home } = await loadPage();
    expect(typeof Home).toBe("function");
    expect(JSON.stringify(metadata)).not.toContain(OLD_TITLE);
    expect(metadata.title).toBe(HOME_TITLE);
  });
});

describe("page.tsx — canonical e OG/Twitter absolutos (D-05)", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);
    vi.resetModules();
  });

  it("canonical resolve para https://vendeo.tech/ via metadataBase da raiz", async () => {
    const { metadata } = await loadPage();
    const metadataBase = await loadMetadataBase();
    expect(metadataBase.href).toBe("https://vendeo.tech/");

    const alternates = metadata.alternates as { canonical?: string };
    expect(alternates.canonical).toBe(HOME_CANONICAL_PATH);
    expect(new URL(alternates.canonical as string, metadataBase).href).toBe(
      "https://vendeo.tech/",
    );
  });

  it("openGraph com type/locale/siteName/url absoluta e imagem 1200×630", async () => {
    const { metadata } = await loadPage();
    const metadataBase = await loadMetadataBase();

    const og = metadata.openGraph as {
      type?: string;
      locale?: string;
      siteName?: string;
      url?: string;
      images?: Array<{
        url: string;
        width?: number;
        height?: number;
        alt?: string;
      }>;
    };

    expect(og.type).toBe("website");
    expect(og.locale).toBe("pt_BR");
    expect(og.siteName).toBe("Vendeo");
    expect(new URL(og.url as string, metadataBase).href).toBe(
      "https://vendeo.tech/",
    );

    const image = og.images?.[0];
    expect(image).toBeDefined();
    expect(new URL(image!.url, metadataBase).href).toBe(
      `https://vendeo.tech${SHARE_IMAGE_PATH}`,
    );
    expect(image!.width).toBe(1200);
    expect(image!.height).toBe(630);
    expect(SHARE_IMAGE_WIDTH).toBe(1200);
    expect(SHARE_IMAGE_HEIGHT).toBe(630);
  });

  it("twitter é summary_large_image com imagem absoluta", async () => {
    const { metadata } = await loadPage();
    const metadataBase = await loadMetadataBase();

    const twitter = metadata.twitter as {
      card?: string;
      images?: Array<string | { url: string }>;
    };

    expect(twitter.card).toBe("summary_large_image");
    const first = twitter.images?.[0];
    const raw = typeof first === "string" ? first : first?.url;
    expect(raw).toBeDefined();
    expect(new URL(raw as string, metadataBase).href).toBe(
      `https://vendeo.tech${SHARE_IMAGE_PATH}`,
    );
  });
});

describe("page.tsx — exceção de robots só sob condição combinada (D-03/D-06)", () => {
  it("produção confirmada + origem válida ⇒ INDEX_ROBOTS", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);
    vi.resetModules();
    const { metadata } = await loadPage();
    expect(metadata.robots).toEqual(INDEX_ROBOTS);
  });

  it("preview ⇒ NOINDEX_ROBOTS", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "vendeo-git-x.vercel.app");
    vi.resetModules();
    const { metadata } = await loadPage();
    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
  });

  it("local (sem VERCEL_ENV) ⇒ NOINDEX_ROBOTS", async () => {
    vi.resetModules();
    const { metadata } = await loadPage();
    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
  });

  it("produção com origem inválida ⇒ NOINDEX_ROBOTS", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vendeo.tech");
    vi.resetModules();
    const { metadata } = await loadPage();
    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
  });
});
