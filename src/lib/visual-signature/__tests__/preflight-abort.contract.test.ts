// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * F47.1 — contrato de ordem do preflight: uma falha estática/isolation deve
 * encerrar ANTES de abrir conexão com o banco. O script TypeScript também deve
 * validar o destino antes de instanciar o Client.
 */
const PS_PATH = path.resolve(process.cwd(), "scripts", "f47-1", "preflight.ps1");
const APP_PATH = path.resolve(process.cwd(), "scripts", "f47-1", "preflight-app.ts");

describe("F47.1 — preflight aborta antes da conexão", () => {
  it("o abort estático ocorre antes de configurar/executar o preflight de banco", () => {
    const source = readFileSync(PS_PATH, "utf8");
    const abortIndex = source.indexOf("if ($script:Failures.Count -gt 0)");
    const dbEnvIndex = source.indexOf("$env:PREFLIGHT_STAGE");

    expect(abortIndex).toBeGreaterThan(-1);
    expect(dbEnvIndex).toBeGreaterThan(-1);
    expect(abortIndex).toBeLessThan(dbEnvIndex);
    expect(source).toContain("database_connection_attempted=false");
  });

  it("o script TypeScript valida o destino Postgres antes de criar o Client", () => {
    const source = readFileSync(APP_PATH, "utf8");
    const validationIndex = source.indexOf("assertLocalPostgresEndpoint");
    const clientIndex = source.indexOf("new Client");

    expect(validationIndex).toBeGreaterThan(-1);
    expect(clientIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeLessThan(clientIndex);
    expect(source).toContain("database_connection_attempted: false");
  });
});
