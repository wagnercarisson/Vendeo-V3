// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isIndexableEnvironment,
  isProductionConfirmed,
  getEnvironmentDiagnostic,
} from "@/lib/seo/environment";

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

describe("isProductionConfirmed", () => {
  it("true somente quando VERCEL_ENV === 'production'", () => {
    process.env.VERCEL_ENV = "production";
    expect(isProductionConfirmed()).toBe(true);
  });

  it("false em preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isProductionConfirmed()).toBe(false);
  });

  it("false quando VERCEL_ENV está ausente", () => {
    expect(isProductionConfirmed()).toBe(false);
  });
});

describe("isIndexableEnvironment — fail-closed", () => {
  it("true somente com produção confirmada E origem canônica válida", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://vendeo.tech";
    expect(isIndexableEnvironment()).toBe(true);
  });

  it("false em produção com origem ausente", () => {
    process.env.VERCEL_ENV = "production";
    expect(isIndexableEnvironment()).toBe(false);
  });

  it("false em produção com origem inválida", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "http://vendeo.tech";
    expect(isIndexableEnvironment()).toBe(false);
  });

  it("false em produção com origem não canônica", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.vendeo.tech";
    expect(isIndexableEnvironment()).toBe(false);
  });

  it("false em preview, mesmo com origem válida configurada", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "vendeo-git-x.vercel.app";
    process.env.NEXT_PUBLIC_SITE_URL = "https://vendeo.tech";
    expect(isIndexableEnvironment()).toBe(false);
  });

  it("false em local (sem VERCEL_ENV)", () => {
    expect(isIndexableEnvironment()).toBe(false);
  });

  it("false em build local com NODE_ENV=production e VERCEL_ENV ausente", () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    expect(isIndexableEnvironment()).toBe(false);
  });

  it("nunca lança", () => {
    expect(() => isIndexableEnvironment()).not.toThrow();
  });
});

describe("getEnvironmentDiagnostic", () => {
  it("retorna string não vazia quando VERCEL_ENV está ausente", () => {
    const diagnostic = getEnvironmentDiagnostic();
    expect(typeof diagnostic).toBe("string");
    expect((diagnostic ?? "").length).toBeGreaterThan(0);
  });

  it("retorna string não vazia quando VERCEL_ENV está vazio", () => {
    process.env.VERCEL_ENV = "";
    const diagnostic = getEnvironmentDiagnostic();
    expect((diagnostic ?? "").length).toBeGreaterThan(0);
  });

  it("retorna null quando VERCEL_ENV está definido", () => {
    process.env.VERCEL_ENV = "production";
    expect(getEnvironmentDiagnostic()).toBeNull();
  });
});
