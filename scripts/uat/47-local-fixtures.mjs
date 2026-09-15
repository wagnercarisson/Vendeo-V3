import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function env() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npx supabase status -o env"] : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const values = {};
  for (const line of output.split(/\r?\n/)) { const match = line.match(/^(API_URL|SERVICE_ROLE_KEY)="([^"]+)"$/); if (match) values[match[1]] = match[2]; }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(values.API_URL ?? "")) throw new Error(`Refusing non-local API_URL: ${values.API_URL}`);
  return values;
}

const admin = createClient(env().API_URL, env().SERVICE_ROLE_KEY);
const deprecatedCapability = "campaign_copy";
const missingCapability = "campaign_image";
const noPricing = { capability: "campaign_copy", segment: "text", provider: "openai", model: "uat-no-pricing-copy", protocol: "chat-completions", label: "UAT no pricing", status: "active", source_note: "47-08 local fixture", validated_at: null };

async function setup() {
  const { error: catalogError } = await admin.from("ai_model_catalog").upsert(noPricing, { onConflict: "capability,provider,model,protocol" });
  if (catalogError) throw new Error(catalogError.message);
  const { error: deprecatedError } = await admin.from("ai_model_selection").upsert({ capability: deprecatedCapability, provider: "openai", model: "gpt-4o", protocol: "chat-completions", fallback_provider: null, fallback_model: null, fallback_protocol: null, reason: "47-08 local deprecated fixture" }, { onConflict: "capability" });
  if (deprecatedError) throw new Error(deprecatedError.message);
  await admin.from("ai_model_catalog").update({ status: "deprecated" }).match({ capability: deprecatedCapability, provider: "openai", model: "gpt-4o", protocol: "chat-completions" });
  const { error: missingError } = await admin.from("ai_model_selection").upsert({ capability: missingCapability, provider: "openai", model: "uat-missing-image-model", protocol: "responses", fallback_provider: null, fallback_model: null, fallback_protocol: null, reason: "47-08 local missing fixture" }, { onConflict: "capability" });
  if (missingError) throw new Error(missingError.message);
  console.log("Installed local fixtures: deprecated campaign_copy, missing campaign_image, active campaign_copy without pricing.");
}

async function cleanup() {
  await admin.from("ai_model_selection").delete().in("capability", [deprecatedCapability, missingCapability]);
  await admin.from("ai_model_catalog").delete().match({ capability: noPricing.capability, provider: noPricing.provider, model: noPricing.model, protocol: noPricing.protocol });
  await admin.from("ai_model_catalog").update({ status: "active" }).match({ capability: deprecatedCapability, provider: "openai", model: "gpt-4o", protocol: "chat-completions" });
  console.log("Removed local F47 UAT fixtures.");
}

(process.argv[2] === "--cleanup" ? cleanup : setup)().catch((error) => { console.error(error.message); process.exit(1); });
