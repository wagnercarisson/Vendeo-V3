// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Metadata, Viewport } from "next";

/**
 * Matriz de metadata/robots da raiz (`src/app/layout.tsx`).
 *
 * `metadataBase` e `robots` são computados no **carregamento do módulo**, então
 * cada cenário de ambiente reimporta o módulo com `vi.resetModules()` + import
 * dinâmico após reconfigurar o ambiente com `vi.stubEnv(...)`.
 */

const PRESERVED_ICONS = {
  icon: [
    { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [
    { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  ],
};

let warnSpy: ReturnType<typeof vi.spyOn>;

async function loadLayout(): Promise<{ metadata: Metadata; viewport: Viewport }> {
  const mod = await import("@/app/layout");
  return { metadata: mod.metadata, viewport: mod.viewport };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("VERCEL_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("layout.tsx — metadataBase por ambiente (D-02)", () => {
  it("produção + NEXT_PUBLIC_SITE_URL canônica ⇒ href exatamente https://vendeo.tech/", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vendeo.tech");
    vi.resetModules();

    const { metadata } = await loadLayout();
    expect(metadata.metadataBase).toBeInstanceOf(URL);
    expect((metadata.metadataBase as URL).href).toBe("https://vendeo.tech/");
  });

  it("produção + origem não canônica (www) nunca emite a família de produção", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vendeo.tech");
    vi.resetModules();

    const { metadata } = await loadLayout();
    const href = (metadata.metadataBase as URL).href;
    expect(href).not.toContain("vendeo.tech");
    expect(href).toBe("http://localhost:3000/");
  });

  it("preview + VERCEL_URL usa o host de preview (nunca canonical de produção)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "vendeo-git-x.vercel.app");
    vi.resetModules();

    const { metadata } = await loadLayout();
    expect(metadata.metadataBase).toBeInstanceOf(URL);
    expect((metadata.metadataBase as URL).host).toBe("vendeo-git-x.vercel.app");
  });

  it("local (sem VERCEL_ENV) cai no fallback seguro", async () => {
    vi.resetModules();
    const { metadata } = await loadLayout();
    expect((metadata.metadataBase as URL).href).toBe("http://localhost:3000/");
  });
});

describe("layout.tsx — default noindex na raiz (D-06)", () => {
  it("robots é { index: false, follow: false } por default", async () => {
    const { metadata } = await loadLayout();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("layout.tsx — metadata preservada (nada removido)", () => {
  it("title/description/manifest/appleWebApp/icons permanecem iguais", async () => {
    const { metadata } = await loadLayout();
    expect(metadata.title).toBe("Vendeo");
    expect(metadata.description).toBe("Motor de geração de campanhas profissionais");
    expect(metadata.manifest).toBe("/manifest.webmanifest");
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Vendeo",
    });
    expect(metadata.icons).toEqual(PRESERVED_ICONS);
  });

  it("viewport permanece width=device-width, initialScale=1, themeColor #0F172A", async () => {
    const { viewport } = await loadLayout();
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.themeColor).toBe("#0F172A");
  });
});

describe("layout.tsx — diagnóstico observável (console.warn)", () => {
  it("emite exatamente um aviso quando a origem de produção é inválida", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vendeo.tech");
    vi.resetModules();
    warnSpy.mockClear();

    await loadLayout();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0]?.[0] ?? "");
    expect(message).toContain("[seo/layout]");
    // Nunca ecoa o valor bruto da env.
    expect(message).not.toContain("www.vendeo.tech");
  });

  it("não emite aviso quando a origem de produção é válida", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vendeo.tech");
    vi.resetModules();
    warnSpy.mockClear();

    await loadLayout();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
