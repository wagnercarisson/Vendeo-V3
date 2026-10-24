import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOCAL_SUPABASE_HOSTS,
  VISUAL_SIGNATURE_LOCAL_ERRORS,
  VisualSignatureLocalEnvironmentError,
  assertLocalPostgresEndpoint,
  assertLocalSupabaseEndpoint,
  evaluateLocalValidationStage,
  resolveLocalSupabaseEndpoints,
} from "../local-validation/environment-contract";

function captureCode(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof VisualSignatureLocalEnvironmentError) {
      return error.code;
    }
    throw error;
  }
  throw new Error("esperado erro de ambiente local, nenhum foi lançado");
}

describe("F47.1 — contrato puro de endpoint local (D5)", () => {
  it("aceita os três hosts loopback com porta explícita", () => {
    for (const host of LOCAL_SUPABASE_HOSTS) {
      const url = host === "::1" ? "http://[::1]:57781" : `http://${host}:57781`;
      const endpoint = assertLocalSupabaseEndpoint(url);
      expect(endpoint.host).toBe(host);
      expect(endpoint.port).toBe("57781");
      expect(endpoint.origin).toBe(url);
    }
  });

  it("normaliza origin para comparação exata", () => {
    expect(assertLocalSupabaseEndpoint("HTTP://LOCALHOST:57781/").origin).toBe(
      "http://localhost:57781",
    );
    expect(assertLocalSupabaseEndpoint("http://127.0.0.1:57781/rest/v1").origin).toBe(
      "http://127.0.0.1:57781",
    );
    expect(assertLocalSupabaseEndpoint("http://[::1]:57781").origin).toBe(
      "http://[::1]:57781",
    );
  });

  it("recusa URL ausente, inválida, sem porta e não-http", () => {
    expect(captureCode(() => assertLocalSupabaseEndpoint(""))).toBe(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_missing,
    );
    expect(captureCode(() => assertLocalSupabaseEndpoint("not-a-url"))).toBe(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_invalid,
    );
    expect(captureCode(() => assertLocalSupabaseEndpoint("http://127.0.0.1"))).toBe(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_invalid,
    );
    expect(
      captureCode(() => assertLocalSupabaseEndpoint("postgresql://127.0.0.1:57782/postgres")),
    ).toBe(VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_invalid);
  });

  it("recusa host remoto (Supabase/Vercel/project ref) mesmo com identidade coincidente", () => {
    for (const url of [
      "https://abcdefghijklmno.supabase.co",
      "https://vendeo.vercel.app",
      "https://supabase.co:443",
      "https://vendeo-prod.supabase.co:443",
      "http://10.0.0.5:57781",
      "http://192.168.0.10:57781",
      "http://example.com:57781",
    ]) {
      expect(captureCode(() => assertLocalSupabaseEndpoint(url))).toBe(
        VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_not_loopback,
      );
    }
  });

  it("recusa credenciais embutidas na URL", () => {
    expect(
      captureCode(() => assertLocalSupabaseEndpoint("http://user:secret@127.0.0.1:57781")),
    ).toBe(VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_credentials_forbidden);
  });

  it("aceita URL secundária no mesmo origin e recusa origin divergente", () => {
    expect(
      resolveLocalSupabaseEndpoints(
        "http://127.0.0.1:57781",
        "http://127.0.0.1:57781/rest/v1",
      ).origin,
    ).toBe("http://127.0.0.1:57781");

    expect(
      captureCode(() =>
        resolveLocalSupabaseEndpoints(
          "http://127.0.0.1:57781",
          "http://127.0.0.1:57782",
        ),
      ),
    ).toBe(VISUAL_SIGNATURE_LOCAL_ERRORS.endpoints_origin_mismatch);

    expect(
      captureCode(() =>
        resolveLocalSupabaseEndpoints("http://127.0.0.1:57781", "http://localhost:57781"),
      ),
    ).toBe(VISUAL_SIGNATURE_LOCAL_ERRORS.endpoints_origin_mismatch);
  });

  it("pre-migration permite Luna ausente; post-migration exige Luna ativo", () => {
    const lunaAbsent = { gpt55Present: true, lunaPresent: false, lunaIntegrityOk: false };
    expect(evaluateLocalValidationStage("pre-migration", lunaAbsent)).toEqual({
      ok: true,
      failures: [],
    });
    expect(evaluateLocalValidationStage("post-migration", lunaAbsent)).toEqual({
      ok: false,
      failures: ["luna_catalog_missing_after_migration"],
    });

    const lunaActive = { gpt55Present: true, lunaPresent: true, lunaIntegrityOk: true };
    expect(evaluateLocalValidationStage("pre-migration", lunaActive).ok).toBe(true);
    expect(evaluateLocalValidationStage("post-migration", lunaActive).ok).toBe(true);

    const lunaDivergent = { gpt55Present: true, lunaPresent: true, lunaIntegrityOk: false };
    expect(evaluateLocalValidationStage("pre-migration", lunaDivergent)).toEqual({
      ok: false,
      failures: ["luna_catalog_divergent"],
    });
    expect(evaluateLocalValidationStage("post-migration", lunaDivergent).failures).toEqual([
      "luna_catalog_divergent",
      "luna_catalog_missing_after_migration",
    ]);

    expect(
      evaluateLocalValidationStage("post-migration", {
        gpt55Present: false,
        lunaPresent: true,
        lunaIntegrityOk: true,
      }).failures,
    ).toContain("gpt_5_5_catalog_missing");
  });

  it("valida o destino Postgres antes da conexão: loopback + porta esperada", () => {
    expect(
      assertLocalPostgresEndpoint(
        "postgresql://postgres:secret@127.0.0.1:57782/postgres",
        "57782",
      ),
    ).toEqual({ host: "127.0.0.1", port: "57782" });

    expect(
      captureCode(() =>
        assertLocalPostgresEndpoint(
          "postgresql://postgres:secret@db.example.supabase.co:57782/postgres",
          "57782",
        ),
      ),
    ).toBe(VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_not_loopback);

    expect(
      captureCode(() =>
        assertLocalPostgresEndpoint(
          "postgresql://postgres:secret@127.0.0.1:54322/postgres",
          "57782",
        ),
      ),
    ).toBe(VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_port_mismatch);

    expect(captureCode(() => assertLocalPostgresEndpoint("", "57782"))).toBe(
      VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_missing,
    );
    expect(
      captureCode(() => assertLocalPostgresEndpoint("mysql://127.0.0.1:57782/db", "57782")),
    ).toBe(VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_invalid);
  });

  it("é módulo puro: não importa server-only, não lê env e não declara porta de API/DB", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/visual-signature/local-validation/environment-contract.ts",
      ),
      "utf8",
    );
    const active = source
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
      .join("\n");
    expect(active).not.toMatch(/from\s+["']server-only["']/);
    expect(active).not.toMatch(/process\.env/);
    expect(active).not.toMatch(/API_PORT|DB_PORT|57781|57782/);
  });
});
