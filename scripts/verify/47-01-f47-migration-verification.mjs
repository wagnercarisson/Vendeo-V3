// F47-01 — verificação da migration de catálogo/seleção no Supabase local.
// Este script recusa URLs remotas: a migration deve ser validada localmente
// antes de qualquer push. Cada cenário falha individualmente e o processo sai
// com status não zero quando o banco ou qualquer assert não estiver disponível.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const envContent = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? null;
};

const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!url || !serviceRoleKey || !anonKey) {
  throw new Error("Credenciais locais ausentes em .env.local");
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) {
  throw new Error(`Recusando verificar banco remoto: ${url}`);
}

const admin = createClient(url, serviceRoleKey);
const anon = createClient(url, anonKey);
const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};
const operationId = () => crypto.randomUUID();

async function expectRpcError(name, client, functionName, args, expected) {
  const { error } = await client.rpc(functionName, args);
  assert(name, !!error && error.message.includes(expected), error?.message ?? "erro esperado");
}

async function run() {
  console.log("\nF47-01 migration verification (Supabase local)\n");
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1 });
  if (usersError || !users?.users?.length) {
    throw new Error(`Nenhum usuário local disponível como actor: ${usersError?.message ?? "sem usuários"}`);
  }
  const actorId = users.users[0].id;

  const { data: catalog, error: catalogError } = await admin
    .from("ai_model_catalog")
    .select("capability, provider, model, protocol, segment, status");
  assert("schema/catalogo acessível pelo service_role", !catalogError && !!catalog, catalogError?.message);
  assert("matriz inicial contém exatamente 12 seeds", !catalogError && catalog?.length === 12, `count=${catalog?.length}`);
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
  await expectRpcError("fallback fora de campaign_copy rejeitado", admin, "admin_set_ai_model_selection", { ...baseArgs, p_capability: "campaign_image", p_fallback_provider: "openai", p_fallback_model: "gpt-image-2", p_fallback_protocol: "images", p_operation_id: operationId() }, "fallback_not_supported");
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

  const failed = results.filter((result) => !result.ok);
  console.log(`\nResults: ${results.length - failed.length} passed / ${failed.length} failed / ${results.length} total`);
  if (failed.length > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(`\nBLOCKED/FAILED: ${error.message}`);
  process.exitCode = 1;
});
