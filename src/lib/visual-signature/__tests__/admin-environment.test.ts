// @vitest-environment node
// F47.3-lh9 — ambiente/identidade administrativa da Assinatura Visual.
// Fail-closed, derivado de NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL. Sem rede.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  resolveVisualSignatureAdminEnvironment,
  VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_INVALID,
  VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_MISSING,
} from "../admin-environment";

const originalNextPublic = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabase = process.env.SUPABASE_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
});

afterEach(() => {
  if (originalNextPublic === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalNextPublic;
  if (originalSupabase === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabase;
});

describe("resolveVisualSignatureAdminEnvironment", () => {
  it("localhost:54321 → local_validation com identidade host:porta", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    expect(resolveVisualSignatureAdminEnvironment()).toEqual({
      environmentScope: "local_validation",
      instanceIdentity: "localhost:54321",
    });
  });

  it("homolog local 127.0.0.1:57781 → local_validation", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:57781";
    expect(resolveVisualSignatureAdminEnvironment()).toEqual({
      environmentScope: "local_validation",
      instanceIdentity: "127.0.0.1:57781",
    });
  });

  it("supabase.co remoto → production com identidade host", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co";
    expect(resolveVisualSignatureAdminEnvironment()).toEqual({
      environmentScope: "production",
      instanceIdentity: "abcd.supabase.co",
    });
  });

  it("fallback usa SUPABASE_URL quando NEXT_PUBLIC_SUPABASE_URL está ausente", () => {
    process.env.SUPABASE_URL = "https://fallback.supabase.co";
    expect(resolveVisualSignatureAdminEnvironment().instanceIdentity).toBe(
      "fallback.supabase.co",
    );
  });

  it("NEXT_PUBLIC_SUPABASE_URL tem precedência sobre SUPABASE_URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://next-public.supabase.co";
    process.env.SUPABASE_URL = "https://server-only.supabase.co";
    expect(resolveVisualSignatureAdminEnvironment().instanceIdentity).toBe(
      "next-public.supabase.co",
    );
  });

  it.each([
    ["ausente", undefined],
    ["vazia", "   "],
  ])("URL %s lança config_missing", (_label, value) => {
    if (value !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = value;
    expect(() => resolveVisualSignatureAdminEnvironment()).toThrowError(
      VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_MISSING,
    );
    try {
      resolveVisualSignatureAdminEnvironment();
    } catch (error) {
      expect((error as { code?: string }).code).toBe(
        VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_MISSING,
      );
    }
  });

  it.each([
    ["URL inválida", "not a url"],
    ["sem host", "file:///tmp/supabase"],
  ])("%s lança config_invalid (fail-closed)", (_label, value) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = value;
    expect(() => resolveVisualSignatureAdminEnvironment()).toThrowError(
      VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_INVALID,
    );
    try {
      resolveVisualSignatureAdminEnvironment();
    } catch (error) {
      expect((error as { code?: string }).code).toBe(
        VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_INVALID,
      );
    }
  });

  it("IPv6 loopback [::1] → local_validation", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://[::1]:54321";
    expect(resolveVisualSignatureAdminEnvironment().environmentScope).toBe(
      "local_validation",
    );
  });

  it("módulo é server-only e NÃO importa product-1-1", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/visual-signature/admin-environment.ts"),
      "utf8",
    );
    expect(source).toMatch(/server-only/);
    expect(source).not.toMatch(/product-1-1/);
  });
});
