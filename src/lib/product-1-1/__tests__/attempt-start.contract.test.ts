// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 03: início de tentativa atômico no Postgres (B1B-D12 /
// REQ-56.2.2-05) e seu cliente fino server-only. Contract test estático +
// simulado, sem banco, sem provider, sem crédito (a migration é apenas
// AUTORADA aqui — LOCAL-ONLY; aplicação só no Plano 09 / O2).
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261009000001_f56_2b1b_atomic_attempt_start.sql";
const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);

const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

describe("F56.2b1b — migration 20261009000001 atomic_attempt_start (contrato estático)", () => {
  it("é LOCAL-ONLY, sem comando mutável remoto e com bloco REVERT", () => {
    expect(activeLines.filter((l) => /db push/i.test(l))).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("cria a tabela de claims com identidade (campaign_id, operation_id, attempt_number) e alvos/estados fechados", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_generation_attempt_claims/,
    );
    expect(activeSql).toMatch(
      /CONSTRAINT uq_p1_1_attempt_claim_seq UNIQUE \(campaign_id, operation_id, attempt_number\)/,
    );
    expect(activeSql).toMatch(/target IN \('primary','fallback'\)/);
    expect(activeSql).toMatch(/status IN \('in_progress','done','failed'\)/);
  });

  it("garante UM único início por vez via índice único parcial `in_progress`", () => {
    expect(activeSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_p1_1_attempt_claim_in_progress/,
    );
    expect(activeSql).toMatch(/WHERE status = 'in_progress'/);
  });

  it("C1: cria a relação PERSISTIDA do resultado desconhecido (product_1_1_generation_outcomes) imutável", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_generation_outcomes/,
    );
    expect(activeSql).toMatch(/outcome IN \('unknown','failed'\)/);
    expect(activeSql).toMatch(
      /CONSTRAINT uq_p1_1_generation_outcome_op UNIQUE \(campaign_id, operation_id\)/,
    );
    expect(activeSql).toMatch(/RAISE EXCEPTION 'product_1_1_generation_outcome_immutable'/);
    expect(activeSql).toMatch(/BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS trg_p1_1_generation_outcome_immutable ON public\.product_1_1_generation_outcomes/,
    );
  });

  it("C4: acquire e record tomam a MESMA trava `FOR UPDATE` na linha de crédito", () => {
    const acquireIdx = activeSql.indexOf("product_1_1_acquire_attempt_start");
    const recordIdx = activeSql.indexOf("product_1_1_record_generation_outcome");
    expect(acquireIdx).toBeGreaterThan(-1);
    expect(recordIdx).toBeGreaterThan(acquireIdx);

    const acquireBlock = activeSql.slice(acquireIdx, recordIdx);
    const recordBlock = activeSql.slice(recordIdx);
    for (const block of [acquireBlock, recordBlock]) {
      expect(block).toMatch(
        /FROM public\.product_1_1_campaign_credit_operations[\s\S]*FOR UPDATE/,
      );
    }
  });

  it("F1: valida contadores POR ALVO (primary<=2, fallback<=1, total<=3) e transições permitidas", () => {
    expect(activeSql).toMatch(/COUNT\(\*\) FILTER \(WHERE target = 'primary'\)/);
    expect(activeSql).toMatch(/COUNT\(\*\) FILTER \(WHERE target = 'fallback'\)/);
    expect(activeSql).toMatch(/v_primary_count >= 2/);
    expect(activeSql).toMatch(/v_fallback_count >= 1/);
    expect(activeSql).toMatch(/v_total_count >= 3/);
    // O fallback é aceito já na 2ª chamada — nunca por posição fixa.
    expect(activeSql).not.toMatch(/attempt_seq BETWEEN 1 AND 3/);
  });

  it("F6/C1: recusa `operation_terminal` (prevalece, I2) antes de `operation_unknown`", () => {
    expect(activeSql).toMatch(/reason', 'operation_terminal'/);
    expect(activeSql).toMatch(/reason', 'operation_unknown'/);
    const terminalIdx = activeSql.indexOf("'operation_terminal'");
    const unknownIdx = activeSql.indexOf("'operation_unknown'");
    expect(terminalIdx).toBeGreaterThan(-1);
    expect(unknownIdx).toBeGreaterThan(terminalIdx);
  });

  it("escrita direta NÃO é concedida à service_role (apenas SELECT) nas tabelas novas", () => {
    expect(activeSql).toMatch(
      /REVOKE ALL ON TABLE public\.product_1_1_generation_attempt_claims FROM service_role/,
    );
    expect(activeSql).toMatch(
      /GRANT SELECT ON TABLE public\.product_1_1_generation_attempt_claims TO service_role/,
    );
    expect(activeSql).toMatch(
      /GRANT SELECT ON TABLE public\.product_1_1_generation_outcomes TO service_role/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.product_1_1_generation_attempt_claims/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.product_1_1_generation_outcomes/,
    );
  });

  it("define as 4 RPCs SECURITY DEFINER com search_path vazio e privilégios mínimos", () => {
    for (const fn of [
      "product_1_1_acquire_attempt_start",
      "product_1_1_finish_attempt",
      "product_1_1_get_campaign_operation_by_campaign",
      "product_1_1_record_generation_outcome",
    ]) {
      expect(activeSql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`));
    }
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(
      activeSql.match(
        /REVOKE ALL ON FUNCTION public\.product_1_1_[a-z_]+\([^)]*\) FROM PUBLIC, anon, authenticated/g,
      )?.length,
    ).toBe(4);
    expect(
      activeSql.match(
        /GRANT EXECUTE ON FUNCTION public\.product_1_1_[a-z_]+\([^)]*\) TO service_role/g,
      )?.length,
    ).toBe(4);
    // `acquire` faz INSERT ... ON CONFLICT do claim (sem erro incidental de unicidade).
    expect(activeSql).toMatch(
      /ON CONFLICT \(campaign_id, operation_id, attempt_number\) DO NOTHING/,
    );
  });

  it("I2: leitura por campanha dá PRECEDÊNCIA TERMINAL sobre o marcador histórico `unknown`", () => {
    expect(activeSql).toMatch(/product_1_1_get_campaign_operation_by_campaign/);
    expect(activeSql).toMatch(/v_terminal := v_credit\.status IN \('delivered','refunded'\)/);
    expect(activeSql).toMatch(/'terminal', v_terminal/);
    expect(activeSql).toMatch(/'unknown', \(v_unknown AND NOT v_terminal\)/);
  });
});
