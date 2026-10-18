// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrato estático (offline) da migration local-only da via operacional estreita.
// NÃO abre conexão de banco nem aplica a migration; apenas inspeciona o SQL.
const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");

function readMigrationByVersion(prefix: string): string {
  const matches = readdirSync(MIGRATIONS_DIR).filter((name) => name.startsWith(prefix));
  if (matches.length !== 1) {
    throw new Error(
      `esperada exatamente 1 migration iniciando por '${prefix}', encontradas ${matches.length}`,
    );
  }
  return readFileSync(path.join(MIGRATIONS_DIR, matches[0]), "utf8");
}

function activeLinesOf(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0)
    .join("\n");
}

// Resolução EXPLÍCITA por versão: a sucessora aditiva que habilita as DUAS vias
// estreitas (`isolated_pilot` + `test_stores` e `test_stores` + `test_stores`).
const sql = readMigrationByVersion("20261019000001");
const activeSql = activeLinesOf(sql);

describe("F56.2b2d — migration da via operacional (contrato estático)", () => {
  it("é local-only e não contém comando mutável remoto", () => {
    const activeLines = sql
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
    const executableDbPush = activeLines.filter((l) => /db push/i.test(l));
    expect(executableDbPush).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/apenas AUTORADA/);
    expect(sql).toMatch(/REVERT/);
  });

  it("declara as DUAS vias estreitas e mantém a recusa do restante habilitador", () => {
    expect(activeSql).toMatch(
      /v_narrow_isolated := \(p_stage = 'isolated_pilot' AND p_scope = 'test_stores'\)/,
    );
    expect(activeSql).toMatch(
      /v_narrow_operational := \(p_stage = 'test_stores' AND p_scope = 'test_stores'\)/,
    );
    expect(activeSql).toMatch(/v_narrow := v_narrow_isolated OR v_narrow_operational/);
    expect(activeSql).toMatch(/v_enabling := \(p_stage <> 'off'\) AND NOT v_narrow/);
  });

  it("recusa all_stores e qualquer escopo all_stores (barreira global)", () => {
    expect(activeSql).toMatch(/operational_activation_blocked_in_b1a/);
    expect(activeSql).toMatch(/p_scope NOT IN \('test_stores', 'all_stores'\)/);
    expect(activeSql).toMatch(/p_stage NOT IN \('off', 'isolated_pilot', 'test_stores', 'all_stores'\)/);
    // Nenhuma via estreita aceita `all_stores`.
    expect(activeSql).not.toMatch(/v_narrow_[a-z_]+ := \([^)]*all_stores/);
  });

  it("preserva o estágio PERSISTIDO no replay e o estágio solicitado na concessão", () => {
    expect(activeSql).toMatch(/'stage', v_existing_stage, 'scope', 'test_stores'/);
    expect(activeSql).toMatch(/'stage', p_stage, 'scope', 'test_stores'/);
    expect(activeSql).not.toMatch(/'stage', 'isolated_pilot', 'scope', 'test_stores'/);
  });

  it("mantém idempotência, auditoria e append-only", () => {
    expect((activeSql.match(/ON CONFLICT \(operation_id\) DO NOTHING/g) ?? []).length).toBe(1);
    expect(activeSql).toMatch(/operation_id_conflict/);
    expect(activeSql).toMatch(/granted_by/);
    expect(activeSql).toMatch(/INSERT INTO public\.product_flow_stage_authorizations/);
    expect(activeSql).toMatch(/v_existing_stage = v_stored_stage/);
    expect(activeSql).toMatch(/v_existing_actor IS NOT DISTINCT FROM p_actor_id/);
  });

  it("não contém UPDATE/DELETE executável na tabela (append-only)", () => {
    expect(activeSql).not.toMatch(/UPDATE public\.product_flow_stage_authorizations\b/);
    expect(activeSql).not.toMatch(/DELETE FROM public\.product_flow_stage_authorizations\b/);
    expect(activeSql).not.toMatch(/ALTER TABLE|DROP TABLE/);
  });

  it("preserva SECURITY DEFINER, search_path vazio e a assinatura de 6 parâmetros", () => {
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_grant_product_flow_stage_authorization/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(activeSql).not.toMatch(/p_expires_at/);
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_grant_product_flow_stage_authorization\(UUID, TEXT, TEXT, TEXT, TEXT, UUID\)\s+TO service_role/,
    );
    expect(activeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.admin_grant_product_flow_stage_authorization\(UUID, TEXT, TEXT, TEXT, TEXT, UUID\)\s+FROM PUBLIC, anon, authenticated/,
    );
  });
});
