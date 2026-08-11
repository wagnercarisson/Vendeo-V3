// F38.2 SQL Verification I1-I6: economic_parameters + audit + RPC + confidence columns + operation run RPCs + metrics
// Padrão F38 (38-operation-cost-verification.mjs) e F38.1 (38-1-ai-cost-verification.mjs).
// Regra operacional (F38.1): NUNCA DELETE em generation_events — apenas SELECT.
// Nenhum script destrutivo é commitado.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
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
const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, anonKey);

const results = { pass: 0, fail: 0, tests: [] };
const assert = (name, ok, detail) => {
  ok
    ? (results.pass++, console.log(`  ✓ ${name}`))
    : (results.fail++, console.log(`  ✗ ${name} — ${detail}`));
  results.tests.push({ name, ok, detail });
};

const REASON = "38-2-10-verification";

// Tolerância para NUMERIC do Postgres (string) — normaliza para number
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function run() {
  console.log(`\n🔍 F38.2 SQL Verification I1-I6\n`);

  // Resolve real actor (FK auth.users) — mesmo padrão F38/F38.1
  const { data: userList, error: userListError } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (userListError || !userList?.users?.length) {
    console.error("No real auth user found to use as verification actor");
    process.exit(1);
  }
  const actorId = userList.users[0].id;
  console.log(`Actor: ${actorId}\n`);

  // ── I1: economic_parameters schema + seeds + CHECK + RLS ─────────────
  console.log("🧪 I1: economic_parameters schema + seeds + RLS");

  // Colunas: key PK, value NUMERIC NOT NULL, updated_by, updated_at, created_at
  const { data: epRows, error: epErr } = await supabase
    .from("economic_parameters")
    .select("key, value, updated_by, updated_at, created_at")
    .order("key", { ascending: true });
  assert("I1: select de colunas (key/value/updated_by/updated_at/created_at) sem erro", !epErr, epErr?.message);
  assert("I1: 2 seeds presentes", !epErr && epRows?.length === 2, `rows=${epRows?.length}`);

  const usdSeed = epRows?.find((r) => r.key === "usd_brl_rate");
  const creditSeed = epRows?.find((r) => r.key === "credit_value_brl");
  // Valor do seed = 1.00 é o contrato (D1 conservador). updated_by NULL vale só para o
  // estado inicial; após a 1ª edição via UI/RPC, a auditoria registra o admin (esperado).
  assert(
    "I1: seed usd_brl_rate = 1.00 (valor conservador D1)",
    toNumber(usdSeed?.value) === 1,
    JSON.stringify(usdSeed),
  );
  assert(
    "I1: seed credit_value_brl = 1.00 (valor conservador D1)",
    toNumber(creditSeed?.value) === 1,
    JSON.stringify(creditSeed),
  );
  if (usdSeed?.updated_by) {
    console.log(`  ℹ️  usd_brl_rate já foi editado via UI/RPC (updated_by=${usdSeed.updated_by} em ${usdSeed.updated_at}) — evidência do fluxo de auditoria funcionando; valor mantido em 1.00`);
  }

  // CHECK value > 0: INSERT com value 0 deve falhar (23514) — sem linha criada
  const badKey = `verify-${crypto.randomUUID().slice(0, 8)}`;
  const { error: checkErr } = await supabase
    .from("economic_parameters")
    .insert({ key: badKey, value: 0 });
  assert(
    "I1: CHECK value > 0 rejeita value=0 (23514)",
    !!checkErr && (checkErr.message?.includes("23514") || checkErr.code === "23514" || checkErr.message?.includes("chk") || checkErr.message?.includes("violates")),
    checkErr?.message,
  );
  const { data: badRow } = await supabase.from("economic_parameters").select("key").eq("key", badKey).single();
  assert("I1: linha inválida NÃO criada", !badRow, JSON.stringify(badRow));

  // RLS: anon sem acesso (sem GRANT — REVOKE ALL FROM anon, authenticated na migration)
  const { data: anonData, error: anonErr } = await anonClient
    .from("economic_parameters")
    .select("*")
    .limit(5);
  assert(
    "I1: anon sem acesso (permission denied)",
    !!anonErr && (anonErr.message?.includes("permission denied") || anonErr.code === "42501"),
    `error=${anonErr?.message} data=${JSON.stringify(anonData)}`,
  );

  // ── I2: audit append-only + reason NOT NULL + UNIQUE parcial operation_id ──
  console.log("\n🧪 I2: economic_parameter_audit append-only + reason + UNIQUE operation_id");

  // Trigger imutável: UPDATE/DELETE bloqueados mesmo para service_role.
  // Usa uma linha de audit real criada pelo RPC no I3 abaixo — garante existência.
  // (I3 roda primeiro via sequência, então garantimos 1 linha real aqui antes de testar.)
  const opForAudit = crypto.randomUUID();
  const { data: rpcAuditSeed, error: rpcAuditSeedErr } = await supabase.rpc(
    "admin_set_economic_parameter",
    {
      p_actor_id: actorId,
      p_key: "usd_brl_rate",
      p_value: 5.5,
      p_reason: REASON,
      p_operation_id: opForAudit,
    },
  );
  assert("I2: linha de audit de referência criada via RPC", !rpcAuditSeedErr && !!rpcAuditSeed?.audit_id, rpcAuditSeedErr?.message);

  const { data: auditFirst, error: auditFirstErr } = await supabase
    .from("economic_parameter_audit")
    .select("id, reason, operation_id")
    .eq("operation_id", opForAudit)
    .single();
  assert("I2: audit row encontrada (append-only — dado real)", !auditFirstErr && !!auditFirst, auditFirstErr?.message);

  const { error: updateErr } = await supabase
    .from("economic_parameter_audit")
    .update({ reason: "hacked" })
    .eq("id", auditFirst.id);
  assert("I2: UPDATE bloqueado (trigger imutável)", !!updateErr && updateErr.message?.includes("append-only"), updateErr?.message || "expected error");

  const { error: deleteErr } = await supabase
    .from("economic_parameter_audit")
    .delete()
    .eq("id", auditFirst.id);
  assert("I2: DELETE bloqueado (trigger imutável)", !!deleteErr && deleteErr.message?.includes("append-only"), deleteErr?.message || "expected error");

  const { data: auditStill, error: auditStillErr } = await supabase
    .from("economic_parameter_audit")
    .select("id, reason")
    .eq("id", auditFirst.id)
    .single();
  assert("I2: linha inalterada após UPDATE/DELETE", !auditStillErr && auditStill?.reason === REASON, auditStillErr?.message || `${auditStill?.reason} !== ${REASON}`);

  // reason NOT NULL (23502)
  const { error: reasonErr } = await supabase
    .from("economic_parameter_audit")
    .insert({
      key: "usd_brl_rate",
      old_value: 1,
      new_value: 2,
      actor_id: actorId,
      reason: null,
    });
  assert(
    "I2: reason obrigatório (NOT NULL 23502)",
    !!reasonErr && (reasonErr.code === "23502" || reasonErr.message?.includes("23502")),
    reasonErr?.message,
  );

  // UNIQUE parcial (operation_id) WHERE NOT NULL: 2º insert com mesmo operation_id → 23505
  const dupOpId = crypto.randomUUID();
  const { error: dupFirstErr } = await supabase
    .from("economic_parameter_audit")
    .insert({
      key: `verify-dup-${crypto.randomUUID().slice(0, 6)}`,
      old_value: null,
      new_value: 1,
      actor_id: actorId,
      reason: REASON,
      operation_id: dupOpId,
    });
  assert("I2: 1º insert com operation_id ok (linha teste)", !dupFirstErr, dupFirstErr?.message);
  const { error: dupSecondErr } = await supabase
    .from("economic_parameter_audit")
    .insert({
      key: `verify-dup-${crypto.randomUUID().slice(0, 6)}`,
      old_value: null,
      new_value: 2,
      actor_id: actorId,
      reason: REASON,
      operation_id: dupOpId,
    });
  assert(
    "I2: 2º insert mesmo operation_id → 23505 (UNIQUE parcial)",
    !!dupSecondErr && (dupSecondErr.code === "23505" || dupSecondErr.message?.includes("23505")),
    dupSecondErr?.message,
  );
  const { data: dupRows, error: dupCountErr } = await supabase
    .from("economic_parameter_audit")
    .select("id")
    .eq("operation_id", dupOpId);
  assert("I2: apenas 1 linha para o operation_id", !dupCountErr && dupRows?.length === 1, dupCountErr?.message || `count=${dupRows?.length}`);

  // ── I3: RPC admin_set_economic_parameter transacional + validações + idempotência ──
  console.log("\n🧪 I3: RPC admin_set_economic_parameter (transacional + validações + idempotência)");

  // A chamada de referência do I2 (opForAudit) JÁ testou: sucesso + audit old/new + update atômico.
  // Verificamos o conteúdo da linha de audit dessa chamada (old=1.00 seed → new=5.5):
  const { data: auditContent, error: auditContentErr } = await supabase
    .from("economic_parameter_audit")
    .select("old_value, new_value, actor_id, reason, operation_id")
    .eq("operation_id", opForAudit)
    .single();
  assert(
    "I3: audit da 1ª chamada — old=1.00 (seed) → new=5.5, actor/reason/operation_id corretos",
    !auditContentErr &&
      toNumber(auditContent?.old_value) === 1 &&
      toNumber(auditContent?.new_value) === 5.5 &&
      auditContent?.actor_id === actorId &&
      auditContent?.reason === REASON &&
      auditContent?.operation_id === opForAudit,
    auditContentErr?.message || JSON.stringify(auditContent),
  );
  // UPDATE aplicado na mesma transação (transacional: update + insert audit atômicos)
  const { data: currentVal, error: currentValErr } = await supabase
    .from("economic_parameters")
    .select("value, updated_by")
    .eq("key", "usd_brl_rate")
    .single();
  assert(
    "I3: valor atualizado para 5.5 na mesma transação (update + audit juntos)",
    !currentValErr && toNumber(currentVal?.value) === 5.5 && currentVal?.updated_by === actorId,
    currentValErr?.message || JSON.stringify(currentVal),
  );

  // Rollback em erro: value <= 0 → erro → estado inalterado e SEM linha de audit nova
  const failedOp = crypto.randomUUID();
  const { data: i3bad, error: e3bad } = await supabase.rpc("admin_set_economic_parameter", {
    p_actor_id: actorId,
    p_key: "usd_brl_rate",
    p_value: 0,
    p_reason: REASON,
    p_operation_id: failedOp,
  });
  assert("I3: value <= 0 rejeitado (economic_parameter_value_positive)", !!e3bad && e3bad.message?.includes("economic_parameter_value_positive"), e3bad?.message || JSON.stringify(i3bad));
  const { data: afterInvalid } = await supabase
    .from("economic_parameters")
    .select("value")
    .eq("key", "usd_brl_rate")
    .single();
  assert("I3: valor NÃO alterado após erro (rollback — sem partial)", toNumber(afterInvalid?.value) === 5.5, JSON.stringify(afterInvalid));
  const { data: failedAudit, error: failedAuditErr } = await supabase
    .from("economic_parameter_audit")
    .select("id")
    .eq("operation_id", failedOp);
  assert("I3: nenhuma linha de audit criada na chamada que falhou", !failedAuditErr && failedAudit?.length === 0, failedAuditErr?.message || `count=${failedAudit?.length}`);

  // reason obrigatório (400 no zod; erro do RPC aqui)
  const { data: i3noreason, error: e3noreason } = await supabase.rpc("admin_set_economic_parameter", {
    p_actor_id: actorId,
    p_key: "usd_brl_rate",
    p_value: 5.5,
    p_reason: "",
    p_operation_id: crypto.randomUUID(),
  });
  assert("I3: reason vazio rejeitado (economic_parameter_reason_required)", !!e3noreason && e3noreason.message?.includes("economic_parameter_reason_required"), e3noreason?.message || JSON.stringify(i3noreason));

  // key obrigatória
  const { data: i3nokey, error: e3nokey } = await supabase.rpc("admin_set_economic_parameter", {
    p_actor_id: actorId,
    p_key: "",
    p_value: 5.5,
    p_reason: REASON,
    p_operation_id: crypto.randomUUID(),
  });
  assert("I3: key vazia rejeitada (economic_parameter_key_required)", !!e3nokey && e3nokey.message?.includes("economic_parameter_key_required"), e3nokey?.message || JSON.stringify(i3nokey));

  // Retry idempotente: mesmo operation_id → idempotent:true, MESMO audit_id, 1 linha de audit
  const { data: i3retry, error: e3retry } = await supabase.rpc("admin_set_economic_parameter", {
    p_actor_id: actorId,
    p_key: "usd_brl_rate",
    p_value: 9.99,
    p_reason: REASON,
    p_operation_id: opForAudit,
  });
  assert("I3: retry com mesmo operation_id → idempotent:true", !e3retry && i3retry?.idempotent === true, e3retry?.message || JSON.stringify(i3retry));
  assert("I3: retry retorna o MESMO audit_id", !e3retry && i3retry?.audit_id === rpcAuditSeed?.audit_id, `${i3retry?.audit_id} !== ${rpcAuditSeed?.audit_id}`);
  const { data: idemCount, error: idemCountErr } = await supabase
    .from("economic_parameter_audit")
    .select("id")
    .eq("operation_id", opForAudit);
  assert("I3: exatamente 1 linha de audit para o operation_id (idempotente)", !idemCountErr && idemCount?.length === 1, idemCountErr?.message || `count=${idemCount?.length}`);
  // Valor NÃO mudou para 9.99 (idempotent retorna cedo — sem update)
  const { data: afterRetry } = await supabase
    .from("economic_parameters")
    .select("value")
    .eq("key", "usd_brl_rate")
    .single();
  assert("I3: retry não alterou o valor (5.5 mantido)", toNumber(afterRetry?.value) === 5.5, JSON.stringify(afterRetry));

  // Cleanup: reverte usd_brl_rate para o seed 1.00 (motivo explícito) — trail de audit fica (append-only por desenho)
  const { data: i3revert, error: e3revert } = await supabase.rpc("admin_set_economic_parameter", {
    p_actor_id: actorId,
    p_key: "usd_brl_rate",
    p_value: 1.0,
    p_reason: "38-2-10-revert-to-seed",
    p_operation_id: crypto.randomUUID(),
  });
  assert("I3: revert para seed 1.00 ok", !e3revert && !!i3revert?.audit_id && i3revert?.idempotent === false, e3revert?.message || JSON.stringify(i3revert));

  // ── I4: generation_events 4 colunas de confiança (D5) ───────────────
  console.log("\n🧪 I4: generation_events — 4 colunas novas de confiança (D5)");

  const { error: geErr } = await supabase
    .from("generation_events")
    .select("cost_formula_version, cost_estimation_note, text_component_usd, image_tool_component_usd")
    .limit(1);
  assert(
    "I4: 4 colunas novas selecionáveis (cost_formula_version, cost_estimation_note, text_component_usd, image_tool_component_usd)",
    !geErr,
    geErr?.message,
  );

  // Evidência do tracker persistindo (daqui para frente — eventos pós-38-2-03):
  const { data: withFormula, error: wfErr } = await supabase
    .from("generation_events")
    .select("id")
    .not("cost_formula_version", "is", null)
    .limit(1);
  const { data: withText, error: wtErr } = await supabase
    .from("generation_events")
    .select("id")
    .not("text_component_usd", "is", null)
    .limit(1);
  const persistedCount = (withFormula?.length || 0) + (withText?.length || 0);
  console.log(`  ℹ️  eventos com cost_formula_version/text_component_usd persistidos: ${persistedCount}`);
  assert("I4: consulta de persistência sem erro", !wfErr && !wtErr, `${wfErr?.message} ${wtErr?.message}`);
  // O comportamento de persistência do AiCostTracker é coberto por 4 unit tests (tarefa 12.3, plano 38-2-03);
  // aqui registramos a evidência de colunas no banco real (dado pode ser 0 se não houve geração pós-tracker).

  // ── I5: RPCs admin_get_ai_operation_runs/_events ─────────────────────
  console.log("\n🧪 I5: RPCs admin_get_ai_operation_runs/_events (filtros, paginação, P95, segmento, badges, componentes)");

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
  assert("I5: RPC de runs responde (filtros + paginação)", !runsErr && !!runsData, runsErr?.message);
  const runs = Array.isArray(runsData?.runs) ? runsData.runs : [];
  assert("I5: runs é array e ≤ page_size (5)", runs.length <= 5, `runs=${runs.length}`);
  assert("I5: summary presente com total", !!runsData?.summary && typeof runsData?.summary?.total === "number", JSON.stringify(runsData?.summary));
  assert("I5: page=1 e total consistente", runsData?.page === 1 && runsData?.total === runsData?.summary?.total, JSON.stringify({ page: runsData?.page, total: runsData?.total, sTotal: runsData?.summary?.total }));

  const firstRun = runs[0];
  if (firstRun) {
    // Evidências brutas de segmento (D9) — RPC expõe, NÃO classifica
    assert("I5: run expõe store_is_test (D9)", "store_is_test" in firstRun, "store_is_test ausente");
    assert("I5: run expõe deduction_purchased_amount/deduction_bonus_amount (D9)", "deduction_purchased_amount" in firstRun && "deduction_bonus_amount" in firstRun, JSON.stringify(Object.keys(firstRun)));
    assert("I5: run expõe admin_grant_evidence (D9)", "admin_grant_evidence" in firstRun, "admin_grant_evidence ausente");
    // Insumos agregados de badge (D5)
    assert("I5: cost_sources array presente (D5)", Array.isArray(firstRun.cost_sources), JSON.stringify(firstRun.cost_sources));
    assert("I5: cost_estimation_notes array presente (D5)", Array.isArray(firstRun.cost_estimation_notes), JSON.stringify(firstRun.cost_estimation_notes));
    const hasFlags = ["has_provider_reported", "has_provisional_image_estimate", "has_partial_estimate", "has_not_available", "has_estimated"].every(
      (f) => typeof firstRun[f] === "boolean",
    );
    assert("I5: flags has_* booleanas presentes (D5)", hasFlags, JSON.stringify(firstRun));
    // P95 no summary
    const hasP95 = "p95_ms" in runsData.summary;
    assert("I5: summary expõe p95_ms (percentile_cont)", hasP95, JSON.stringify(runsData.summary));

    // Detalhe call-level: RPC de eventos com text_component_usd/image_tool_component_usd
    const { data: eventsData, error: eventsErr } = await supabase.rpc("admin_get_ai_operation_run_events", {
      p_operation_run_id: firstRun.operation_run_id,
    });
    assert("I5: RPC de eventos responde", !eventsErr && !!eventsData, eventsErr?.message);
    const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
    assert("I5: events array presente", events.length >= 0, `events=${events.length}`);
    if (events.length > 0) {
      const ev = events[0];
      assert(
        "I5: evento expõe text_component_usd/image_tool_component_usd (D4/D5)",
        "text_component_usd" in ev && "image_tool_component_usd" in ev,
        JSON.stringify(Object.keys(ev)),
      );
      assert("I5: evento expõe cost_source/cost_formula_version/cost_estimation_note", "cost_source" in ev && "cost_formula_version" in ev && "cost_estimation_note" in ev, JSON.stringify(Object.keys(ev)));
    }
  } else {
    assert("I5: run de referência disponível para detalhe", false, "nenhum run no período (dados de geração ausentes)");
  }

  // Limite de janela: > 365 dias → window_exceeded_365d (defesa T-38.2-06)
  const wideStart = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
  const { data: wideData, error: wideErr } = await supabase.rpc("admin_get_ai_operation_runs", {
    p_period_start: wideStart,
    p_period_end: periodEnd,
    p_store_id: null,
    p_run_type: null,
    p_status: null,
    p_provider: null,
    p_model: null,
    p_generation_type: null,
    p_operation_run_id: null,
    p_page: 1,
    p_page_size: 25,
  });
  assert("I5: janela > 365d → window_exceeded_365d", !!wideErr && wideErr.message?.includes("window_exceeded_365d"), wideErr?.message || JSON.stringify(wideData));

  // ── I6: /admin/metrics corrigido em banco real (D6) ──────────────────
  console.log("\n🧪 I6: /admin/metrics — custo médio por apuração call-level (D6)");

  // (a) Apuração call-level por entrega retorna dados → média computável (NÃO NULL quando há entregas)
  const { data: costsData, error: costsErr } = await supabase.rpc("admin_get_ai_costs", {
    p_hours: 24 * 90,
    p_credit_unit_usd_value: null,
  });
  assert("I6: admin_get_ai_costs (by_operation_run) responde", !costsErr && !!costsData, costsErr?.message);
  const byRun = Array.isArray(costsData?.by_operation_run) ? costsData.by_operation_run : [];
  const runCosts = byRun.map((r) => toNumber(r.custo_usd_total)).filter((c) => c !== null);
  console.log(`  ℹ️  runs na apuração: ${byRun.length}, com custo: ${runCosts.length}`);
  if (runCosts.length > 0) {
    const avg = runCosts.reduce((a, b) => a + b, 0) / runCosts.length;
    assert("I6: média call-level por entrega computável (NÃO NULL)", Number.isFinite(avg) && avg > 0, `avg=${avg}`);
  } else {
    assert("I6: média call-level computável quando há entregas", false, "nenhum run com custo na janela de 90d");
  }

  // (b) Delivery markers da era F38.1+ (operation_run_id NOT NULL) NÃO carregam custo —
  // anti-dupla-contagem D1/D6 (o pipeline zera custo/tokens do marker na escrita).
  // Marcadores LEGADOS pré-F38.1 (operation_run_id NULL) podem reter custo histórico,
  // mas são INERTES: as views/RPCs de apuração filtram operation_run_id IS NOT NULL
  // e generation_type NOT IN ('campaign_pipeline',...) — nunca entram na conta.
  const { data: markedNew, error: mdErr } = await supabase
    .from("generation_events")
    .select("id")
    .eq("generation_type", "campaign_pipeline")
    .not("operation_run_id", "is", null)
    .not("estimated_cost_usd", "is", null)
    .limit(1);
  assert(
    "I6: NENHUM delivery marker pós-F38.1 (com operation_run_id) carrega custo (D1/D6)",
    !mdErr && (markedNew?.length || 0) === 0,
    mdErr?.message || `found=${markedNew?.length}`,
  );
  const { data: legacyMarkers, error: lmErr } = await supabase
    .from("generation_events")
    .select("id")
    .eq("generation_type", "campaign_pipeline")
    .is("operation_run_id", null)
    .not("estimated_cost_usd", "is", null);
  console.log(`  ℹ️  markers campaign_pipeline LEGADOS (operation_run_id NULL) com custo: ${legacyMarkers?.length ?? "?"} (inertes — fora da apuração)`);
  assert("I6: consulta de markers legados sem erro", !lmErr, lmErr?.message);

  // (c) Comportamento do getAvgCost (camada de leitura corrigida em 38-2-09) coberto por 4 unit tests
  // (tarefa 12.8 — não lê campaign_pipeline.estimated_cost_usd; card 'Custo Médio IA'; USD→BRL via
  //  economic_parameters.usd_brl_rate). A evidência real acima (a)+(b) sustenta o contrato no banco.

  console.log(`\n${"=".repeat(50)}`);
  console.log(`\nResults: ${results.pass} passed / ${results.fail} failed / ${results.tests.length} total\n`);
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
