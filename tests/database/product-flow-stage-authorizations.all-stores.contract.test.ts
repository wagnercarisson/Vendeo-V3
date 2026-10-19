// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(process.cwd(), "supabase", "migrations");
const authSql = readFileSync(
  path.join(DIR, "20261019000002_f56_2b2e_all_stores_authorization.sql"),
  "utf8",
);
const activationSql = readFileSync(
  path.join(DIR, "20261019000003_f56_2b2e_product_flow_activation.sql"),
  "utf8",
);
const expirySql = readFileSync(
  path.join(DIR, "20261019000004_f56_2b2e_activation_expiry_fix.sql"),
  "utf8",
);

function active(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0)
    .join("\n");
}

const auth = active(authSql);
const activation = active(activationSql);

describe("F56.2b2e - autorizacao all_stores (contrato estatico)", () => {
  it("declara a terceira via e preserva as anteriores", () => {
    expect(auth).toMatch(/v_narrow_isolated := \(p_stage = 'isolated_pilot' AND p_scope = 'test_stores'\)/);
    expect(auth).toMatch(/v_narrow_operational := \(p_stage = 'test_stores' AND p_scope = 'test_stores'\)/);
    expect(auth).toMatch(/v_narrow_all := \(p_stage = 'all_stores' AND p_scope = 'all_stores'\)/);
    expect(auth).toMatch(/v_narrow := v_narrow_isolated OR v_narrow_operational OR v_narrow_all/);
  });

  it("preserva assinatura, seguranca, idempotencia e append-only", () => {
    expect(auth).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_grant_product_flow_stage_authorization/);
    expect(auth).toMatch(/SECURITY DEFINER/);
    expect(auth).toMatch(/SET search_path = ''/);
    expect(auth).toMatch(/ON CONFLICT \(operation_id\) DO NOTHING/);
    expect(auth).toMatch(/operation_id_conflict/);
    expect(auth).toMatch(/REVOKE ALL ON FUNCTION/);
    expect(auth).toMatch(/GRANT EXECUTE ON FUNCTION/);
    expect(authSql).toMatch(/REVERT/);
    expect(auth).not.toMatch(/UPDATE public\.product_flow_stage_authorizations\b/);
    expect(auth).not.toMatch(/DELETE FROM public\.product_flow_stage_authorizations\b/);
  });

  it("replay devolve o estagio/escopo persistidos", () => {
    expect((auth.match(/v_existing_type = 'granted' AND v_existing_stage <> 'off'/g) ?? []).length).toBe(2);
    expect(auth).toMatch(/'stage', v_existing_stage, 'scope', v_existing_scope/);
    expect(auth).toMatch(/'stage', p_stage, 'scope', p_scope/);
  });
});

describe("F56.2b2e - RPC coordenadora (contrato estatico)", () => {
  it("cria ledger de acoes e RPC atomica com trava", () => {
    expect(activation).toMatch(/CREATE TABLE IF NOT EXISTS public\.product_1_1_activation_actions/);
    expect(activation).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_set_product_1_1_activation/);
    expect(activation).toMatch(/pg_advisory_xact_lock\(hashtext\('product_1_1_activation'\)\)/);
    expect(activation).toMatch(/SECURITY DEFINER/);
    expect(activation).toMatch(/SET search_path = ''/);
    expect(activation).toMatch(/operation_id_conflict/);
  });

  it("cobre as cinco transicoes e a verificacao final", () => {
    for (const mode of ["off", "test_stores", "all_stores"]) {
      expect(activation).toContain(`p_mode = '${mode}'`);
    }
    expect(activation).toMatch(/admin_update_feature_flag\('product_1_1_all_stores_enabled', false/);
    expect(activation).toMatch(/admin_revoke_product_flow_stage_authorization\(p_actor_id, 'all_stores'/);
    expect(activation).toMatch(/admin_grant_product_flow_stage_authorization\(p_actor_id, 'all_stores', 'all_stores'/);
    expect(activation).toMatch(/admin_grant_product_flow_stage_authorization\(p_actor_id, 'test_stores', 'test_stores'/);
    expect(activation).toMatch(/activation_verification_failed/);
    expect(activation).toMatch(/v_already/);
  });

  it("e RPC-only e nao le documentos/checkpoints", () => {
    expect(activation).toMatch(/REVOKE ALL ON FUNCTION/);
    expect(activation).toMatch(/GRANT EXECUTE ON FUNCTION/);
    expect(activation).not.toMatch(/readFile|checkpoint|openspec|proposal\.md/i);
  });

  it("corrige autorizacao expirada na leitura e em alreadyInMode", () => {
    expect(expirySql).toMatch(
      /CASE WHEN stage <> 'off' AND expires_at IS NOT NULL AND expires_at <= now\(\) THEN 'off' ELSE stage END/,
    );
    expect((expirySql.match(/expires_at <= now\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

