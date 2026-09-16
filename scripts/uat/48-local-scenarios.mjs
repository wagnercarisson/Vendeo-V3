// F48.1 — bootstrap LOCAL e idempotente dos cenários controlados do laboratório.
//
// Materializa `public.lab_scenarios` + `public.lab_scenario_versions` a partir de
// `fixtures/lab/scenarios/<slug>/scenario.json`, usando o MESMO hash canônico do
// serviço (`src/lib/lab/scenarios/service.ts`): SHA-256 do JSON com ordenação
// recursiva de chaves. O script reimplementa a lógica mínima em JS puro porque
// não pode importar TypeScript.
//
// Semântica (idempotente e imutável):
//   - hash já existente para o cenário  ⇒ NADA é gravado (skipped);
//   - hash novo                        ⇒ grava `version = max + 1` (created);
//   - nenhuma versão existente é sobrescrita (imutabilidade).
//
// Uso:
//   node scripts/uat/48-local-scenarios.mjs
//
// LOCAL-ONLY: o host do Supabase é validado e hosts remotos/produção são
// recusados ANTES de qualquer leitura/escrita. Não usa `db reset` e não toca
// nenhuma outra tabela.
//
// A conexão vem de `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
// quando presentes; caso contrário, do `npx supabase status -o env` do stack
// local (mesmo padrão de `scripts/uat/47-local-bootstrap.mjs`). A chave anônima
// não é suficiente: as tabelas `lab_*` só têm grants para `service_role`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures/lab/scenarios");
const FIXTURE_PATH_PREFIX = "fixtures/lab/scenarios";
const FIXTURE_NOTES = "fixture local do laboratorio (F48.1)";

/** Hosts aceitos (Supabase CLI/Docker local). Qualquer outro é recusado. */
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;

/** Domínios de produção — bloqueio incondicional, mesmo se listados como locais. */
const PRODUCTION_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"];

function assertLocalHost(rawUrl, origin) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  } catch {
    throw new Error(`Recusando URL invalida (${origin}): ${rawUrl}`);
  }
  if (PRODUCTION_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new Error(`Recusando host de producao (${origin}): ${hostname}`);
  }
  if (!LOCAL_HOST_PATTERN.test(hostname)) {
    throw new Error(`Recusando host nao local (${origin}): ${hostname}`);
  }
  return hostname;
}

function readSupabaseStatusEnv() {
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
    const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function resolveLocalConnection() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (envUrl && envServiceRoleKey) {
    const hostname = assertLocalHost(envUrl, "NEXT_PUBLIC_SUPABASE_URL");
    return { url: envUrl, serviceRoleKey: envServiceRoleKey, hostname };
  }

  const status = readSupabaseStatusEnv();
  if (!status.API_URL || !status.SERVICE_ROLE_KEY) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ou rode com o stack Supabase local ativo (npx supabase status -o env).",
    );
  }
  const hostname = assertLocalHost(status.API_URL, "supabase status -o env");
  return { url: status.API_URL, serviceRoleKey: status.SERVICE_ROLE_KEY, hostname };
}

// ─── Hash canônico (espelho mínimo de src/lib/lab/scenarios/service.ts) ──────

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map((entry) => sortJsonValue(entry));
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortJsonValue(value[key]);
    return sorted;
  }
  return value;
}

function computeContentHash(content) {
  return createHash("sha256").update(JSON.stringify(sortJsonValue(content)), "utf8").digest("hex");
}

function listFixtureSlugs() {
  return fs
    .readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// ─── Materialização ─────────────────────────────────────────────────────────

async function materialize(supabase) {
  let created = 0;
  let skipped = 0;

  for (const slug of listFixtureSlugs()) {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, slug, "scenario.json"), "utf8");
    const content = JSON.parse(raw);
    const contentHash = computeContentHash(content);

    const existing = await supabase
      .from("lab_scenarios")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing.error) throw new Error(`select lab_scenarios falhou: ${existing.error.message}`);

    let scenarioId = existing.data?.id ?? null;
    if (!scenarioId) {
      const inserted = await supabase
        .from("lab_scenarios")
        .insert({
          slug,
          name: content.name,
          description: content.description ?? null,
          status: "active",
          current_version: 1,
        })
        .select("id")
        .single();
      if (inserted.error) throw new Error(`insert lab_scenarios falhou: ${inserted.error.message}`);
      scenarioId = inserted.data.id;
    }

    const versions = await supabase
      .from("lab_scenario_versions")
      .select("version, content_hash")
      .eq("scenario_id", scenarioId)
      .order("version", { ascending: true });
    if (versions.error) {
      throw new Error(`select lab_scenario_versions falhou: ${versions.error.message}`);
    }

    const rows = versions.data ?? [];
    if (rows.some((row) => row.content_hash === contentHash)) {
      skipped += 1;
      continue;
    }

    const nextVersion = rows.reduce((max, row) => Math.max(max, row.version), 0) + 1;
    const insertVersion = await supabase.from("lab_scenario_versions").insert({
      scenario_id: scenarioId,
      version: nextVersion,
      content,
      content_hash: contentHash,
      fixture_path: `${FIXTURE_PATH_PREFIX}/${slug}`,
      notes: FIXTURE_NOTES,
    });
    if (insertVersion.error) {
      throw new Error(`insert lab_scenario_versions falhou: ${insertVersion.error.message}`);
    }

    const updateScenario = await supabase
      .from("lab_scenarios")
      .update({ current_version: nextVersion, updated_at: new Date().toISOString() })
      .eq("id", scenarioId);
    if (updateScenario.error) {
      throw new Error(`update lab_scenarios falhou: ${updateScenario.error.message}`);
    }

    created += 1;
  }

  return { created, skipped };
}

const connection = resolveLocalConnection();
const supabase = createClient(connection.url, connection.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const result = await materialize(supabase);
console.log(
  JSON.stringify(
    {
      host: connection.hostname,
      fixtures: listFixtureSlugs().length,
      created: result.created,
      skipped: result.skipped,
      note: "local-only; reexecutar deve reportar created=0",
    },
    null,
    2,
  ),
);
