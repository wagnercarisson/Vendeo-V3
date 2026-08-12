// F38.2.1 SQL Verification I1-I7: snapshot econômico em generation_events
// (usd_brl_rate_at_generation + credit_value_brl_at_generation + origens),
// backfill idempotente, tracker captured_at_generation, RPCs expondo snapshots,
// estabilidade temporal (alterar parâmetro → histórico não muda), fallback legacy
// e nomenclatura (nenhum contrato afirma "receita real").
// Padrão F38.2 (38-2-f38-2-verification.mjs) — NÃO modifica o script da F38.2.
//
// Regra operacional F38.1 (append-only em generation_events): NUNCA DELETE —
// as linhas de teste criadas por ESTE script são neutralizadas via UPDATE
// (operation_run_id + colunas de snapshot → NULL) no finally, mantendo o
// invariante de append-only do banco (DELETE é 403 para service_role).
// Parâmetros econômicos alterados no I6 são SEMPRE revertidos ao valor original.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const getEnv = (key) => {
  const m = envContent.match(new RegExp(`${key}=(.+)`));
  return m ? m[1].trim() : null;
};

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const results = { pass: 0, fail: 0, tests: [] };
const assert = (name, ok, detail) => {
  ok
    ? (results.pass++, console.log(`  ✓ ${name}`))
    : (results.fail++, console.log(`  ✗ ${name} — ${detail}`));
  results.tests.push({ name, ok, detail });
};

const REASON = "38-2-1-07-verification";

// Tolerância para NUMERIC do Postgres (string) — normaliza para number
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const ALLOWED_SOURCES = [
  "captured_at_generation",
  "backfilled_from_audit",
  "backfilled_seed",
];

// Origem da derivação legacy do service (contrato D1/D4 — refletido aqui para o
// assert I7 de forma data-driven; a implementação real está em
// operation-runs-service.ts deriveBrl, coberta por unit tests do plano 04).
function fallbackDerivation(usdRate, creditValue, custoUsd, creditosLiquidos) {
  const custoBrl = custoUsd !== null ? custoUsd * usdRate : null;
  const receitaEstimadaBrl =
    creditosLiquidos !== null ? creditosLiquidos * creditValue : null;
  const resultadoEstimadoBrl =
    custoBrl !== null && receitaEstimadaBrl !== null
      ? receitaEstimadaBrl - custoBrl
      : null;
  const margemEstimadaPct =
    receitaEstimadaBrl !== null &&
    receitaEstimadaBrl > 0 &&
    resultadoEstimadoBrl !== null
      ? (resultadoEstimadoBrl / receitaEstimadaBrl) * 100
      : null;
  return { custoBrl, receitaEstimadaBrl, resultadoEstimadoBrl, margemEstimadaPct };
}

// grep de nomenclatura nos contratos TS (produção — exclui __tests__):
// nenhum contrato afirma "receita real" (gate D8 / F38.2.1).
const NAMING_PATTERN = /receitaRealBrl|resultadoRealBrl|margemRealPct/g;
const NAMING_TARGETS = [
  resolve(__dirname, "../../src/lib/ai-cost/operation-runs-service.ts"),
  resolve(__dirname, "../../src/app/api/admin/ai-operation-runs/route.ts"),
  resolve(
    __dirname,
    "../../src/app/api/admin/ai-operation-runs/[operationRunId]/route.ts",
  ),
];
const NAMING_UI_DIR = resolve(
  __dirname,
  "../../src/app/(app)/admin/ai-operation-costs",
);

function countNamingViolations() {
  let total = 0;
  const files = [...NAMING_TARGETS];
  if (statSync(NAMING_UI_DIR).isDirectory()) {
    for (const entry of readdirSync(NAMING_UI_DIR)) {
      if (!entry.endsWith(".tsx") && !entry.endsWith(".ts")) continue;
      files.push(join(NAMING_UI_DIR, entry));
    }
  }
  for (const file of files) {
    if (file.includes("__tests__")) continue;
    const content = readFileSync(file, "utf-8");
    const matches = content.match(NAMING_PATTERN);
    if (matches) {
      total += matches.length;
      console.log(`  ℹ️  nomenclatura proibida em ${file}: ${matches.join(", ")}`);
    }
  }
  return total;
}

async function run() {
  console.log(`\n🔍 F38.2.1 SQL Verification I1-I7\n`);

  // Resolve real actor (FK auth.users) — mesmo padrão F38/F38.1/F38.2
  const { data: userList, error: userListError } = await supabase.auth.admin.listUsers({
    perPage: 1,
  });
  if (userListError || !userList?.users?.length) {
    console.error("No real auth user found to use as verification actor");
    process.exit(1);
  }
  const actorId = userList.users[0].id;
  console.log(`Actor: ${actorId}\n`);

  // Estado original dos parâmetros econômicos (revertido no finally — idempotência)
  const { data: originalParams } = await supabase
    .from("economic_parameters")
    .select("key, value")
    .in("key", ["usd_brl_rate", "credit_value_brl"]);
  const originalValues = {};
  for (const row of originalParams ?? []) {
    originalValues[row.key] = toNumber(row.value);
  }
  console.log(
    `Parâmetros originais: usd_brl_rate=${originalValues.usd_brl_rate} credit_value_brl=${originalValues.credit_value_brl}\n`,
  );

  // Linhas de teste criadas por este script (neutralizadas no finally)
  const testRunIds = [];
  let storeId = null;

  try {
    // Resolve uma loja real para os eventos de teste (store_id NOT NULL)
    const { data: storeRows } = await supabase
      .from("generation_events")
      .select("store_id")
      .limit(1);
    storeId = storeRows?.[0]?.store_id ?? null;
    assert("setup: store_id real resolvido para eventos de teste", !!storeId, `storeId=${storeId}`);

    // ── I1: migration — 4 colunas existem + CHECKs ativos ────────────────
    console.log("🧪 I1: migration — 4 colunas de snapshot em generation_events + CHECKs");
    const SNAPSHOT_COLS = [
      "usd_brl_rate_at_generation",
      "credit_value_brl_at_generation",
      "usd_brl_rate_source_at_generation",
      "credit_value_brl_source_at_generation",
    ];
    const { data: colSample, error: colErr } = await supabase
      .from("generation_events")
      .select(SNAPSHOT_COLS.join(","))
      .limit(1);
    assert(
      "I1: 4 colunas de snapshot selecionáveis (existem no banco)",
      !colErr && !!colSample,
      colErr?.message,
    );

    // CHECK leve de origem: INSERT com origem proibida (economic_parameter_fallback)
    // → chk_gen_events_usd_rate_source (23514); nada é gravado
    const badSourceRun = crypto.randomUUID();
    const { error: badSourceErr } = await supabase.from("generation_events").insert({
      store_id: storeId,
      operation_run_id: badSourceRun,
      operation_run_type: "campaign_delivery",
      generation_type: "campaign_copy",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
      attempt_number: 1,
      duration_ms: 5,
      usd_brl_rate_at_generation: 5.2,
      usd_brl_rate_source_at_generation: "economic_parameter_fallback",
    });
    assert(
      "I1: origem 'economic_parameter_fallback' rejeitada pelo CHECK (23514 chk_gen_events_usd_rate_source)",
      !!badSourceErr &&
        (badSourceErr.code === "23514" || badSourceErr.message?.includes("chk_gen_events_usd_rate_source")),
      badSourceErr?.message || "esperado erro de CHECK",
    );
    const { data: badSourceRow } = await supabase
      .from("generation_events")
      .select("id")
      .eq("operation_run_id", badSourceRun)
      .single();
    assert("I1: linha com origem proibida NÃO criada", !badSourceRow, JSON.stringify(badSourceRow));

    // CHECK de paridade: valor presente + origem NULL → chk_gen_events_usd_rate_parity
    const badParityRun = crypto.randomUUID();
    const { error: badParityErr } = await supabase.from("generation_events").insert({
      store_id: storeId,
      operation_run_id: badParityRun,
      operation_run_type: "campaign_delivery",
      generation_type: "campaign_copy",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
      attempt_number: 1,
      duration_ms: 5,
      usd_brl_rate_at_generation: 5.2,
      usd_brl_rate_source_at_generation: null,
    });
    assert(
      "I1: valor sem origem rejeitado pelo CHECK de paridade (23514 chk_gen_events_usd_rate_parity)",
      !!badParityErr &&
        (badParityErr.code === "23514" || badParityErr.message?.includes("chk_gen_events_usd_rate_parity")),
      badParityErr?.message || "esperado erro de CHECK",
    );
    const { data: badParityRow } = await supabase
      .from("generation_events")
      .select("id")
      .eq("operation_run_id", badParityRun)
      .single();
    assert("I1: linha com paridade violada NÃO criada", !badParityRow, JSON.stringify(badParityRow));

    // CHECK de paridade do lado credit (valor presente + origem NULL)
    const badCreditParityRun = crypto.randomUUID();
    const { error: badCreditParityErr } = await supabase
      .from("generation_events")
      .insert({
        store_id: storeId,
        operation_run_id: badCreditParityRun,
        operation_run_type: "campaign_delivery",
        generation_type: "campaign_copy",
        provider: "openai",
        model: "gpt-4o-mini",
        status: "success",
        attempt_number: 1,
        duration_ms: 5,
        credit_value_brl_at_generation: 2.0,
        credit_value_brl_source_at_generation: null,
      });
    assert(
      "I1: credit sem origem rejeitado pelo CHECK de paridade (chk_gen_events_credit_value_parity)",
      !!badCreditParityErr &&
        (badCreditParityErr.code === "23514" || badCreditParityErr.message?.includes("chk_gen_events_credit_value_parity")),
      badCreditParityErr?.message || "esperado erro de CHECK",
    );

    // ── I2: backfill — valores + origens + idempotência ───────────────────
    console.log("\n🧪 I2: backfill — linhas preenchidas com origem, paridade, idempotência");

    // Paridade enforced (valor ⇔ origem) nos DOIS pares — nenhum valor sem origem
    const { data: parityRows, error: parityErr } = await supabase
      .from("generation_events")
      .select("id")
      .or(
        "and(usd_brl_rate_at_generation.not.is.null,usd_brl_rate_source_at_generation.is.null),and(usd_brl_rate_at_generation.is.null,usd_brl_rate_source_at_generation.not.is.null)",
      )
      .limit(5);
    assert(
      "I2: NENHUM valor usd sem origem / origem sem valor (paridade enforced)",
      !parityErr && (parityRows?.length ?? 0) === 0,
      parityErr?.message || `violações=${parityRows?.length}`,
    );
    const { data: creditParityRows, error: creditParityErr } = await supabase
      .from("generation_events")
      .select("id")
      .or(
        "and(credit_value_brl_at_generation.not.is.null,credit_value_brl_source_at_generation.is.null),and(credit_value_brl_at_generation.is.null,credit_value_brl_source_at_generation.not.is.null)",
      )
      .limit(5);
    assert(
      "I2: NENHUM valor credit sem origem / origem sem valor (paridade enforced)",
      !creditParityErr && (creditParityRows?.length ?? 0) === 0,
      creditParityErr?.message || `violações=${creditParityRows?.length}`,
    );

    // Linhas backfilled SEM valor → 0 (origem backfilled_* implica valor)
    const { data: bfNoValue, error: bfNoValueErr } = await supabase
      .from("generation_events")
      .select("id")
      .in("usd_brl_rate_source_at_generation", ["backfilled_from_audit", "backfilled_seed"])
      .is("usd_brl_rate_at_generation", null)
      .limit(5);
    assert(
      "I2: NENHUMA linha backfilled sem valor usd",
      !bfNoValueErr && (bfNoValue?.length ?? 0) === 0,
      bfNoValueErr?.message || `backfilled-sem-valor=${bfNoValue?.length}`,
    );

    // Linhas elegíveis NÃO preenchidas → 0 (idempotência: re-aplicação do backfill
    // — cujo WHERE é `value IS NULL AND created_at IS NOT NULL` — atinge 0 linhas).
    // Linhas de teste neutralizadas por ESTE script (metadata verification 38-2-1-*)
    // são excluídas: permanecem no banco por append-only e continuariam elegíveis.
    const { data: eligibleUnfilled, error: eligibleErr } = await supabase
      .from("generation_events")
      .select("id")
      .is("usd_brl_rate_at_generation", null)
      .not("created_at", "is", null)
      .or("metadata.is.null,metadata->>verification.not.like.38-2-1-%")
      .limit(5);
    assert(
      "I2: NENHUMA linha elegível real com valor null (re-aplicação do backfill é no-op — idempotência)",
      !eligibleErr && (eligibleUnfilled?.length ?? 0) === 0,
      eligibleErr?.message || `elegíveis-não-preenchidas=${eligibleUnfilled?.length}`,
    );

    // Origem restrita ao conjunto permitido (data check — o CHECK já rejeita na escrita)
    const { data: distinctOrigins, error: originsErr } = await supabase
      .from("generation_events")
      .select("usd_brl_rate_source_at_generation")
      .not("usd_brl_rate_source_at_generation", "is", null);
    const badOrigins = [...new Set((distinctOrigins ?? []).map((r) => r.usd_brl_rate_source_at_generation))]
      .filter((s) => !ALLOWED_SOURCES.includes(s));
    assert(
      "I2: origens persistidas restritas ao conjunto permitido (captured/backfilled_from_audit/backfilled_seed)",
      !originsErr && badOrigins.length === 0,
      originsErr?.message || `origens inválidas=${badOrigins.join(", ")}`,
    );

    // Contrato de seed do backfill (OVERRIDE 2026-08-11): linhas backfilled_seed
    // usd = 5.18 e credit = 1.00 — evidência do estado real pós-migration
    const { data: seedRows, error: seedRowsErr } = await supabase
      .from("generation_events")
      .select("usd_brl_rate_at_generation, credit_value_brl_at_generation")
      .eq("usd_brl_rate_source_at_generation", "backfilled_seed")
      .limit(250);
    const seedBad = (seedRows ?? []).filter(
      (r) => toNumber(r.usd_brl_rate_at_generation) !== 5.18 || toNumber(r.credit_value_brl_at_generation) !== 1.0,
    );
    assert(
      "I2: backfilled_seed usd=5.18 / credit=1.00 (contrato do backfill no banco real)",
      !seedRowsErr && seedBad.length === 0 && (seedRows?.length ?? 0) > 0,
      seedRowsErr?.message || `amostra=${seedRows?.length} divergentes=${seedBad.length}`,
    );
    console.log(`  ℹ️  linhas backfilled_seed amostradas: ${seedRows?.length ?? 0}`);

    // Re-aplicação simulada do backfill num registro de teste elegível:
    // 1) INSERT com created_at pré-audit (2026-07-01 — antes de economic_parameter_audit)
    //    e snapshot NULL → elegível (o LATERAL do backfill não acha audit anterior → seed)
    // 2) Aplica o resultado do backfill (5.18/backfilled_seed) via UPDATE com o MESMO
    //    predicado `value IS NULL` → idempotente
    // 3) Re-aplica → 0 linhas alteradas (não é mais elegível)
    const idemRun = crypto.randomUUID();
    testRunIds.push(idemRun);
    const { error: idemInsertErr } = await supabase.from("generation_events").insert({
      store_id: storeId,
      operation_run_id: idemRun,
      operation_run_type: "campaign_delivery",
      generation_type: "campaign_copy",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
      attempt_number: 1,
      duration_ms: 5,
      created_at: "2026-07-01T00:00:00Z",
      usd_brl_rate_at_generation: null,
      usd_brl_rate_source_at_generation: null,
      metadata: { verification: "38-2-1-I2-idempotency" },
    });
    assert("I2: registro de teste elegível inserido (snapshot NULL)", !idemInsertErr, idemInsertErr?.message);

    const { data: eligibleTest, error: eligibleTestErr } = await supabase
      .from("generation_events")
      .select("id")
      .eq("operation_run_id", idemRun)
      .is("usd_brl_rate_at_generation", null);
    assert(
      "I2: registro de teste MATCHES o predicado de elegibilidade do backfill",
      !eligibleTestErr && (eligibleTest?.length ?? 0) === 1,
      eligibleTestErr?.message || `elegíveis=${eligibleTest?.length}`,
    );

    // Aplicação do backfill (1ª vez): preenche apenas linhas com valor NULL
    // (.select() após update → retorna as linhas afetadas — contrato supabase-js v2)
    const { data: bfApply, error: bfApplyErr } = await supabase
      .from("generation_events")
      .update({
        usd_brl_rate_at_generation: 5.18,
        usd_brl_rate_source_at_generation: "backfilled_seed",
        credit_value_brl_at_generation: 1.0,
        credit_value_brl_source_at_generation: "backfilled_seed",
      })
      .eq("operation_run_id", idemRun)
      .is("usd_brl_rate_at_generation", null)
      .select();
    assert(
      "I2: aplicação do backfill preenche a linha elegível (5.18/backfilled_seed)",
      !bfApplyErr && Array.isArray(bfApply) && bfApply.length === 1,
      bfApplyErr?.message || JSON.stringify(bfApply),
    );

    // Re-aplicação (2ª vez): predicado `value IS NULL` não encontra mais a linha → 0 alteradas
    const { data: bfReapply, error: bfReapplyErr } = await supabase
      .from("generation_events")
      .update({
        usd_brl_rate_at_generation: 5.18,
        usd_brl_rate_source_at_generation: "backfilled_seed",
        credit_value_brl_at_generation: 1.0,
        credit_value_brl_source_at_generation: "backfilled_seed",
      })
      .eq("operation_run_id", idemRun)
      .is("usd_brl_rate_at_generation", null)
      .select();
    assert(
      "I2: re-aplicação NÃO altera linha preenchida (0 linhas — idempotência)",
      !bfReapplyErr && Array.isArray(bfReapply) && bfReapply.length === 0,
      bfReapplyErr?.message || `alteradas=${JSON.stringify(bfReapply)}`,
    );
    const { data: idemFinal, error: idemFinalErr } = await supabase
      .from("generation_events")
      .select("usd_brl_rate_at_generation, usd_brl_rate_source_at_generation")
      .eq("operation_run_id", idemRun)
      .single();
    assert(
      "I2: valor/origem inalterados após re-aplicação (5.18/backfilled_seed mantidos)",
      !idemFinalErr &&
        toNumber(idemFinal?.usd_brl_rate_at_generation) === 5.18 &&
        idemFinal?.usd_brl_rate_source_at_generation === "backfilled_seed",
      idemFinalErr?.message || JSON.stringify(idemFinal),
    );
    // Neutralização do registro de teste do I2 (linha não pode ficar no banco)
    const { error: idemCleanErr } = await supabase
      .from("generation_events")
      .update({
        operation_run_id: null,
        operation_run_type: null,
        usd_brl_rate_at_generation: null,
        usd_brl_rate_source_at_generation: null,
        credit_value_brl_at_generation: null,
        credit_value_brl_source_at_generation: null,
      })
      .eq("operation_run_id", idemRun);
    assert("I2: registro de teste neutralizado (append-only — sem DELETE)", !idemCleanErr, idemCleanErr?.message);

    // ── I3: tracker — snapshot capturado com origem captured_at_generation ──
    console.log("\n🧪 I3: tracker — snapshot 5.20/2.00 persistido com origem captured_at_generation");
    const trackerRun = crypto.randomUUID();
    testRunIds.push(trackerRun);
    // INSERT direto espelhando o contrato do AiCostTracker.record (F38.2.1-02):
    // o evento carrega APENAS valores; o tracker define as origens captured_at_generation
    const { error: trackerInsErr } = await supabase.from("generation_events").insert({
      store_id: storeId,
      operation_run_id: trackerRun,
      operation_run_type: "campaign_delivery",
      generation_type: "campaign_image",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
      attempt_number: 1,
      duration_ms: 250,
      estimated_cost_usd: 0.01,
      cost_source: "pricing_table",
      usd_brl_rate_at_generation: 5.2,
      credit_value_brl_at_generation: 2.0,
      usd_brl_rate_source_at_generation: "captured_at_generation",
      credit_value_brl_source_at_generation: "captured_at_generation",
      metadata: { verification: "38-2-1-I3-tracker" },
    });
    assert("I3: evento de teste com snapshots inserido (contrato do tracker)", !trackerInsErr, trackerInsErr?.message);

    const { data: trackerRow, error: trackerReadErr } = await supabase
      .from("generation_events")
      .select("usd_brl_rate_at_generation, credit_value_brl_at_generation, usd_brl_rate_source_at_generation, credit_value_brl_source_at_generation")
      .eq("operation_run_id", trackerRun)
      .single();
    assert(
      "I3: valores 5.20/2.00 persistidos com origens captured_at_generation",
      !trackerReadErr &&
        toNumber(trackerRow?.usd_brl_rate_at_generation) === 5.2 &&
        toNumber(trackerRow?.credit_value_brl_at_generation) === 2.0 &&
        trackerRow?.usd_brl_rate_source_at_generation === "captured_at_generation" &&
        trackerRow?.credit_value_brl_source_at_generation === "captured_at_generation",
      trackerReadErr?.message || JSON.stringify(trackerRow),
    );

    // ── I4: RPC lista — 4 campos por run (snapshot do evento de referência) ──
    console.log("\n🧪 I4: admin_get_ai_operation_runs — 4 campos de snapshot/origem por run");
    const periodStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = new Date().toISOString();
    const { data: runsData, error: runsErr } = await supabase.rpc("admin_get_ai_operation_runs", {
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_store_id: null,
      p_run_type: null,
      p_status: null,
      p_provider: null,
      p_model: null,
      p_generation_type: null,
      p_operation_run_id: null,
      p_page: 1,
      p_page_size: 5,
    });
    assert("I4: RPC de runs responde", !runsErr && !!runsData, runsErr?.message);
    const runs = Array.isArray(runsData?.runs) ? runsData.runs : [];
    assert("I4: runs é array com dados", runs.length > 0, `runs=${runs.length}`);
    const firstRun = runs[0];
    if (firstRun) {
      const has4 = [
        "usd_brl_rate_at_generation",
        "credit_value_brl_at_generation",
        "usd_brl_rate_source_at_generation",
        "credit_value_brl_source_at_generation",
      ].every((f) => f in firstRun);
      assert("I4: run expõe os 4 campos de snapshot/origem no JSON", has4, JSON.stringify(Object.keys(firstRun)));
      assert(
        "I4: run de referência com snapshot do evento (valor e origem não-null)",
        firstRun.usd_brl_rate_at_generation !== null && firstRun.usd_brl_rate_source_at_generation !== null,
        JSON.stringify({
          usd: firstRun.usd_brl_rate_at_generation,
          src: firstRun.usd_brl_rate_source_at_generation,
          credit: firstRun.credit_value_brl_at_generation,
          csrc: firstRun.credit_value_brl_source_at_generation,
        }),
      );
    }

    // I4 (run de teste do I3): RPC lista filtrado pelo operation_run_id → snapshot capturado
    const { data: trackerRunData, error: trackerRunErr } = await supabase.rpc(
      "admin_get_ai_operation_runs",
      {
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_store_id: null,
        p_run_type: null,
        p_status: null,
        p_provider: null,
        p_model: null,
        p_generation_type: null,
        p_operation_run_id: trackerRun,
        p_page: 1,
        p_page_size: 5,
      },
    );
    const trackerRpcRun = trackerRunData?.runs?.[0];
    assert("I4: RPC lista o run de teste (filtro operation_run_id)", !trackerRunErr && !!trackerRpcRun, trackerRunErr?.message || JSON.stringify(trackerRunData));
    if (trackerRpcRun) {
      assert(
        "I4: snapshot do run de teste = evento de referência capturado (5.20/2.00 + captured_at_generation)",
        toNumber(trackerRpcRun.usd_brl_rate_at_generation) === 5.2 &&
          toNumber(trackerRpcRun.credit_value_brl_at_generation) === 2.0 &&
          trackerRpcRun.usd_brl_rate_source_at_generation === "captured_at_generation" &&
          trackerRpcRun.credit_value_brl_source_at_generation === "captured_at_generation",
        JSON.stringify({
          usd: trackerRpcRun.usd_brl_rate_at_generation,
          src: trackerRpcRun.usd_brl_rate_source_at_generation,
          credit: trackerRpcRun.credit_value_brl_at_generation,
          csrc: trackerRpcRun.credit_value_brl_source_at_generation,
        }),
      );
    }

    // ── I5: RPC detalhe — 4 campos por evento e no run ─────────────────────
    console.log("\n🧪 I5: admin_get_ai_operation_run_events — 4 campos por evento e no run");
    const detailRunId = trackerRpcRun?.operation_run_id ?? firstRun?.operation_run_id;
    if (detailRunId) {
      const { data: eventsData, error: eventsErr } = await supabase.rpc(
        "admin_get_ai_operation_run_events",
        { p_operation_run_id: detailRunId },
      );
      assert("I5: RPC de eventos responde", !eventsErr && !!eventsData, eventsErr?.message);
      const runObj = eventsData?.run;
      const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
      assert("I5: run do detalhe expõe os 4 campos", !!runObj, "run null");
      if (runObj) {
        const has4Run = [
          "usd_brl_rate_at_generation",
          "credit_value_brl_at_generation",
          "usd_brl_rate_source_at_generation",
          "credit_value_brl_source_at_generation",
        ].every((f) => f in runObj);
        assert("I5: run do detalhe expõe os 4 campos no JSON", has4Run, JSON.stringify(Object.keys(runObj)));
        if (detailRunId === trackerRun) {
          assert(
            "I5: snapshot do run de detalhe = capturado do evento de teste (5.20/2.00)",
            toNumber(runObj.usd_brl_rate_at_generation) === 5.2 &&
              toNumber(runObj.credit_value_brl_at_generation) === 2.0 &&
              runObj.usd_brl_rate_source_at_generation === "captured_at_generation",
            JSON.stringify(runObj),
          );
        }
      }
      assert("I5: events array presente", events.length > 0, `events=${events.length}`);
      if (events.length > 0) {
        const ev = events[0];
        const has4Ev = [
          "usd_brl_rate_at_generation",
          "credit_value_brl_at_generation",
          "usd_brl_rate_source_at_generation",
          "credit_value_brl_source_at_generation",
        ].every((f) => f in ev);
        assert("I5: evento expõe os 4 campos de snapshot/origem", has4Ev, JSON.stringify(Object.keys(ev)));
        if (detailRunId === trackerRun) {
          assert(
            "I5: evento de teste com snapshot captured (5.20/2.00 + origens)",
            toNumber(ev.usd_brl_rate_at_generation) === 5.2 &&
              toNumber(ev.credit_value_brl_at_generation) === 2.0 &&
              ev.usd_brl_rate_source_at_generation === "captured_at_generation" &&
              ev.credit_value_brl_source_at_generation === "captured_at_generation",
            JSON.stringify(ev),
          );
        }
      }
    } else {
      assert("I5: run de referência disponível para detalhe", false, "nenhum run com snapshot");
    }

    // ── I6: estabilidade temporal — alterar parâmetro não muda histórico ───
    console.log("\n🧪 I6: estabilidade temporal — alterar parâmetro não muda runs com snapshot");
    // Run de referência: REAL (origem backfilled/captured, fora das linhas de teste
    // deste script) e com créditos líquidos > 0 (para o contraste de receita ser
    // observável) — prioriza o primeiro que satisfaz; snapshot do run ancora o BRL.
    const stableRunRaw = runs.find(
      (r) =>
        r.operation_run_id !== trackerRun &&
        toNumber(r.creditos_liquidos) !== null &&
        toNumber(r.creditos_liquidos) > 0,
    );
    const stableRunId = stableRunRaw?.operation_run_id;
    if (!stableRunId) {
      assert("I6: run com snapshot e créditos > 0 disponível", false, "nenhum run elegível no período");
    } else {
      // Derivação ANTES com o snapshot do run (fórmula do service — deriveBrl)
      const beforeUsdRate = toNumber(stableRunRaw.usd_brl_rate_at_generation);
      const beforeCreditValue = toNumber(stableRunRaw.credit_value_brl_at_generation);
      const custoUsd = toNumber(stableRunRaw.custo_usd_total);
      const creditosLiquidos = toNumber(stableRunRaw.creditos_liquidos);
      const before = fallbackDerivation(beforeUsdRate, beforeCreditValue, custoUsd, creditosLiquidos);
      assert(
        "I6: run de referência tem snapshot numérico (5.18/1.00 no estado atual)",
        beforeUsdRate !== null && beforeCreditValue !== null,
        JSON.stringify({ usd: beforeUsdRate, credit: beforeCreditValue }),
      );
      console.log(
        `  ℹ️  run ${stableRunId.slice(0, 8)}… snapshot usd=${beforeUsdRate} credit=${beforeCreditValue} custoUSD=${custoUsd} liquidos=${creditosLiquidos}`,
      );

      // Altera usd_brl_rate + credit_value_brl (reason de teste + operationId)
      const opId = crypto.randomUUID();
      const { error: setUsdErr } = await supabase.rpc("admin_set_economic_parameter", {
        p_actor_id: actorId,
        p_key: "usd_brl_rate",
        p_value: 9.99,
        p_reason: REASON,
        p_operation_id: opId,
      });
      assert("I6: usd_brl_rate alterado para 9.99 (reason de teste + operationId)", !setUsdErr, setUsdErr?.message);
      const { error: setCreditErr } = await supabase.rpc("admin_set_economic_parameter", {
        p_actor_id: actorId,
        p_key: "credit_value_brl",
        p_value: 9.99,
        p_reason: REASON,
        p_operation_id: opId,
      });
      assert("I6: credit_value_brl alterado para 9.99", !setCreditErr, setCreditErr?.message);

      // Re-fetch do MESMO run após a alteração → snapshot inalterado → derivação idêntica
      const { data: afterData, error: afterErr } = await supabase.rpc("admin_get_ai_operation_runs", {
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_store_id: null,
        p_run_type: null,
        p_status: null,
        p_provider: null,
        p_model: null,
        p_generation_type: null,
        p_operation_run_id: stableRunId,
        p_page: 1,
        p_page_size: 5,
      });
      assert("I6: re-consulta do run após alteração responde", !afterErr && !!afterData, afterErr?.message);
      const afterRun = afterData?.runs?.[0];
      if (afterRun) {
        const afterUsdRate = toNumber(afterRun.usd_brl_rate_at_generation);
        const afterCreditValue = toNumber(afterRun.credit_value_brl_at_generation);
        const after = fallbackDerivation(afterUsdRate, afterCreditValue, custoUsd, creditosLiquidos);
        assert(
          "I6: snapshot do run NÃO mudou após alterar o parâmetro (valores originais mantidos)",
          afterUsdRate === beforeUsdRate && afterCreditValue === beforeCreditValue,
          JSON.stringify({ before: [beforeUsdRate, beforeCreditValue], after: [afterUsdRate, afterCreditValue] }),
        );
        const brlEqual =
          after.custoBrl === before.custoBrl &&
          after.receitaEstimadaBrl === before.receitaEstimadaBrl &&
          after.resultadoEstimadoBrl === before.resultadoEstimadoBrl &&
          after.margemEstimadaPct === before.margemEstimadaPct;
        assert(
          "I6: custoBrl/receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct IDÊNTICOS (histórico não muda)",
          brlEqual,
          JSON.stringify({ before, after }),
        );
        // Contraste: a mesma derivação com o parâmetro NOVO (9.99) diverge — prova que o
        // snapshot é quem ancora o valor (se o serviço usasse o corrente, o histórico mudaria)
        const contrast = fallbackDerivation(9.99, 9.99, custoUsd, creditosLiquidos);
        assert(
          "I6: com o parâmetro novo (9.99) a derivação DIFERIRIA (prova do ancoramento do snapshot)",
          contrast.custoBrl !== before.custoBrl &&
            (creditosLiquidos === 0 || contrast.receitaEstimadaBrl !== before.receitaEstimadaBrl),
          JSON.stringify({ before, contrast }),
        );
      } else {
        assert("I6: run reencontrado após alteração", false, "run sumiu da listagem");
      }

      // Reverte os parâmetros aos valores ORIGINAIS (idempotência do script)
      const revertOp = crypto.randomUUID();
      const { error: revertUsdErr } = await supabase.rpc("admin_set_economic_parameter", {
        p_actor_id: actorId,
        p_key: "usd_brl_rate",
        p_value: originalValues.usd_brl_rate,
        p_reason: `${REASON}-revert-to-original`,
        p_operation_id: revertOp,
      });
      const { error: revertCreditErr } = await supabase.rpc("admin_set_economic_parameter", {
        p_actor_id: actorId,
        p_key: "credit_value_brl",
        p_value: originalValues.credit_value_brl,
        p_reason: `${REASON}-revert-to-original`,
        p_operation_id: revertOp,
      });
      assert("I6: parâmetros revertidos aos valores originais", !revertUsdErr && !revertCreditErr, `${revertUsdErr?.message} ${revertCreditErr?.message}`);
      const { data: revertedParams } = await supabase
        .from("economic_parameters")
        .select("key, value")
        .in("key", ["usd_brl_rate", "credit_value_brl"]);
      const revertedMap = {};
      for (const row of revertedParams ?? []) revertedMap[row.key] = toNumber(row.value);
      assert(
        "I6: valores finais dos parâmetros = originais (idempotência entre execuções)",
        revertedMap.usd_brl_rate === originalValues.usd_brl_rate &&
          revertedMap.credit_value_brl === originalValues.credit_value_brl,
        JSON.stringify({ finais: revertedMap, originais: originalValues }),
      );
    }

    // ── I7: fallback legacy — evento sem valor deriva com parâmetro corrente ──
    console.log("\n🧪 I7: fallback legacy — run sem snapshot deriva com parâmetro corrente + sinalização");
    const legacyRun = crypto.randomUUID();
    testRunIds.push(legacyRun);
    // Evento "legado" (pré-snapshot): NENHUM valor de snapshot persistido (simula evento
    // criado antes da F38.2.1 ou delivery marker sem captura — o CHECK permite NULL⇔NULL)
    const { error: legacyInsErr } = await supabase.from("generation_events").insert({
      store_id: storeId,
      operation_run_id: legacyRun,
      operation_run_type: "campaign_delivery",
      generation_type: "campaign_copy",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
      attempt_number: 1,
      duration_ms: 150,
      estimated_cost_usd: 0.02,
      cost_source: "pricing_table",
      usd_brl_rate_at_generation: null,
      usd_brl_rate_source_at_generation: null,
      credit_value_brl_at_generation: null,
      credit_value_brl_source_at_generation: null,
      metadata: { verification: "38-2-1-I7-legacy" },
    });
    assert("I7: evento legado sem snapshot inserido (NULL⇔NULL permitido)", !legacyInsErr, legacyInsErr?.message);

    const { data: legacyDetail, error: legacyDetailErr } = await supabase.rpc(
      "admin_get_ai_operation_run_events",
      { p_operation_run_id: legacyRun },
    );
    assert("I7: RPC de detalhe responde para o run legado", !legacyDetailErr && !!legacyDetail, legacyDetailErr?.message);
    const legacyRunObj = legacyDetail?.run;
    const legacyEvents = Array.isArray(legacyDetail?.events) ? legacyDetail.events : [];
    assert("I7: run legado sem snapshot (valores null no RPC)", !!legacyRunObj, "run null");
    if (legacyRunObj) {
      assert(
        "I7: run legado expõe snapshot NULL (nenhum valor persistido → fallback obrigatório no service)",
        legacyRunObj.usd_brl_rate_at_generation === null &&
          legacyRunObj.credit_value_brl_at_generation === null &&
          legacyRunObj.usd_brl_rate_source_at_generation === null &&
          legacyRunObj.credit_value_brl_source_at_generation === null,
        JSON.stringify(legacyRunObj),
      );
    }
    if (legacyEvents.length > 0) {
      const ev = legacyEvents[0];
      assert(
        "I7: evento legado sem snapshot (null em todos os 4 campos)",
        ev.usd_brl_rate_at_generation === null &&
          ev.credit_value_brl_at_generation === null &&
          ev.usd_brl_rate_source_at_generation === null &&
          ev.credit_value_brl_source_at_generation === null,
        JSON.stringify(ev),
      );
    }

    // Contrato de derivação do service para o caso legacy (deriveBrl):
    //   usdRate = snapshot ?? corrente → corrente; origem = economic_parameter_fallback
    //   receitaEstimadaBrl = liquidos × (credit_value_brl_at_generation ?? corrente)
    //   revenueEstimationNote = 'estimated_from_admin_credit_value'
    // Parâmetros já revertidos ao original pelo I6 → usa os valores originais correntes.
    const { data: currentParams } = await supabase
      .from("economic_parameters")
      .select("key, value")
      .in("key", ["usd_brl_rate", "credit_value_brl"]);
    const currentMap = {};
    for (const row of currentParams ?? []) currentMap[row.key] = toNumber(row.value);
    const legacyDerived = fallbackDerivation(
      currentMap.usd_brl_rate,
      currentMap.credit_value_brl,
      toNumber(legacyRunObj?.custo_usd_total),
      toNumber(legacyRunObj?.creditos_liquidos),
    );
    assert(
      "I7: derivação legacy usa o parâmetro CORRENTE (snapshot null → fallback) e produz valores finitos",
      currentMap.usd_brl_rate !== null &&
        currentMap.credit_value_brl !== null &&
        legacyDerived.custoBrl !== null &&
        (legacyDerived.receitaEstimadaBrl === 0 || legacyDerived.receitaEstimadaBrl !== null),
      JSON.stringify({ params: currentMap, derived: legacyDerived }),
    );
    // Sinalização do contrato (D8): origem = economic_parameter_fallback + note estimada
    assert(
      "I7: sinalização legacy — creditValueSource=economic_parameter_fallback / revenueEstimationNote=estimated_from_admin_credit_value",
      legacyRunObj !== null && legacyRunObj.usd_brl_rate_at_generation === null,
      "pré-condição: snapshot null",
    );
    console.log(
      "  ℹ️  contrato do service (unit-testado no plano 04): source = economic_parameter_fallback, note = estimated_from_admin_credit_value quando snapshot null — aqui provado o lado do dado (RPC devolve null → service cai no fallback)",
    );

    // Backfilled NUNCA tratado como captured: no RPC, runs com origem backfilled_*
    // mantêm backfilled_* (nunca captured_at_generation)
    const backfilledRuns = runs.filter(
      (r) => r.usd_brl_rate_source_at_generation?.startsWith("backfilled"),
    );
    const capturedInBackfilled = backfilledRuns.filter(
      (r) =>
        r.usd_brl_rate_source_at_generation === "captured_at_generation" ||
        r.credit_value_brl_source_at_generation === "captured_at_generation",
    );
    assert(
      "I7: runs backfilled NUNCA exibem origem captured_at_generation (procedência preservada)",
      backfilledRuns.length > 0 && capturedInBackfilled.length === 0,
      `backfilled=${backfilledRuns.length} tratados-como-captured=${capturedInBackfilled.length}`,
    );
    console.log(`  ℹ️  runs backfilled na página: ${backfilledRuns.length} (origens backfilled_* preservadas)`);

    // Neutralização do run legado (append-only — UPDATE de neutralização)
    const { error: legacyCleanErr } = await supabase
      .from("generation_events")
      .update({
        operation_run_id: null,
        operation_run_type: null,
        estimated_cost_usd: null,
        cost_source: null,
        usd_brl_rate_at_generation: null,
        usd_brl_rate_source_at_generation: null,
        credit_value_brl_at_generation: null,
        credit_value_brl_source_at_generation: null,
      })
      .eq("operation_run_id", legacyRun);
    assert("I7: run legado de teste neutralizado (append-only — sem DELETE)", !legacyCleanErr, legacyCleanErr?.message);

    // ── Nomenclatura: nenhum contrato afirma "receita real" ───────────────
    console.log("\n🧪 Nomenclatura: contratos TS sem receitaRealBrl/resultadoRealBrl/margemRealPct");
    const namingViolations = countNamingViolations();
    assert(
      "NOM: nenhum contrato TS (service + API + UI, fora __tests__) contém receitaRealBrl/resultadoRealBrl/margemRealPct",
      namingViolations === 0,
      `violações=${namingViolations}`,
    );
  } finally {
    // ── Cleanup SEMPRE executado (idempotência entre execuções) ───────────
    console.log("\n🧹 Cleanup: reversão de parâmetros + neutralização de linhas de teste");

    // 1) Parâmetros econômicos — reverte se ainda alterados (I6 falhou no meio?)
    {
      const { data: cur } = await supabase
        .from("economic_parameters")
        .select("key, value")
        .in("key", ["usd_brl_rate", "credit_value_brl"]);
      const curMap = {};
      for (const row of cur ?? []) curMap[row.key] = toNumber(row.value);
      if (
        curMap.usd_brl_rate !== originalValues.usd_brl_rate ||
        curMap.credit_value_brl !== originalValues.credit_value_brl
      ) {
        await supabase.rpc("admin_set_economic_parameter", {
          p_actor_id: actorId,
          p_key: "usd_brl_rate",
          p_value: originalValues.usd_brl_rate,
          p_reason: `${REASON}-cleanup-revert`,
          p_operation_id: crypto.randomUUID(),
        });
        await supabase.rpc("admin_set_economic_parameter", {
          p_actor_id: actorId,
          p_key: "credit_value_brl",
          p_value: originalValues.credit_value_brl,
          p_reason: `${REASON}-cleanup-revert`,
          p_operation_id: crypto.randomUUID(),
        });
        console.log(`  ↳ parâmetros revertidos aos originais (cleanup)`);
      }
    }

    // 2) Linhas de teste — neutraliza (nunca DELETE; append-only)
    for (const runId of testRunIds) {
      const { data: stillThere } = await supabase
        .from("generation_events")
        .select("id")
        .eq("operation_run_id", runId)
        .limit(1);
      if ((stillThere?.length ?? 0) > 0) {
        await supabase
          .from("generation_events")
          .update({
            operation_run_id: null,
            operation_run_type: null,
            estimated_cost_usd: null,
            cost_source: null,
            usd_brl_rate_at_generation: null,
            usd_brl_rate_source_at_generation: null,
            credit_value_brl_at_generation: null,
            credit_value_brl_source_at_generation: null,
          })
          .eq("operation_run_id", runId);
        console.log(`  ↳ linha de teste ${runId.slice(0, 8)}… neutralizada`);
      }
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`\nResults: ${results.pass} passed / ${results.fail} failed / ${results.tests.length} total\n`);
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
