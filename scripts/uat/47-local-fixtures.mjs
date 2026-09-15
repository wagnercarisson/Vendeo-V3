// F47 local UAT fixtures.
//
// Cria estado local reproduzivel para os cenarios que a matriz de seeds nao
// cobre: selecao vigente que vira deprecated, selecao apontando para tupla
// missing e modelo ativo sem pricing. Tudo com snapshot para restauracao.
//
// Uso:
//   node scripts/uat/47-local-fixtures.mjs
//   node scripts/uat/47-local-fixtures.mjs --cleanup
//
// NUNCA usar contra ambiente remoto: os endpoints sao validados e recusados.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STATE_FILE = path.join(os.tmpdir(), "vendeo-f47-uat-fixtures.json");

const DEPRECATED_CAPABILITY = "campaign_copy";
const MISSING_CAPABILITY = "campaign_image";
const COPY_PRIMARY = {
  capability: "campaign_copy",
  provider: "openai",
  model: "gpt-4o",
  protocol: "chat-completions",
};
const NO_PRICING = {
  capability: "campaign_copy",
  segment: "text",
  provider: "openai",
  model: "uat-no-pricing-copy",
  protocol: "chat-completions",
  label: "UAT no pricing",
  status: "active",
  source_note: "47-08 local fixture",
  validated_at: null,
};
const MISSING_SELECTION = {
  capability: MISSING_CAPABILITY,
  provider: "openai",
  model: "uat-missing-image-model",
  protocol: "responses",
  fallback_provider: null,
  fallback_model: null,
  fallback_protocol: null,
  reason: "47-08 local missing fixture",
};
const DEPRECATED_SELECTION = {
  capability: DEPRECATED_CAPABILITY,
  provider: COPY_PRIMARY.provider,
  model: COPY_PRIMARY.model,
  protocol: COPY_PRIMARY.protocol,
  fallback_provider: null,
  fallback_model: null,
  fallback_protocol: null,
  reason: "47-08 local deprecated fixture",
};

function readLocalEnvOnce() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase status -o env"]
      : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|SERVICE_ROLE_KEY|DB_URL)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  for (const key of ["API_URL", "SERVICE_ROLE_KEY", "DB_URL"]) {
    if (!values[key]) throw new Error(`supabase status -o env sem ${key}`);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(values.API_URL)) {
    throw new Error(`Recusando API remota: ${values.API_URL}`);
  }
  if (!/^postgresql:\/\/(?:[^@]+@)?(localhost|127\.0\.0\.1)(:\d+)?\//i.test(values.DB_URL)) {
    throw new Error(`Recusando DB remoto: ${values.DB_URL}`);
  }
  return values;
}

const env = readLocalEnvOnce();
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY);

function must(label, error) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function readSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function getSelection(capability) {
  const { data, error } = await admin
    .from("ai_model_selection")
    .select("*")
    .eq("capability", capability)
    .maybeSingle();
  must(`select selection ${capability}`, error);
  return data ?? null;
}

async function getCatalogRow(tuple) {
  const { data, error } = await admin
    .from("ai_model_catalog")
    .select("*")
    .eq("capability", tuple.capability)
    .eq("provider", tuple.provider)
    .eq("model", tuple.model)
    .eq("protocol", tuple.protocol)
    .maybeSingle();
  must(`select catalog ${tuple.model}`, error);
  return data ?? null;
}

async function captureSnapshot() {
  return {
    selectionCopy: await getSelection(DEPRECATED_CAPABILITY),
    selectionImage: await getSelection(MISSING_CAPABILITY),
    catalogCopy: await getCatalogRow(COPY_PRIMARY),
    catalogNoPricing: await getCatalogRow(NO_PRICING),
  };
}

async function upsertCatalog(row) {
  const { error } = await admin
    .from("ai_model_catalog")
    .upsert(row, { onConflict: "capability,provider,model,protocol" });
  must(`upsert catalog ${row.model}`, error);
}

async function upsertSelection(row) {
  const { error } = await admin.from("ai_model_selection").upsert(row, { onConflict: "capability" });
  must(`upsert selection ${row.capability}`, error);
}

async function setCatalogStatus(tuple, status) {
  const { error } = await admin
    .from("ai_model_catalog")
    .update({ status })
    .eq("capability", tuple.capability)
    .eq("provider", tuple.provider)
    .eq("model", tuple.model)
    .eq("protocol", tuple.protocol);
  must(`update catalog status ${tuple.model}`, error);
}

async function deleteSelection(capability) {
  const { error } = await admin.from("ai_model_selection").delete().eq("capability", capability);
  must(`delete selection ${capability}`, error);
}

async function deleteCatalog(tuple) {
  const { error } = await admin
    .from("ai_model_catalog")
    .delete()
    .eq("capability", tuple.capability)
    .eq("provider", tuple.provider)
    .eq("model", tuple.model)
    .eq("protocol", tuple.protocol);
  must(`delete catalog ${tuple.model}`, error);
}

async function restoreSelection(capability, snapshotRow) {
  await deleteSelection(capability);
  if (snapshotRow) await upsertSelection(snapshotRow);
}

async function restoreCatalog(snapshotRow, tuple) {
  if (snapshotRow) {
    await upsertCatalog(snapshotRow);
  } else {
    await deleteCatalog(tuple);
  }
}

async function setup() {
  if (readSnapshot()) {
    console.log("Snapshot ja existe; reaproveitando (setup idempotente).");
  } else {
    const snapshot = await captureSnapshot();
    fs.writeFileSync(STATE_FILE, JSON.stringify(snapshot, null, 2));
    console.log(`Snapshot salvo em ${STATE_FILE}`);
  }

  await upsertCatalog(NO_PRICING);
  await upsertSelection(DEPRECATED_SELECTION);
  await setCatalogStatus(COPY_PRIMARY, "deprecated");
  await upsertSelection(MISSING_SELECTION);

  console.log(
    "Fixtures locais instaladas: campaign_copy deprecated, campaign_image missing, campaign_copy sem pricing.",
  );
}

async function cleanup() {
  const snapshot = readSnapshot();
  if (!snapshot) {
    const residual = [
      await getSelection(DEPRECATED_CAPABILITY),
      await getSelection(MISSING_CAPABILITY),
      await getCatalogRow(NO_PRICING),
    ].filter(Boolean);
    if (residual.length > 0) {
      throw new Error(
        "Sem snapshot para restaurar e existem fixtures residuais. Rode `npx supabase db reset` (local) para limpar.",
      );
    }
    console.log("Nada para limpar (sem snapshot e sem fixtures residuais).");
    return;
  }

  await restoreSelection(DEPRECATED_CAPABILITY, snapshot.selectionCopy);
  await restoreSelection(MISSING_CAPABILITY, snapshot.selectionImage);
  await restoreCatalog(snapshot.catalogCopy, COPY_PRIMARY);
  await restoreCatalog(snapshot.catalogNoPricing, NO_PRICING);

  const leftover = [
    await getSelection(DEPRECATED_CAPABILITY),
    await getSelection(MISSING_CAPABILITY),
    await getCatalogRow(NO_PRICING),
  ].filter(Boolean);
  if (leftover.length > 0) {
    throw new Error("Cleanup deixou residuos de fixture; investigue antes de prosseguir.");
  }

  fs.rmSync(STATE_FILE, { force: true });
  console.log("Fixtures locais removidas e estado anterior restaurado sem residuos.");
}

if (process.argv[2] === "--cleanup") {
  cleanup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
} else {
  setup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
