// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveCanonicalOrigin,
  CANONICAL_ORIGIN,
  FALLBACK_ORIGIN,
} from "@/lib/seo/origin";

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV };
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  process.env = OLD_ENV;
});

function setProduction(rawSiteUrl: string | undefined): void {
  process.env.VERCEL_ENV = "production";
  if (rawSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = rawSiteUrl;
  }
}

function setPreview(vercelUrl: string | undefined): void {
  process.env.VERCEL_ENV = "preview";
  if (vercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = vercelUrl;
  }
}

describe("resolveCanonicalOrigin — produção confirmada", () => {
  it("origem canônica exata → valid, indexable, sem diagnostic", () => {
    setProduction("https://vendeo.tech");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBe(CANONICAL_ORIGIN);
    expect(result.status).toBe("valid");
    expect(result.indexable).toBe(true);
    expect(result.diagnostic).toBeUndefined();
  });

  it("env ausente → missing, origin null, indexable false, com diagnostic", () => {
    setProduction(undefined);
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("missing");
    expect(result.indexable).toBe(false);
    expect(result.diagnostic).toBeTruthy();
  });

  it('env vazia ("") → missing, origin null, indexable false', () => {
    setProduction("");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("missing");
    expect(result.indexable).toBe(false);
    expect(result.diagnostic).toBeTruthy();
  });

  it('"vendeo.tech" (não absoluta) → invalid, origin null', () => {
    setProduction("vendeo.tech");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("invalid");
    expect(result.indexable).toBe(false);
    expect(result.diagnostic).toBeTruthy();
  });

  it('"///" (não parseável) → invalid, origin null', () => {
    setProduction("///");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("invalid");
    expect(result.indexable).toBe(false);
  });

  it('"http://vendeo.tech" (protocolo não https) → invalid, origin null', () => {
    setProduction("http://vendeo.tech");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("invalid");
    expect(result.indexable).toBe(false);
  });

  it('"https://www.vendeo.tech" (www) → non_canonical, origin null', () => {
    setProduction("https://www.vendeo.tech");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("non_canonical");
    expect(result.indexable).toBe(false);
  });

  it('"https://beta.vendeo.tech" (alias) → non_canonical, origin null', () => {
    setProduction("https://beta.vendeo.tech");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("non_canonical");
    expect(result.indexable).toBe(false);
  });

  it('"https://vendeo.tech/loja" (caminho) → invalid, origin null', () => {
    setProduction("https://vendeo.tech/loja");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("invalid");
    expect(result.indexable).toBe(false);
  });

  it('"https://vendeo.tech?x=1" (query) → invalid, origin null', () => {
    setProduction("https://vendeo.tech?x=1");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("invalid");
    expect(result.indexable).toBe(false);
  });

  it('"https://vendeo.tech#f" (fragmento) → invalid, origin null', () => {
    setProduction("https://vendeo.tech#f");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("invalid");
    expect(result.indexable).toBe(false);
  });

  it('"https://vendeo.tech/" (barra final, forma não canônica) → non_canonical, origin null', () => {
    setProduction("https://vendeo.tech/");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBeNull();
    expect(result.status).toBe("non_canonical");
    expect(result.indexable).toBe(false);
  });
});

describe("resolveCanonicalOrigin — preview (VERCEL_ENV=preview)", () => {
  it("host de preview legítimo → origin absoluta, valid, indexable false, diagnostic", () => {
    setPreview("vendeo-git-x.vercel.app");
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBe("https://vendeo-git-x.vercel.app");
    expect(result.status).toBe("valid");
    expect(result.indexable).toBe(false);
    expect(result.origin).not.toBe(CANONICAL_ORIGIN);
    expect(result.diagnostic).toBeTruthy();
  });

  it("VERCEL_URL com a família de produção nunca emite CANONICAL_ORIGIN", () => {
    for (const raw of [
      "vendeo.tech",
      "www.vendeo.tech",
      "https://vendeo.tech",
      "user:pass@vendeo.tech",
      "vendeo.tech/loja",
    ]) {
      setPreview(raw);
      const result = resolveCanonicalOrigin();
      expect(result.origin).not.toBe(CANONICAL_ORIGIN);
      expect(result.origin).toBe(FALLBACK_ORIGIN);
      expect(result.indexable).toBe(false);
      expect(result.diagnostic).toBeTruthy();
    }
  });

  it("VERCEL_URL malformada nunca lança e cai no fallback seguro", () => {
    for (const raw of ["::::", "http://", "a b", "foo:99999", "/caminho", "host?q=1", "a_b", "x#y"]) {
      setPreview(raw);
      let result!: ReturnType<typeof resolveCanonicalOrigin>;
      expect(() => {
        result = resolveCanonicalOrigin();
      }).not.toThrow();
      expect(result.origin).toBe(FALLBACK_ORIGIN);
      expect(result.indexable).toBe(false);
      expect(result.diagnostic).toBeTruthy();
    }
  });

  it("VERCEL_URL ausente → fallback, indexable false, diagnostic", () => {
    setPreview(undefined);
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBe(FALLBACK_ORIGIN);
    expect(result.status).toBe("valid");
    expect(result.indexable).toBe(false);
    expect(result.diagnostic).toBeTruthy();
  });
});

describe("resolveCanonicalOrigin — local", () => {
  it("local (sem VERCEL_ENV e sem VERCEL_URL) → fallback, indexable false, diagnostic", () => {
    const result = resolveCanonicalOrigin();
    expect(result.origin).toBe(FALLBACK_ORIGIN);
    expect(result.status).toBe("valid");
    expect(result.indexable).toBe(false);
    expect(result.diagnostic).toBeTruthy();
  });

  it("build local (NODE_ENV=production) sem VERCEL_ENV → indexable false", () => {
    process.env.NODE_ENV = "production";
    const result = resolveCanonicalOrigin();
    expect(result.indexable).toBe(false);
  });
});

describe("resolveCanonicalOrigin — invariantes globais", () => {
  it("nunca lança, e origin é sempre null ou URL absoluta válida", () => {
    const scenarios: Array<() => void> = [
      () => {
        process.env.VERCEL_ENV = "production";
        process.env.NEXT_PUBLIC_SITE_URL = "https://vendeo.tech";
      },
      () => {
        process.env.VERCEL_ENV = "production";
      },
      () => {
        process.env.VERCEL_ENV = "production";
        process.env.NEXT_PUBLIC_SITE_URL = "///";
      },
      () => {
        process.env.VERCEL_ENV = "production";
        process.env.NEXT_PUBLIC_SITE_URL = "https://www.vendeo.tech";
      },
      () => {
        process.env.VERCEL_ENV = "preview";
        process.env.VERCEL_URL = "vendeo-git-x.vercel.app";
      },
      () => {
        process.env.VERCEL_ENV = "preview";
        process.env.VERCEL_URL = "::::";
      },
      () => {},
    ];

    for (const setup of scenarios) {
      process.env = { ...OLD_ENV };
      delete process.env.VERCEL_ENV;
      delete process.env.VERCEL_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      setup();
      let result!: ReturnType<typeof resolveCanonicalOrigin>;
      expect(() => {
        result = resolveCanonicalOrigin();
      }).not.toThrow();
      if (result.origin !== null) {
        expect(() => new URL(result.origin as string)).not.toThrow();
      }
      if (result.origin === null) {
        expect(result.indexable).toBe(false);
      }
    }
  });

  it("o diagnostic nunca ecoa o valor bruto de NEXT_PUBLIC_SITE_URL/VERCEL_URL", () => {
    process.env = { ...OLD_ENV };
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://segredo-exemplo.com";
    process.env.VERCEL_ENV = "production";
    const result = resolveCanonicalOrigin();
    expect(result.diagnostic ?? "").not.toContain("segredo-exemplo.com");
  });
});
