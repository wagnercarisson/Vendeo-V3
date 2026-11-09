#!/usr/bin/env node
/**
 * F60 / Plano 60-01 — Guardas estáticos (sem banco).
 *
 * Verifica as correções negativas exigidas na revisão pré-aplicação:
 * 1. cleanup não roda automaticamente e exige autorização própria;
 * 2. cleanup é conservador e não apaga origem canônica;
 * 3. comparação é esperado × observado e valida o ledger;
 * 4. aquisição bloqueia falha definitiva/desconhecida;
 * 5. retomada aplica a política da base (retry_base/fallback);
 * 6. S11 usa sobreposição real e S13 cobre os contratos legados.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(".");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail: condition ? null : detail });
}

const run = read("scripts/f60/run-f60-proofs.ps1");
const cleanup = read("scripts/f60/proof-cleanup.mjs");
const snapshot = read("scripts/f60/homolog-snapshot.mjs");
const harness = read("scripts/f60/two-stage-proof-harness.mjs");
const migration = read("supabase/migrations/20261109174110_f60_9_16_two_stage_control.sql");

check(
  "cleanup exige autorização própria",
  /F60_CLEANUP_AUTHORIZED/.test(run) && !/finally\s*\{[\s\S]*proof-cleanup/.test(run),
  "run-f60-proofs precisa de gate F60_CLEANUP_AUTHORIZED e não pode limpar em finally",
);
check(
  "cleanup usa run id e é conservador",
  /--run-id/.test(run) && /retain_all_non_disposable/.test(cleanup) && !/delete\s+from\s+public\.product_9_16_two_stage_operations/i.test(cleanup),
  "cleanup deve validar run id, reter origem canônica e não deletar operações",
);
check(
  "comparação esperado x observado + ledger",
  /--expect/.test(run) && /unexpected_additions/.test(snapshot) && /count_excluding_f60/.test(snapshot) && /sha256_excluding_f60/.test(snapshot),
  "compare deve usar manifesto e validar ledger",
);
check(
  "status e detalhamento do delta separados",
  /expected_delta_status/.test(snapshot) && /expected_delta_by_table/.test(snapshot) && !/expected_delta:\s*"PASS"/.test(snapshot),
  "expected_delta não pode ser string e objeto ao mesmo tempo",
);
check(
  "ledger validado antes do harness",
  run.indexOf("validate-ledger") >= 0 && run.indexOf("validate-ledger") < run.indexOf("two-stage-proof-harness.mjs"),
  "o ledger inicial deve ser validado antes de qualquer escrita",
);
check(
  "prove exige F60 aplicada e status preserva pré-aplicação",
  /--require-f60-applied true/.test(run) && /--require-f60-absent true/.test(run),
  "prove deve exigir F60 aplicada; status deve preservar a checagem de ausência",
);
check(
  "snapshot cobre auth.users e tabelas novas",
  /"auth\.users"/.test(snapshot) &&
    /product_9_16_two_stage_operations/.test(snapshot) &&
    /product_9_16_two_stage_steps/.test(snapshot) &&
    /product_9_16_two_stage_attempt_claims/.test(snapshot) &&
    /product_9_16_two_stage_outcomes/.test(snapshot),
  "faltam tabelas no snapshot",
);
check(
  "identidade de credit_balances",
  /credit_balances"\s*:\s*"store_id"/.test(snapshot) && /identityColumn/.test(snapshot),
  "credit_balances deve usar store_id como identidade",
);
check(
  "aquisição bloqueia definitivo/desconhecido",
  /v_prev\.failure_class = 'unknown'/.test(migration) && /v_prev\.status = 'failed' AND v_prev\.failure_class = 'transient'/.test(migration),
  "acquire_step deve bloquear falha definitiva/desconhecida antes do outcome",
);
check(
  "abandoned/unknown não contorna bloqueio",
  /v_prev\.status IN \('failed', 'abandoned'\)/.test(migration) && /p_status = 'abandoned' AND p_failure_class IS NOT NULL/.test(migration),
  "abandoned com failure_class unknown deve ser rejeitado/bloqueado",
);
check(
  "retomada aplica política da base",
  /retry_base/.test(migration) && /v_next_target := 'fallback'/.test(migration),
  "resume_operation deve permitir retry_base/fallback transitório",
);
check(
  "S11 com sobreposição real",
  /overlapObserved/.test(harness) && /no_transactional_overlap_observed/.test(harness) && /BEGIN/.test(harness),
  "S11 precisa de transações sobrepostas e evidência de sobreposição",
);
check(
  "S13 cobre contratos legados",
  /close_failed_operation/.test(harness) && /get_campaign_operation_by_campaign/.test(harness) && /admin_resolve_product_1_1_pending/.test(harness),
  "S13 deve exercitar as três RPCs compartilhadas",
);
check(
  "S02/S08 têm testes negativos",
  /definitive_retry_before_outcome_allowed/.test(harness) &&
    /base_retry_after_unknown/.test(harness) &&
    /abandoned_unknown_bypassed_bloqueio/.test(harness),
  "faltam asserções negativas de falha definitiva/desconhecida/abandoned",
);

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed: failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
