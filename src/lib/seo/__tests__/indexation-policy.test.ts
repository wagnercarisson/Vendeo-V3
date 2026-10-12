// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  getSurfacePolicy,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  HOME_CANONICAL_PATH,
  NOINDEX_TAG,
  NOINDEX_TAG_GLOBAL,
} from "@/lib/seo/indexation-policy";

describe("indexation-policy — constantes", () => {
  it("INDEX_ROBOTS é o objeto { index: true, follow: true }", () => {
    expect(INDEX_ROBOTS).toEqual({ index: true, follow: true });
    expect(typeof INDEX_ROBOTS).toBe("object");
  });

  it("NOINDEX_ROBOTS é o objeto { index: false, follow: false }", () => {
    expect(NOINDEX_ROBOTS).toEqual({ index: false, follow: false });
    expect(typeof NOINDEX_ROBOTS).toBe("object");
  });

  it("HOME_CANONICAL_PATH é '/'", () => {
    expect(HOME_CANONICAL_PATH).toBe("/");
  });

  it("NOINDEX_TAG e NOINDEX_TAG_GLOBAL são as fontes dos valores de X-Robots-Tag", () => {
    expect(NOINDEX_TAG).toBe("noindex");
    expect(NOINDEX_TAG_GLOBAL).toBe("noindex, nofollow");
  });
});

const NOINDEX_SURFACES = [
  // auth
  "/login",
  "/signup",
  "/check-email",
  "/forgot-password",
  "/update-password",
  // app / admin
  "/dashboard",
  "/loja",
  "/campanhas",
  "/campanhas/nova",
  "/conta",
  "/novidades",
  "/legal/reaccept",
  "/cadastro",
  "/cadastro/cnpj",
  "/admin",
  "/admin/users",
  // legal
  "/termos",
  "/privacidade",
  "/uso-aceitavel",
  // transient / markdown
  "/auth/confirm",
  "/auth/callback",
  "/auth/signout",
  "/api/anything",
  "/docs/legal/terms-of-service-v1-4.md",
  // default fail-closed
  "/rota-nova",
  // normalização de barra final
  "/termos/",
];

describe("getSurfacePolicy — superfícies noindex (fail-closed)", () => {
  for (const surface of NOINDEX_SURFACES) {
    it(`"${surface}" → NOINDEX_ROBOTS e fora do sitemap`, () => {
      const policy = getSurfacePolicy(surface);
      expect(policy.robots).toEqual(NOINDEX_ROBOTS);
      expect(typeof policy.robots).toBe("object");
      expect(policy.inSitemap).toBe(false);
    });
  }
});

describe("getSurfacePolicy — home (única exceção)", () => {
  it('"/" → INDEX_ROBOTS e no sitemap', () => {
    const policy = getSurfacePolicy("/");
    expect(policy.robots).toEqual(INDEX_ROBOTS);
    expect(policy.inSitemap).toBe(true);
  });

  it('"/?utm=1" (query ignorada) → política da home', () => {
    const policy = getSurfacePolicy("/?utm=1");
    expect(policy.robots).toEqual(INDEX_ROBOTS);
    expect(policy.inSitemap).toBe(true);
  });

  it('"/#acesso" (fragmento ignorado) → política da home', () => {
    const policy = getSurfacePolicy("/#acesso");
    expect(policy.robots).toEqual(INDEX_ROBOTS);
    expect(policy.inSitemap).toBe(true);
  });
});
