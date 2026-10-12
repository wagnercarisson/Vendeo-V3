// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 07: resolução administrativa auditada de pendências
// (B1B-D5 / REQ-56.2.2-08). Contract test estático + simulado, sem banco, sem
// provider, sem crédito (a migration é apenas AUTORADA aqui — LOCAL-ONLY;
// aplicação só no Plano 09 / O2).
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261009000002_f56_2b1b_pending_resolution.sql";
const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);

const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

describe("F56.2b1b — migration 20261009000002 pending_resolution (contrato estático)", () => {
  it("é LOCAL-ONLY, sem comando mutável remoto e com bloco REVERT", () => {
    expect(activeLines.filter((l) => /db push/i.test(l))).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("estende o CHECK de `admin_audit_log.action` com a ação auditada (preservando os valores anteriores)", () => {
    expect(activeSql).toMatch(
      /ALTER TABLE public\.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check/,
    );
    expect(activeSql).toMatch(/product_1_1_pending_resolution/);
    // Preserva valores históricos conhecidos (não cria conjunto divergente).
    expect(activeSql).toMatch(/image_model_pair_config_update/);
    expect(activeSql).toMatch(/manual_refund/);
  });

  it("cria a RPC auditada `admin_resolve_product_1_1_pending` com SECURITY DEFINER e search_path vazio", () => {
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_resolve_product_1_1_pending\(/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
  });

  it("guarda motivo/ator/operação e idempotência por `resolution_operation_id` via `admin_audit_log`", () => {
    expect(activeSql).toMatch(/RAISE EXCEPTION 'missing_reason'/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'missing_actor_id'/);
    expect(activeSql).toMatch(
      /FROM public\.admin_audit_log[\s\S]*?operation_id = p_resolution_operation_id[\s\S]*?action = 'product_1_1_pending_resolution'/,
    );
    expect(activeSql).toMatch(
      /INSERT INTO public\.admin_audit_log[\s\S]*?'product_1_1_pending_resolution'/,
    );
  });

  it("C4 — toma a MESMA trava `FOR UPDATE` da linha de crédito ANTES das verificações/transições", () => {
    expect(activeSql).toMatch(
      /FROM public\.product_1_1_campaign_credit_operations[\s\S]*?FOR UPDATE/,
    );
  });

  it("F5/C2 — evidência TIPADA derivada server-side; `invalid`/`indeterminate` BLOQUEIAM; refund só com `absent`", () => {
    expect(activeSql).toMatch(
      /v_art_kind NOT IN \('integral','absent','invalid','indeterminate'\)/,
    );
    expect(activeSql).toMatch(/v_art_kind IN \('invalid','indeterminate'\)/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'insufficient_evidence'/);
    expect(activeSql).toMatch(/v_art_kind <> 'absent'/);
    expect(activeSql).toMatch(/v_art_kind <> 'integral'/);
  });

  it("F5 — recusa evidência sem marca de verificação server-side e revalida o estado antes da transição", () => {
    expect(activeSql).toMatch(/jsonb_typeof\(p_evidence\) <> 'object'/);
    expect(activeSql).toMatch(/server-derived/);
    expect(activeSql).toMatch(/jsonb_typeof\(p_evidence->'execution_ended'\) <> 'boolean'/);
  });

  it("F5/C2 — guarda de execução ativa (`operation_in_progress`) via claim `in_progress`", () => {
    expect(activeSql).toMatch(
      /FROM public\.product_1_1_generation_attempt_claims[\s\S]*?status = 'in_progress'/,
    );
    expect(activeSql).toMatch(/RAISE EXCEPTION 'operation_in_progress'/);
  });

  it("F5 — conflito de conteúdo devolve `operation_identity_conflict` (nunca sucesso enganoso)", () => {
    expect(activeSql).toMatch(/reason', 'operation_identity_conflict'/);
  });

  it("F5 — arte íntegra com operação `reserved` registra `art_uploaded` E entrega na MESMA transação", () => {
    expect(activeSql).toMatch(
      /PERFORM public\.product_1_1_mark_campaign_credit_art_uploaded\(/,
    );
    expect(activeSql).toMatch(
      /PERFORM public\.product_1_1_deliver_campaign_credit_operation\(/,
    );
    expect(activeSql).toMatch(
      /PERFORM public\.product_1_1_refund_campaign_credit_operation\(/,
    );
  });

  it("E1 — CONSUME o status TERMINAL `abandoned` (já definido no Plano 03) sem criar conjunto divergente de status", () => {
    expect(activeSql).toMatch(/status = 'abandoned'/);
    // Esta migration NÃO recria a CHECK de claims de tentativa (o status vive no
    // Plano 03 / 20261009000001); nenhuma CHECK divergente é introduzida aqui.
    expect(activeSql).not.toMatch(/ck_p1_1_attempt_claim_status/);
    expect(activeSql).not.toMatch(
      /CHECK \(status IN \('in_progress','done','failed','abandoned'\)\)/,
    );
  });

  it("E1 — finaliza o claim `in_progress` residual NA MESMA transação da transição (sem COMMIT intermediário)", () => {
    expect(activeSql).toMatch(
      /UPDATE public\.product_1_1_generation_attempt_claims[\s\S]*?SET status = 'abandoned'/,
    );
    expect(activeSql).toMatch(/v_in_progress AND NOT v_execution_ended/);
    // Único commit: nenhum COMMIT intermediário no corpo do RPC.
    expect(activeSql).not.toMatch(/\bCOMMIT\b/);
  });

  it("privilégios: execução apenas por service_role (REVOKE de PUBLIC/anon/authenticated)", () => {
    expect(activeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.admin_resolve_product_1_1_pending\([^)]*\) FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_resolve_product_1_1_pending\([^)]*\) TO service_role/,
    );
  });

  it("NENHUM caminho de re-queue/nova geração/chamada ao provider", () => {
    expect(activeSql).not.toMatch(/provider/i);
    expect(activeSql).not.toMatch(/enqueue|requeue|re-queue|new_generation/i);
  });

  it("D13 — risco aceito só na b1b inativa + GATE bloqueante da b2 (limitação documentada, sem recuperabilidade completa)", () => {
    // O texto de D13 (limitação/comentário) afirma: sem fonte operacional
    // comprovada de encerramento ⇒ resolução BLOQUEADA (sem estorno/nova
    // geração/retomada); b1b NÃO declara recuperabilidade completa; evidência
    // simulada NÃO é prova operacional; GATE obrigatório da b2.
    expect(sql).toMatch(/D13/);
    expect(sql).toMatch(/risco (?:explicitamente )?aceito/i);
    expect(sql).toMatch(/n[ãa]o declara recuperabilidade completa/i);
    expect(sql).toMatch(/evid[êe]ncia simulada/i);
    expect(sql).toMatch(/GATE/i);
    expect(sql).toMatch(/b2/);
  });
});
