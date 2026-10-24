import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveSupabaseEndpointForEnvironment,
  VisualSignatureEnvironmentError,
} from "../local-validation/environment-contract";
import {
  assertVisualSignatureEnvironmentIdentity,
  assertVisualSignatureValidationEnvironment,
  resolveVisualSignatureEnvironment,
  VisualSignatureValidationGuardError,
} from "../local-validation/guard";

describe("F47.2 — contrato de ambiente", () => {
  it("local continua exigindo loopback", () => {
    expect(
      resolveSupabaseEndpointForEnvironment("http://127.0.0.1:57781", "local_validation"),
    ).toMatchObject({ host: "127.0.0.1", port: "57781" });
  });

  it("produção exige ref canônico", () => {
    expect(
      resolveSupabaseEndpointForEnvironment(
        "https://abc123.supabase.co",
        "production",
        "abc123",
      ).origin,
    ).toBe("https://abc123.supabase.co");
    expect(() =>
      resolveSupabaseEndpointForEnvironment(
        "https://outro.supabase.co",
        "production",
        "abc123",
      ),
    ).toThrow(VisualSignatureEnvironmentError);
    expect(() =>
      resolveSupabaseEndpointForEnvironment(
        "http://abc123.supabase.co",
        "production",
        "abc123",
      ),
    ).toThrow(VisualSignatureEnvironmentError);
  });

  it("preview é sempre recusado", () => {
    expect(() => resolveVisualSignatureEnvironment({ VERCEL_ENV: "preview" })).toThrow(
      VisualSignatureValidationGuardError,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("produção é selecionada apenas por VERCEL_ENV", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(resolveVisualSignatureEnvironment({ VERCEL_ENV: "production" })).toBe("production");
    vi.stubEnv("VENDEO_VS_VALIDATION_ENABLED", "");
    expect(() => assertVisualSignatureValidationEnvironment()).toThrow(/production_endpoint_invalid/);
  });

  it("deriva ref e aceita URLs Supabase concordantes em HTTPS", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VENDEO_VS_VALIDATION_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc123.supabase.co");
    vi.stubEnv("SUPABASE_URL", "https://abc123.supabase.co");
    vi.stubEnv("OPENAI_API_KEY", "shared-key");
    expect(assertVisualSignatureEnvironmentIdentity()).toMatchObject({
      environment: "production",
      instanceIdentity: "abc123",
      supabaseOrigin: "https://abc123.supabase.co",
    });
    expect(assertVisualSignatureValidationEnvironment().apiKey).toBe("shared-key");
  });

  it("recusa endpoints de produção divergentes ou sem HTTPS", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VENDEO_VS_VALIDATION_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc123.supabase.co");
    vi.stubEnv("SUPABASE_URL", "https://other.supabase.co");
    expect(() => assertVisualSignatureEnvironmentIdentity()).toThrow(/production_endpoint_invalid/);
    vi.stubEnv("SUPABASE_URL", "http://abc123.supabase.co");
    expect(() => assertVisualSignatureEnvironmentIdentity()).toThrow(/production_endpoint_invalid/);
  });
});
