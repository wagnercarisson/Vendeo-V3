// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrato estático (offline) da migration local-only de autorização de estágio.
// NÃO abre conexão de banco nem aplica a migration; apenas inspeciona o SQL.
const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");

const migrationFile = readdirSync(MIGRATIONS_DIR).find((name) =>
  name.endsWith("product_flow_stage_authorizations.sql"),
);

if (!migrationFile) {
  throw new Error("migration *product_flow_stage_authorizations.sql não encontrada");
}

const sql = readFileSync(path.join(MIGRATIONS_DIR, migrationFile), "utf8");
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

describe("F56.2b1a — migration product_flow_stage_authorizations (contrato estático)", () => {
  it("é local-only e não contém comando mutável remoto", () => {
    const executableDbPush = activeLines.filter((l) => /db push/i.test(l));
    expect(executableDbPush).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("cria a tabela dedicada com colunas, NOT NULL e checks de estágio/escopo/evento", () => {
    expect(activeSql).toMatch(/CREATE TABLE IF NOT EXISTS public\.product_flow_stage_authorizations/);
    for (const column of [
      "event_type",
      "stage",
      "scope",
      "instance_identity",
      "granted_by",
      "reason",
      "operation_id",
      "expires_at",
      "created_at",
    ]) {
      expect(activeSql, column).toMatch(new RegExp(`\\b${column}\\b`));
    }
    expect(activeSql).toMatch(/event_type IN \('granted', 'revoked', 'refused'\)/);
    expect(activeSql).toMatch(/stage IN \('off', 'isolated_pilot', 'test_stores', 'all_stores'\)/);
    expect(activeSql).toMatch(/scope IN \('test_stores', 'all_stores'\)/);
    expect(activeSql).toMatch(/UNIQUE \(operation_id\)/);
  });

  it("habilita RLS e restringe a service_role a SELECT/INSERT (append-only)", () => {
    expect(activeSql).toMatch(
      /ALTER TABLE public\.product_flow_stage_authorizations ENABLE ROW LEVEL SECURITY/,
    );
    expect(activeSql).toMatch(
      /REVOKE ALL ON TABLE public\.product_flow_stage_authorizations FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /REVOKE ALL ON TABLE public\.product_flow_stage_authorizations FROM service_role/,
    );
    expect(activeSql).toMatch(
      /GRANT SELECT, INSERT ON TABLE public\.product_flow_stage_authorizations TO service_role/,
    );
  });

  it("proíbe UPDATE/DELETE por trigger de imutabilidade", () => {
    expect(activeSql).toMatch(
      /CREATE TRIGGER trg_product_flow_stage_authorizations_immutable[\s\S]*BEFORE UPDATE OR DELETE/,
    );
    expect(activeSql).toMatch(/RAISE EXCEPTION 'product_flow_stage_authorizations_immutable'/);
  });

  it("não contém UPDATE/DELETE executável na tabela (append-only)", () => {
    expect(activeSql).not.toMatch(/UPDATE public\.product_flow_stage_authorizations\b/);
    expect(activeSql).not.toMatch(/DELETE FROM public\.product_flow_stage_authorizations\b/);
  });

  it("expõe RPC SECURITY DEFINER com search_path vazio e actor server-side", () => {
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_grant_product_flow_stage_authorization/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'missing_reason'/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'missing_operation_id'/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'missing_actor_id'/);
  });

  it("recusa estágio habilitador registrando um evento 'refused' auditado", () => {
    expect(activeSql).toMatch(/p_stage <> 'off'/);
    expect(activeSql).toMatch(/'refused'/);
    expect(activeSql).toMatch(/operational_activation_blocked_in_b1a/);
    expect(activeSql).toMatch(/'granted', false/);
  });

  it("preserva o resultado original no replay idempotente (recusa e concessão off)", () => {
    expect(activeSql).toMatch(/IF v_existing_type = 'refused'/);
    expect((activeSql.match(/'granted', false/g) ?? []).length).toBe(2);
    expect((activeSql.match(/'granted', true/g) ?? []).length).toBe(2);
    expect((activeSql.match(/'refused', true/g) ?? []).length).toBe(2);
    expect((activeSql.match(/'refused', false/g) ?? []).length).toBe(2);
    expect((activeSql.match(/'revoked', true/g) ?? []).length).toBe(2);
  });

  it("restringe EXECUTE das RPCs a service_role", () => {
    expect(activeSql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.admin_grant_product_flow_stage_authorization\([^)]*\)\s+FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_grant_product_flow_stage_authorization\([^)]*\)\s+TO service_role/,
    );
    expect(activeSql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.admin_revoke_product_flow_stage_authorization\([^)]*\)\s+FROM PUBLIC, anon, authenticated/,
    );
  });
});
