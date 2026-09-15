// F47-01 — verificação da migration de catálogo/seleção no Supabase local.
// Este script recusa URLs remotas: a migration deve ser validada localmente
// antes de qualquer push. Cada cenário falha individualmente e o processo sai
// com status não zero quando o banco ou qualquer assert não estiver disponível.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { Client } from "pg";

function getLocalSupabaseEnv() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "npx supabase status -o env"]
    : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, args, {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const localEnv = getLocalSupabaseEnv();
const url = localEnv.API_URL;
const serviceRoleKey = localEnv.SERVICE_ROLE_KEY;
const anonKey = localEnv.ANON_KEY;
const dbUrl = localEnv.DB_URL;
if (!url || !serviceRoleKey || !anonKey || !dbUrl) {
  throw new Error("API_URL, ANON_KEY, SERVICE_ROLE_KEY ou DB_URL ausente em `npx supabase status -o env`");
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) {
  throw new Error(`Recusando verificar banco remoto: ${url}`);
}
if (!/^postgresql:\/\/(?:[^@]+@)?(localhost|127\.0\.0\.1)(:\d+)?\//i.test(dbUrl)) {
  throw new Error(`Recusando limpar banco remoto: ${dbUrl}`);
}

const admin = createClient(url, serviceRoleKey);
const anon = createClient(url, anonKey);
let temporaryActorId = null;
let temporaryStoreId = null;
let temporaryCampaignId = null;
let otherUserId = null;
const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};
const operationId = () => crypto.randomUUID();
const EXPECTED_CATALOG_TUPLES = [
  ["campaign_copy", "text", "openai", "gpt-4o", "chat-completions", "active"],
  ["campaign_copy", "text", "gemini", "gemini-3.1-flash-lite", "gemini", "active"],
  ["campaign_correction_analysis", "text", "openai", "gpt-4o", "chat-completions", "active"],
  ["brand_profile_text", "text", "openai", "gpt-4o", "chat-completions", "active"],
  ["campaign_spec", "text", "openai", "gpt-4o-mini", "chat-completions", "active"],
  ["campaign_input_validation", "vision", "openai", "gpt-4o", "chat-completions", "active"],
  ["campaign_image_review", "vision", "openai", "gpt-4o", "chat-completions", "active"],
  ["brand_profile_vision", "vision", "openai", "gpt-4o", "chat-completions", "active"],
  ["visual_signature_validation", "vision", "openai", "gpt-4o-mini", "responses", "active"],
  ["campaign_image", "image", "openai", "gpt-5.5", "responses", "active"],
  ["campaign_image_edit", "image", "openai", "gpt-image-2", "images", "active"],
  ["visual_signature_image", "image", "openai", "gpt-5.5", "responses", "active"],
];

async function expectRpcError(name, client, functionName, args, expected) {
  const { error } = await client.rpc(functionName, args);
  assert(name, !!error && error.message.includes(expected), error?.message ?? "erro esperado");
}

async function removeTemporaryActor(actorId) {
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    // O actor deixa auditorias F47; a cascata auth.users -> admin_audit_log é
    // bloqueada pelo trigger append-only. A suspensão é estritamente local e
    // limitada à limpeza do actor criado por este verificador.
    await db.query("ALTER TABLE public.admin_audit_log DISABLE TRIGGER trg_admin_audit_log_immutable");
    await db.query("DELETE FROM public.admin_audit_log WHERE actor_id = $1", [actorId]);
    await db.query("ALTER TABLE public.admin_audit_log ENABLE TRIGGER trg_admin_audit_log_immutable");
  } finally {
    await db.end();
  }
  const { error } = await admin.auth.admin.deleteUser(actorId);
  if (error) throw new Error(`remoção do actor falhou: ${error.message || JSON.stringify(error)}`);
}

async function cleanupCampaignsFixture() {
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    if (temporaryCampaignId) {
      await db.query("DELETE FROM public.campaigns WHERE id = $1", [temporaryCampaignId]);
      temporaryCampaignId = null;
    }
    if (temporaryStoreId) {
      await db.query("DELETE FROM public.stores WHERE id = $1", [temporaryStoreId]);
      temporaryStoreId = null;
    }
  } finally {
    await db.end();
  }
  if (otherUserId) {
    await admin.auth.admin.deleteUser(otherUserId);
    otherUserId = null;
  }
}

async function verifyCampaignsRls(actorId, actorEmail, actorPassword) {
  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({ user_id: actorId, name: "F47 RLS Verifier", segment: "outros" })
    .select("id")
    .single();
  assert("fixture store criada para verificação de campaigns", !storeError && !!store?.id, storeError?.message);
  if (storeError || !store?.id) return;
  temporaryStoreId = store.id;

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .insert({ store_id: temporaryStoreId, product_name: "Produto RLS", storage_path: `${temporaryStoreId}/verifier.jpg` })
    .select("id")
    .single();
  assert("fixture campaign criada", !campaignError && !!campaign?.id, campaignError?.message);
  if (campaignError || !campaign?.id) return;
  temporaryCampaignId = campaign.id;

  const ownerClient = createClient(url, anonKey);
  const { data: ownerSession, error: ownerSignInError } = await ownerClient.auth.signInWithPassword({
    email: actorEmail,
    password: actorPassword,
    options: { captchaToken: "XXXX.DUMMY.TOKEN" },
  });
  assert("owner faz sign-in local", !ownerSignInError && !!ownerSession?.session, ownerSignInError?.message);
  if (ownerSession?.session) {
    const authed = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${ownerSession.session.access_token}` } },
    });
    const { data, error } = await authed.from("campaigns").select("id").eq("id", temporaryCampaignId);
    assert(
      "proprietário lê a própria campanha (policy owner_select_campaigns)",
      !error && data?.length === 1,
      error?.message ?? JSON.stringify(data),
    );
  }

  const otherEmail = `f47-01-other-${crypto.randomUUID()}@local.invalid`;
  const otherPassword = `${crypto.randomUUID()}-Aa1!`;
  const { data: otherUser, error: otherCreateError } = await admin.auth.admin.createUser({
    email: otherEmail,
    password: otherPassword,
    email_confirm: true,
  });
  assert("segundo usuário temporário criado", !otherCreateError && !!otherUser?.user?.id, otherCreateError?.message);
  if (otherUser?.user?.id) {
    otherUserId = otherUser.user.id;
    const otherClient = createClient(url, anonKey);
    const { data: otherSession, error: otherSignInError } = await otherClient.auth.signInWithPassword({
      email: otherEmail,
      password: otherPassword,
      options: { captchaToken: "XXXX.DUMMY.TOKEN" },
    });
    assert("segundo usuário faz sign-in local", !otherSignInError && !!otherSession?.session, otherSignInError?.message);
    if (otherSession?.session) {
      const authed = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${otherSession.session.access_token}` } },
      });
      const { data, error } = await authed.from("campaigns").select("id").eq("id", temporaryCampaignId);
      assert(
        "outro usuário NÃO lê a campanha (RLS nega)",
        !error && data?.length === 0,
        error?.message ?? JSON.stringify(data),
      );
    }
  }

  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    const grants = await db.query(
      "SELECT has_table_privilege('authenticated','public.campaigns','SELECT') AS auth_select, has_table_privilege('service_role','public.campaigns','SELECT') AS svc_select, has_table_privilege('service_role','public.campaigns','INSERT') AS svc_insert, has_table_privilege('service_role','public.campaigns','UPDATE') AS svc_update",
    );
    const g = grants.rows[0];
    assert("authenticated possui SELECT em public.campaigns (forward fix)", g.auth_select === true, JSON.stringify(g));
    assert("service_role mantém SELECT/INSERT/UPDATE em campaigns", g.svc_select && g.svc_insert && g.svc_update, JSON.stringify(g));
    const rls = await db.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'campaigns'");
    assert("RLS continua habilitado em public.campaigns", rls.rows[0]?.relrowsecurity === true, JSON.stringify(rls.rows[0]));
    const policy = await db.query(
      "SELECT COUNT(*)::int AS n FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'owner_select_campaigns'",
    );
    assert("policy owner_select_campaigns continua existente", policy.rows[0]?.n === 1, JSON.stringify(policy.rows[0]));
  } finally {
    await db.end();
  }
}

async function run() {
  console.log("\nF47-01 migration verification (Supabase local)\n");
  const temporaryEmail = `f47-01-${crypto.randomUUID()}@local.invalid`;
  const temporaryPassword = `${crypto.randomUUID()}-Aa1!`;
  const { data: temporaryUser, error: createUserError } = await admin.auth.admin.createUser({
    email: temporaryEmail,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (createUserError || !temporaryUser.user) {
    throw new Error(`Não foi possível criar actor local temporário: ${createUserError?.message ?? "usuário ausente"}`);
  }
  const actorId = temporaryUser.user.id;
  temporaryActorId = actorId;

  const { data: aiCosts, error: aiCostsError } = await admin.rpc("admin_get_ai_costs", {
    p_hours: 1,
    p_credit_unit_usd_value: null,
  });
  assert(
    "RPC admin_get_ai_costs real responde após forward fix",
    !aiCostsError && Array.isArray(aiCosts?.by_operation_run),
    aiCostsError?.message ?? JSON.stringify(aiCosts),
  );

  const { data: catalog, error: catalogError } = await admin
    .from("ai_model_catalog")
    .select("capability, provider, model, protocol, segment, status");
  assert("schema/catalogo acessível pelo service_role", !catalogError && !!catalog, catalogError?.message);
  assert("matriz inicial contém exatamente 12 seeds", !catalogError && catalog?.length === 12, `count=${catalog?.length}`);
  const actualCatalogTuples = (catalog ?? [])
    .map((row) => [row.capability, row.segment, row.provider, row.model, row.protocol, row.status].join("|"))
    .sort();
  const expectedCatalogTuples = EXPECTED_CATALOG_TUPLES.map((tuple) => tuple.join("|")).sort();
  assert(
    "catálogo local corresponde exatamente à matriz F47 esperada",
    !catalogError && JSON.stringify(actualCatalogTuples) === JSON.stringify(expectedCatalogTuples),
    `actual=${JSON.stringify(actualCatalogTuples)} expected=${JSON.stringify(expectedCatalogTuples)}`,
  );
  assert(
    "matriz não contém provider google",
    !catalogError && !(catalog ?? []).some((row) => row.provider === "google"),
    "provider google encontrado",
  );
  assert(
    "fallback Gemini de campaign_copy está presente",
    !!catalog?.some((row) => row.capability === "campaign_copy" && row.provider === "gemini" && row.model === "gemini-3.1-flash-lite" && row.protocol === "gemini"),
    "seed fallback ausente",
  );
  assert(
    "catálogo não tem duplicidades na tupla única",
    new Set((catalog ?? []).map((row) => [row.capability, row.provider, row.model, row.protocol].join("|"))).size === (catalog?.length ?? 0),
    "duplicidade encontrada",
  );

  const { error: anonCatalogError } = await anon.from("ai_model_catalog").select("id").limit(1);
  assert("RLS/revoke bloqueia leitura anon do catálogo", !!anonCatalogError, anonCatalogError?.message ?? "leitura inesperadamente permitida");
  const { error: anonSelectionError } = await anon.from("ai_model_selection").select("id").limit(1);
  assert("RLS/revoke bloqueia leitura anon da seleção", !!anonSelectionError, anonSelectionError?.message ?? "leitura inesperadamente permitida");
  await expectRpcError(
    "RPC set não é executável por anon",
    anon,
    "admin_set_ai_model_selection",
    { p_capability: "campaign_copy", p_provider: "openai", p_model: "gpt-4o", p_protocol: "chat-completions", p_fallback_provider: null, p_fallback_model: null, p_fallback_protocol: null, p_reason: "test", p_actor_id: actorId, p_operation_id: operationId() },
    "function",
  );

  const baseArgs = {
    p_capability: "campaign_copy",
    p_provider: "openai",
    p_model: "gpt-4o",
    p_protocol: "chat-completions",
    p_fallback_provider: null,
    p_fallback_model: null,
    p_fallback_protocol: null,
    p_reason: "47-01 verification",
    p_actor_id: actorId,
  };
  await expectRpcError("motivo ausente rejeitado", admin, "admin_set_ai_model_selection", { ...baseArgs, p_reason: "", p_operation_id: operationId() }, "missing_reason");
  await expectRpcError("modelo fora do catálogo rejeitado", admin, "admin_set_ai_model_selection", { ...baseArgs, p_model: "not-cataloged", p_operation_id: operationId() }, "model_not_in_catalog");
  await expectRpcError("fallback incompleto rejeitado", admin, "admin_set_ai_model_selection", { ...baseArgs, p_fallback_provider: "gemini", p_operation_id: operationId() }, "incomplete_fallback");
  await expectRpcError("fallback fora de campaign_copy rejeitado", admin, "admin_set_ai_model_selection", { ...baseArgs, p_capability: "campaign_image", p_model: "gpt-5.5", p_protocol: "responses", p_fallback_provider: "openai", p_fallback_model: "gpt-image-2", p_fallback_protocol: "images", p_operation_id: operationId() }, "fallback_not_supported");
  await expectRpcError("primary igual ao fallback rejeitado", admin, "admin_set_ai_model_selection", { ...baseArgs, p_fallback_provider: "openai", p_fallback_model: "gpt-4o", p_fallback_protocol: "chat-completions", p_operation_id: operationId() }, "primary_equals_fallback");

  const deprecatedTuple = catalog?.find((row) => row.capability === "campaign_copy" && row.provider === "openai");
  if (deprecatedTuple) {
    const { error: markError } = await admin.from("ai_model_catalog").update({ status: "deprecated" }).match({ capability: deprecatedTuple.capability, provider: deprecatedTuple.provider, model: deprecatedTuple.model, protocol: deprecatedTuple.protocol });
    assert("fixture deprecated criado", !markError, markError?.message);
    await expectRpcError("nova seleção deprecated rejeitada", admin, "admin_set_ai_model_selection", { ...baseArgs, p_operation_id: operationId() }, "model_not_in_catalog");
    await admin.from("ai_model_catalog").update({ status: "active" }).match({ capability: deprecatedTuple.capability, provider: deprecatedTuple.provider, model: deprecatedTuple.model, protocol: deprecatedTuple.protocol });
  }

  const updateOperation = operationId();
  const first = await admin.rpc("admin_set_ai_model_selection", { ...baseArgs, p_operation_id: updateOperation });
  assert("RPC set válido grava seleção", !first.error && first.data?.success === true, first.error?.message ?? JSON.stringify(first.data));
  const second = await admin.rpc("admin_set_ai_model_selection", { ...baseArgs, p_operation_id: updateOperation });
  assert("RPC set repetido é idempotente", !second.error && second.data?.idempotent === true, second.error?.message ?? JSON.stringify(second.data));

  const resetOperation = operationId();
  const reset = await admin.rpc("admin_reset_ai_model_selection", { p_capability: "campaign_copy", p_reason: "47-01 cleanup", p_actor_id: actorId, p_operation_id: resetOperation });
  assert("RPC reset remove seleção e audita", !reset.error && reset.data?.reset === true, reset.error?.message ?? JSON.stringify(reset.data));
  const resetAgain = await admin.rpc("admin_reset_ai_model_selection", { p_capability: "campaign_copy", p_reason: "47-01 cleanup", p_actor_id: actorId, p_operation_id: resetOperation });
  assert("RPC reset repetido é idempotente", !resetAgain.error && resetAgain.data?.idempotent === true, resetAgain.error?.message ?? JSON.stringify(resetAgain.data));
  const noOp = await admin.rpc("admin_reset_ai_model_selection", { p_capability: "campaign_image", p_reason: "47-01 no-op", p_actor_id: actorId, p_operation_id: operationId() });
  assert("RPC reset sem seleção é no-op", !noOp.error && noOp.data?.reset === false, noOp.error?.message ?? JSON.stringify(noOp.data));

  const { data: audits, error: auditError } = await admin
    .from("admin_audit_log")
    .select("action, target_type, operation_id")
    .in("operation_id", [updateOperation, resetOperation]);
  assert("set/reset geram auditoria atômica", !auditError && audits?.length === 2 && audits.every((row) => row.target_type === "ai_model_selection"), auditError?.message ?? JSON.stringify(audits));

  await verifyCampaignsRls(actorId, temporaryEmail, temporaryPassword);

  const failed = results.filter((result) => !result.ok);
  console.log(`\nResults: ${results.length - failed.length} passed / ${failed.length} failed / ${results.length} total`);
  if (failed.length > 0) process.exitCode = 1;

  try {
    await cleanupCampaignsFixture();
    await removeTemporaryActor(actorId);
    console.log("Fixtures de campaigns e actor local temporário removidos");
  } catch (deleteUserError) {
    console.error(`Falha ao remover fixtures/actor temporário ${actorId}: ${deleteUserError.message}`);
    process.exitCode = 1;
  }
  temporaryActorId = null;
}

run().catch(async (error) => {
  if (temporaryActorId) {
    try {
      await cleanupCampaignsFixture();
      await removeTemporaryActor(temporaryActorId);
      console.error(`Fixtures/actor local temporário removidos após falha: ${temporaryActorId}`);
    } catch (cleanupError) {
      console.error(`Falha na limpeza das fixtures/actor temporário: ${cleanupError.message}`);
    }
    temporaryActorId = null;
  }
  console.error(`\nBLOCKED/FAILED: ${error.message}`);
  process.exitCode = 1;
});
