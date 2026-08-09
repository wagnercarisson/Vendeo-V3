// F38.1 SQL Verification I1–I6: migration em banco real + RPC pricing + RLS + views + metrics
// Padrão: scripts/verify/38-operation-cost-verification.mjs (F38-08)
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
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
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
    ? (results.pass++, console.log(`  ✅ ${name}`))
    : (results.fail++, console.log(`  ❌ ${name} — ${detail}`));
  results.tests.push({ name, ok, detail });
};

const TEST_STORE_ID = "48b212f8-2b0f-4679-b553-122a601bacac"; // Padaria da Dona Maria (is_test_store)

async function run() {
  console.log(`\n🧪 F38.1 AI Cost Verification I1–I6\n`);

  // Resolve real actor (FK auth.users)
  const { data: userList, error: userListError } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (userListError || !userList?.users?.length) {
    console.error("No real auth user found to use as verification actor");
    process.exit(1);
  }
  const actorId = userList.users[0].id;
  console.log(`Actor: ${actorId}\n`);

  // ── I1: migration aplicada em banco real — colunas + CHECKs + índice parcial único ──
  console.log("🧪 I1: migration em banco real (colunas/CHECKs/índices)");
  const NEW_COLS = [
    "operation_run_id", "operation_run_type", "visual_signature_id", "theme_id",
    "cached_input_tokens", "image_tokens", "provider_reported_cost_usd",
    "cost_source", "pricing_version",
  ];
  const { data: colCheck, error: colErr } = await supabase
    .from("generation_events").select(NEW_COLS.join(",")).limit(1);
  assert("I1: 9 colunas novas em generation_events presentes", !colErr && !!colCheck, colErr?.message);

  const { error: campErr } = await supabase.from("campaigns").select("operation_run_id").limit(1);
  assert("I1: campaigns.operation_run_id presente", !campErr, campErr?.message);

  const { error: checkCostErr } = await supabase.from("generation_events").insert({
    store_id: TEST_STORE_ID,
    generation_type: "campaign_copy",
    status: "success",
    attempt_number: 1,
    cost_source: "invalid_source_value",
  });
  assert(
    "I1: CHECK chk_generation_events_cost_source ativo (insert inválido rejeitado)",
    !!checkCostErr && checkCostErr.code === "23514" && checkCostErr.message?.includes("chk_generation_events_cost_source"),
    checkCostErr?.message,
  );

  const { error: checkTypeErr } = await supabase.from("generation_events").insert({
    store_id: TEST_STORE_ID,
    generation_type: "bogus_type",
    status: "success",
    attempt_number: 1,
  });
  assert(
    "I1: CHECK chk_generation_events_type expandido ativo (D5)",
    !!checkTypeErr && checkTypeErr.code === "23514" && checkTypeErr.message?.includes("chk_generation_events_type"),
    checkTypeErr?.message,
  );

  const { error: dupPricingErr } = await supabase.from("ai_model_pricing").insert({
    provider: "openai",
    model: "gpt-4o",
    input_token_usd_per_1m: 2.5,
    output_token_usd_per_1m: 10,
    effective_from: "2026-08-08T00:00:00Z",
  });
  assert(
    "I1: índice parcial único uq_ai_model_pricing_vigente ativo (1 linha vigente por provider+model)",
    !!dupPricingErr && dupPricingErr.code === "23505" && dupPricingErr.message?.includes("uq_ai_model_pricing_vigente"),
    dupPricingErr?.message,
  );

  // ── I2: RPC admin_set_ai_model_price versiona (fecha vigente + abre nova, p_reason antes dos opcionais) ──
  console.log("\n🧪 I2: RPC admin_set_ai_model_price versiona (fecha + abre, p_reason)");
  const TEST_MODEL = `verify-${crypto.randomUUID().slice(0, 8)}`;

  // I2a: p_reason vazio → erro custom (validação antes dos opcionais; p_reason é
  // parâmetro SEM default na assinatura, então PostgREST rejeita a chamada sem ele
  // — provamos a validação passando string vazia e esperando o erro do corpo da função)
  const { data: i2a, error: e2a } = await supabase.rpc("admin_set_ai_model_price", {
    p_actor_id: actorId,
    p_provider: "openai",
    p_model: TEST_MODEL,
    p_input: 1.0,
    p_output: 2.0,
    p_reason: "",
  });
  assert(
    "I2a: p_reason ausente → erro ai_model_price_reason_required",
    !!e2a && !i2a && e2a.message?.includes("ai_model_price_reason_required"),
    e2a?.message,
  );

  // I2b: primeira chamada válida — abre a linha vigente (previous_id null)
  const { data: i2b, error: e2b } = await supabase.rpc("admin_set_ai_model_price", {
    p_actor_id: actorId,
    p_provider: "openai",
    p_model: TEST_MODEL,
    p_input: 1.0,
    p_output: 2.0,
    p_reason: "38-1-10-verification",
  });
  assert("I2b: primeira chamada retorna JSONB com id", !e2b && !!i2b?.id, e2b?.message || JSON.stringify(i2b));
  assert("I2b: previous_id null (sem linha anterior)", i2b?.previous_id === null, JSON.stringify(i2b));

  // I2c: segunda chamada — fecha a vigente e abre nova; previous_id = id da 1ª
  const { data: i2c, error: e2c } = await supabase.rpc("admin_set_ai_model_price", {
    p_actor_id: actorId,
    p_provider: "openai",
    p_model: TEST_MODEL,
    p_input: 1.5,
    p_output: 2.5,
    p_reason: "38-1-10-verification-v2",
  });
  assert("I2c: segunda chamada retorna novo id", !e2c && !!i2c?.id, e2c?.message || JSON.stringify(i2c));
  assert(
    "I2c: previous_id = id da 1ª linha (fecha a vigente)",
    i2c?.previous_id === i2b?.id,
    `previous=${i2c?.previous_id} expected=${i2b?.id}`,
  );

  // Verifica estado no banco: 2 linhas, 1ª fechada (effective_until NOT NULL), 2ª vigente
  const { data: pricingRows, error: pricingErr } = await supabase
    .from("ai_model_pricing")
    .select("id, input_token_usd_per_1m, output_token_usd_per_1m, effective_from, effective_until")
    .eq("provider", "openai")
    .eq("model", TEST_MODEL)
    .order("effective_from", { ascending: true });
  assert("I2: 2 linhas no banco (1 fechada + 1 vigente)", !pricingErr && pricingRows?.length === 2, pricingErr?.message || `rows=${pricingRows?.length}`);
  const first = pricingRows?.[0];
  const second = pricingRows?.[1];
  assert(
    "I2: linha 1 fechada (effective_until NOT NULL) + linha 2 vigente (effective_until NULL)",
    first?.effective_until !== null && second?.effective_until === null,
    JSON.stringify({ first, second }),
  );
  assert(
    "I2: transação preserva a mesma (provider, model) e preços novos na linha 2",
    second?.input_token_usd_per_1m === 1.5 && second?.output_token_usd_per_1m === 2.5,
    JSON.stringify(second),
  );

  // Cleanup das linhas de teste (service_role tem DELETE em ai_model_pricing — D8)
  const { error: delPricingErr } = await supabase
    .from("ai_model_pricing")
    .delete()
    .eq("provider", "openai")
    .eq("model", TEST_MODEL);
  assert("I2: cleanup linhas de teste (DELETE service_role)", !delPricingErr, delPricingErr?.message);

  // ── I3: RLS — authenticated não-admin sem acesso a ai_model_pricing ──
  console.log("\n🧪 I3: RLS ai_model_pricing (authenticated não-admin sem acesso)");
  const { data: anonData, error: anonError } = await anonClient.from("ai_model_pricing").select("*").limit(5);
  assert(
    "I3: anon sem acesso (permission denied)",
    !!anonError && anonError.message?.includes("permission denied"),
    `error=${anonError?.message} data=${JSON.stringify(anonData)}`,
  );

  // Cria usuário temporário authenticated não-admin → tenta SELECT → espera negado
  const tempEmail = `verify-38-1-10-${crypto.randomUUID().slice(0, 8)}@vendeo.test`;
  const tempPassword = crypto.randomUUID() + "Aa1!";
  const { data: tempUser, error: createErr } = await supabase.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    email_confirm: true,
  });
  assert("I3: usuário temporário criado", !createErr && !!tempUser?.user?.id, createErr?.message);

  // Client DEDICADO para o sign-in (evita que o client service-role principal
  // "herde" a sessão do usuário temporário e perca o bypass de RLS nas etapas I4/I5)
  const signInClient = createClient(supabaseUrl, anonKey);
  const { data: signInData, error: signInErr } = await signInClient.auth.signInWithPassword({
    email: tempEmail,
    password: tempPassword,
  });
  assert("I3: sign-in do usuário temporário", !signInErr && !!signInData?.session, signInErr?.message);

  if (signInData?.session) {
    // Client autenticado: anonKey como API key + Bearer do access_token do usuário
    const authedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } },
    });
    const { data: authedPricing, error: authedPricingErr } = await authedClient
      .from("ai_model_pricing").select("*").limit(5);
    assert(
      "I3: authenticated não-admin NÃO lê ai_model_pricing",
      !!authedPricingErr && authedPricingErr.message?.includes("permission denied"),
      `error=${authedPricingErr?.message} data=${JSON.stringify(authedPricing)}`,
    );
  } else {
    assert("I3: authenticated não-admin NÃO lê ai_model_pricing (sem sessão)", false, "no session to test");
  }

  // Cleanup usuário temporário
  const { error: delUserErr } = await supabase.auth.admin.deleteUser(tempUser?.user?.id);
  assert("I3: cleanup usuário temporário", !delUserErr, delUserErr?.message);

  // ── I4: resolveAiCost com seeds reais (via service — coberto por unit tests; aqui seeds no banco) ──
  console.log("\n🧪 I4: seeds reais em ai_model_pricing (resolveAiCost → pricing_table)");
  const { data: seeds } = await supabase
    .from("ai_model_pricing")
    .select("provider, model, input_token_usd_per_1m, output_token_usd_per_1m, image_unit_usd, effective_until")
    .is("effective_until", null)
    .in("model", ["gemini-3.1-flash-lite", "gpt-image-2"]);
  const geminiSeed = seeds?.find((s) => s.model === "gemini-3.1-flash-lite");
  const gptImageSeed = seeds?.find((s) => s.model === "gpt-image-2");
  assert(
    "I4: seed gemini-3.1-flash-lite vigente com input/output (0.1/0.4)",
    !!geminiSeed && geminiSeed.input_token_usd_per_1m === 0.1 && geminiSeed.output_token_usd_per_1m === 0.4,
    JSON.stringify(geminiSeed),
  );
  assert(
    "I4: seed gpt-image-2 vigente SÓ com image_unit (0.04), sem dimensões de token",
    !!gptImageSeed && gptImageSeed.image_unit_usd === 0.04 && gptImageSeed.input_token_usd_per_1m === null && gptImageSeed.output_token_usd_per_1m === null,
    JSON.stringify(gptImageSeed),
  );

  // ── I5: views sem duplicar delivery markers (1 run: 2 call-level + 1 delivery) ──
  console.log("\n🧪 I5: views/RPC somam SÓ call-level (anti-dupla-contagem D1/D6)");
  const RUN_ID = crypto.randomUUID();
  const { error: insCall1 } = await supabase.from("generation_events").insert({
    store_id: TEST_STORE_ID,
    operation_run_id: RUN_ID,
    operation_run_type: "campaign_delivery",
    generation_type: "campaign_copy",
    provider: "gemini",
    model: "gemini-3.1-flash-lite",
    status: "success",
    attempt_number: 1,
    duration_ms: 120,
    prompt_tokens: 1000,
    completion_tokens: 200,
    estimated_cost_usd: 0.00018,
    cost_source: "pricing_table",
    metadata: { verification: "38-1-10-I5" },
  });
  assert("I5: call-level campaign_copy inserido", !insCall1, insCall1?.message);
  const { error: insCall2 } = await supabase.from("generation_events").insert({
    store_id: TEST_STORE_ID,
    operation_run_id: RUN_ID,
    operation_run_type: "campaign_delivery",
    generation_type: "campaign_image",
    provider: "openai",
    model: "gpt-image-2",
    status: "success",
    attempt_number: 1,
    duration_ms: 3500,
    image_tokens: 100,
    estimated_cost_usd: 0.04,
    cost_source: "pricing_table",
    metadata: { verification: "38-1-10-I5" },
  });
  assert("I5: call-level campaign_image inserido", !insCall2, insCall2?.message);
  const { error: insDelivery } = await supabase.from("generation_events").insert({
    store_id: TEST_STORE_ID,
    operation_run_id: RUN_ID,
    operation_run_type: "campaign_delivery",
    generation_type: "campaign_pipeline",
    provider: null,
    model: null,
    status: "success",
    attempt_number: 1,
    duration_ms: 4000,
    estimated_cost_usd: null,
    cost_source: null,
    metadata: { verification: "38-1-10-I5", duration_is_pipeline: true },
  });
  assert("I5: delivery marker campaign_pipeline inserido (custo NULL)", !insDelivery, insDelivery?.message);

  const { data: rpcCosts, error: rpcCostsErr } = await supabase.rpc("admin_get_ai_costs", {
    p_operation_run_id: RUN_ID,
    p_hours: 24,
  });
  const byRun = rpcCosts?.by_operation_run?.[0];
  assert("I5: RPC admin_get_ai_costs responde para o run", !rpcCostsErr && !!byRun, rpcCostsErr?.message || JSON.stringify(rpcCosts));
  assert(
    "I5: n_chamadas = 2 (SÓ call-level — delivery marker excluído)",
    byRun?.chamadas === 2,
    `chamadas=${byRun?.chamadas} esperado=2`,
  );
  assert(
    "I5: custo = soma SÓ call-level (0.00018 + 0.04 = 0.04018), delivery NULL não soma",
    Math.abs(Number(byRun?.custo_usd_total) - 0.04018) < 0.00001,
    `custo=${byRun?.custo_usd_total} esperado=0.04018`,
  );
  assert(
    "I5: by_generation_type só com etapas call-level (sem campaign_pipeline)",
    !rpcCosts?.by_generation_type?.some((g) => g.generation_type === "campaign_pipeline"),
    JSON.stringify(rpcCosts?.by_generation_type),
  );

  // Cleanup: service_role NÃO tem DELETE em generation_events (append-only F28) —
  // neutraliza os eventos de teste para não poluir as views (operation_run_id → null)
  const { error: neutralErr } = await supabase
    .from("generation_events")
    .update({ operation_run_id: null, operation_run_type: null, estimated_cost_usd: null, provider_reported_cost_usd: null, cost_source: null })
    .eq("store_id", TEST_STORE_ID)
    .eq("metadata->>verification", "38-1-10-I5");
  assert("I5: neutralização dos eventos de teste (operation_run_id → null)", !neutralErr, neutralErr?.message);

  // ── I6: admin_get_metrics segue respondendo (sem regressão — F28) ──
  console.log("\n🧪 I6: admin_get_metrics segue respondendo (sem regressão)");
  const { data: metrics, error: metricsErr } = await supabase.rpc("admin_get_metrics", {
    p_store_kind: "production",
    p_hours: 24,
    p_metric_type: "all",
  });
  assert("I6: admin_get_metrics responde JSONB", !metricsErr && !!metrics, metricsErr?.message);
  assert(
    "I6: bundle com pipeline/vs/wallet (estrutura F28 preservada)",
    metrics && ("pipeline" in metrics || "vs" in metrics || "wallet" in metrics),
    `keys=${metrics ? Object.keys(metrics).join(",") : "null"}`,
  );

  console.log(`\n${"=".repeat(50)}`);
  console.log(`\nResults: ${results.pass} passed / ${results.fail} failed / ${results.tests.length} total\n`);
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
