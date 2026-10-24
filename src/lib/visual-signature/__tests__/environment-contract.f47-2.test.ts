import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveSupabaseEndpointForEnvironment,
  VisualSignatureEnvironmentError,
} from "../local-validation/environment-contract";
import {
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

  it("produção exige declaração e habilitação", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VISUAL_SIGNATURE_OPERATING_ENVIRONMENT", "production");
    vi.stubEnv("VENDEO_VS_PRODUCTION_ENABLED", "");
    expect(() => assertVisualSignatureValidationEnvironment()).toThrow(
      /visual_signature_production_disabled/,
    );
  });
});
