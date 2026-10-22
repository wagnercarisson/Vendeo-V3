// @vitest-environment node
/**
 * F47.1 — testes negativos do precheck de UAT.
 *
 * O isolamento é avaliado ANTES de preflight/psql. Com URL remota/missing, o
 * script deve falhar fechado sem conectar ao banco e sem chamar provider.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(process.cwd(), "scripts/f47-1/run-uat-precheck.ps1");

function runPrecheck(overrides: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VENDEO_VS_VALIDATION_ENABLED: "1",
    VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE: "127.0.0.1:57781",
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-File", script, "-Mode", "initial"],
    { env, encoding: "utf8", timeout: 120_000 },
  );
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

describe("F47.1 — precheck falha fechado no isolamento", () => {
  it("recusa URL remota sem substituir a env e sem executar psql", { timeout: 30_000 }, () => {
    const result = runPrecheck({
      NEXT_PUBLIC_SUPABASE_URL: "https://remote-project.supabase.co",
      SUPABASE_URL: "https://remote-project.supabase.co",
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('"readiness":"isolation_failed"');
    expect(result.output).toContain('"database_connection_attempted":false');
    expect(result.output).not.toContain("migration autorada no ledger local");
  });

  it("recusa URLs ausentes sem executar preflight/psql", { timeout: 30_000 }, () => {
    const result = runPrecheck({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_URL: undefined,
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('"readiness":"isolation_failed"');
    expect(result.output).toContain("URLs originais");
    expect(result.output).not.toContain("migration autorada no ledger local");
  });

  it("não contém atribuição que substitua as URLs originais", () => {
    const source = readFileSync(script, "utf8");
    expect(source).not.toMatch(/\$env:NEXT_PUBLIC_SUPABASE_URL\s*=/);
    expect(source).not.toMatch(/\$env:SUPABASE_URL\s*=/);
    expect(source.indexOf('readiness = "isolation_failed"')).toBeLessThan(
      source.indexOf("$ledger = Invoke-Psql"),
    );
  });
});
