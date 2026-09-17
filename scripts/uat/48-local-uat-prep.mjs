// F48.1 — preparação LOCAL validada do UAT do Laboratório de IA (plan 48-1-14, task 1).
//
// Responsabilidades (somente leitura + bootstrap idempotente dos cenários):
//   1. Espelhar a guarda de ambiente (`src/lib/lab/environment-guard.ts`): exigir
//      `VENDEO_LAB_ENABLED === "true"` (string estrita), host do Supabase local
//      (`localhost`/`127.0.0.1`/`::1`/`0.0.0.0`) ou allowlist explícita, e
//      bloquear INCONDICIONALMENTE `*.supabase.co`/`.in`/`.com`.
//   2. Recusar antes de QUALQUER escrita: em recusa, imprime o `reason`
//      equivalente (`disabled_flag`/`missing_url`/`non_local_supabase`/
//      `remote_blocked`) e sai com `process.exit(1)`.
//   3. Verificar o bucket privado `lab-artifacts` (existe, `public === false`,
//      policy somente `service_role`, nenhuma policy para `authenticated`/`anon`).
//   4. Verificar as 8 tabelas `lab_*` (migration local aplicada).
//   5. Invocar o bootstrap idempotente dos cenários (`48-local-scenarios.mjs`) e
//      conferir os 3 cenários obrigatórios com `content_hash`.
//   6. Imprimir o plano de orçamento (cenários × variantes × repetições, teto de
//      runs, mínimo de gerações pagas e estimativa por run/cobertura).
//   7. Capturar o snapshot objetivo PRÉ-UAT (contagens produtivas locais, saldo
//      por loja, objetos de `campaign-images` e hashes SHA-256 de `prompts/*.md`).
//
// Uso:
//   node scripts/uat/48-local-uat-prep.mjs
//
// NENHUMA chamada paga: o script apenas lê, valida, materializa cenários locais
// (tabelas `lab_*` próprias) e reporta. Nunca imprime chave/token/URL com
// credencial — apenas hostnames, contagens e hashes.
//
// A flag e a URL da guarda vêm de `process.env` (precedência do runtime Next.js)
// com fallback para `.env.local`, que é o arquivo que o dev server carrega.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.local");
const PROMPTS_DIR = path.join(ROOT, "prompts");
const SCENARIOS_SCRIPT = fileURLToPath(new URL("./48-local-scenarios.mjs", import.meta.url));

/** Bucket privado e dedicado do laboratório (D10). */
const LAB_ARTIFACT_BUCKET = "lab-artifacts";
/** Bucket produtivo que NUNCA pode ser tocado pela UAT (D3/T-48-1-106). */
const CAMPAIGN_IMAGES_BUCKET = "campaign-images";

/** Hosts aceitos (Supabase CLI/Docker local). Qualquer outro é recusado. */
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;

/** Domínios de produção — bloqueio incondicional, mesmo se listados como locais. */
const PRODUCTION_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"];

/** Tabelas do laboratório esperadas após a migration local (48-1-01). */
const EXPECTED_LAB_TABLES = [
  "lab_artifacts",
  "lab_experiment_scenarios",
  "lab_experiment_variants",
  "lab_experiments",
  "lab_human_evaluations",
  "lab_runs",
  "lab_scenario_versions",
  "lab_scenarios",
];

/** Cenários obrigatórios do corpus controlado (48-1-03). */
const REQUIRED_SCENARIOS = [
  "produto-oferta-preco",
  "produto-oferta-texto-obrigatorio",
  "produto-oferta-logo",
];

/** Prompt sob teste (intent `offer`) — baseline × candidata. */
const PROMPT_UNDER_TEST = "campaign-image-director-offer";

/** Tabelas produtivas cujo delta deve ser zero antes/depois da UAT (D3). */
const PRODUCTIVE_TABLES = [
  "campaigns",
  "campaign_art_versions",
  "generation_events",
  "ai_model_selection",
  "ai_model_catalog",
  "credit_transactions",
];

/** Limites LOCKED (espelho de `src/lib/lab/limits.ts` — sem importar TS). */
const LIMITS = {
  MAX_SCENARIOS_PER_EXPERIMENT: 3,
  MAX_REPETITIONS: 3,
  MAX_RUNS_PER_EXPERIMENT: 12,
  DEFAULT_MAX_RUNS_PER_EXPERIMENT: 6,
  MAX_CONCURRENT_LAB_RUNS: 1,
};

/** Plano do experimento inicial obrigatório (task 14.2). */
const INITIAL_EXPERIMENT_PLAN = {
  scenarioSlugs: ["produto-oferta-preco"],
  variants: 2,
  repetitions: 1,
  runsPerVariant: 1,
};

/** Bootstrap de código do pricing da tool (espelho de DEFAULT_AI_MODEL_PRICING). */
const RESPONSES_IMAGE_GENERATION_BOOTSTRAP_USD = 0.065;
/** Modelo da linha versionável da tool image_generation no pricing catalog. */
const IMAGE_GENERATION_TOOL_MODELS = { openai: "responses:image_generation" };
const RESPONSES_IMAGE_GENERATION_FORMULA_VERSION = "responses_image_generation_v2";
const NOTE_PROVISIONAL_IMAGE_TOOL_WITHOUT_TEXT =
  "provisional_image_tool_unit_cost_without_text_usage";

// ─── Utilidades ─────────────────────────────────────────────────────────────

function readDotEnv(file) {
  const map = {};
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    map[match[1]] = value;
  }
  return map;
}

/** `process.env` (precedência do runtime) sobre `.env.local`. */
function readGuardEnv() {
  const dotenv = readDotEnv(ENV_FILE);
  const pick = (key) => (process.env[key] !== undefined ? process.env[key] : dotenv[key]);
  return {
    flag: pick("VENDEO_LAB_ENABLED"),
    url: pick("NEXT_PUBLIC_SUPABASE_URL"),
    allowedHosts: pick("VENDEO_LAB_ALLOWED_SUPABASE_HOSTS"),
    source: process.env.VENDEO_LAB_ENABLED !== undefined ? "process.env" : ".env.local",
  };
}

function normalizeHostname(hostname) {
  let normalized = String(hostname ?? "").trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replace(/\.+$/, "");
}

function isProductionSupabaseHost(host) {
  return PRODUCTION_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Espelho de `getLabEnvironment()` — ordem e `reason` idênticos.
 * NÃO lança: devolve o estado para o caller decidir (recusa antes de escrever).
 */
function evaluateGuard(env) {
  if (env.flag !== "true") {
    return { enabled: false, supabaseHost: null, local: false, reason: "disabled_flag" };
  }

  if (!env.url) {
    return { enabled: false, supabaseHost: null, local: false, reason: "missing_url" };
  }

  let host;
  try {
    host = normalizeHostname(new URL(env.url).hostname);
  } catch {
    return { enabled: false, supabaseHost: null, local: false, reason: "missing_url" };
  }
  if (!host) {
    return { enabled: false, supabaseHost: null, local: false, reason: "missing_url" };
  }

  // Bloqueio incondicional de produção — ANTES da allowlist.
  if (isProductionSupabaseHost(host)) {
    return { enabled: false, supabaseHost: host, local: false, reason: "remote_blocked" };
  }

  const allowed = String(env.allowedHosts ?? "")
    .split(",")
    .map((entry) => normalizeHostname(entry))
    .filter((entry) => entry.length > 0)
    .includes(host);

  if (LOCAL_HOST_PATTERN.test(host) || allowed) {
    return { enabled: true, supabaseHost: host, local: true, reason: "ok" };
  }

  return { enabled: false, supabaseHost: host, local: false, reason: "non_local_supabase" };
}

function refusedMessage(reason, host) {
  switch (reason) {
    case "disabled_flag":
      return "Laboratório desabilitado: VENDEO_LAB_ENABLED não é 'true'";
    case "missing_url":
      return "Laboratório desabilitado: NEXT_PUBLIC_SUPABASE_URL ausente ou inválida";
    case "non_local_supabase":
      return `Laboratório desabilitado: host '${host ?? "desconhecido"}' não é local nem permitido`;
    case "remote_blocked":
      return `Laboratório bloqueado: host de produção '${host ?? "desconhecido"}'`;
    default:
      return "Laboratório habilitado";
  }
}

/** Recusa ANTES de qualquer escrita — nunca toca banco/storage/provider. */
function refuse(reason, host, extra = {}) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason,
        message: refusedMessage(reason, host),
        host: host ?? null,
        writes: 0,
        paidCalls: 0,
        note: "Recusado antes de qualquer escrita (nenhuma leitura/escrita em banco, storage ou provider).",
        ...extra,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

function assertLocalUrl(rawUrl, origin) {
  let hostname;
  try {
    hostname = normalizeHostname(new URL(rawUrl).hostname);
  } catch {
    throw new Error(`Recusando URL invalida (${origin})`);
  }
  if (isProductionSupabaseHost(hostname)) {
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
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  for (const key of ["API_URL", "SERVICE_ROLE_KEY", "DB_URL"]) {
    if (!values[key]) throw new Error(`supabase status -o env sem ${key}`);
  }
  return values;
}

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function promptHashes() {
  const files = fs
    .readdirSync(PROMPTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort();
  const hashes = {};
  for (const name of files) hashes[name] = sha256File(path.join(PROMPTS_DIR, name));
  return hashes;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── 1. Guarda (recusa antes de qualquer escrita) ────────────────────────────

const guardEnv = readGuardEnv();
const guard = evaluateGuard(guardEnv);
if (!guard.enabled) {
  refuse(guard.reason, guard.supabaseHost, { guardEnvSource: guardEnv.source });
}

// ─── 2. Credenciais locais (defesa em profundidade) ──────────────────────────

let status;
try {
  status = readSupabaseStatusEnv();
  assertLocalUrl(status.API_URL, "supabase status API_URL");
  assertLocalUrl(status.DB_URL.replace(/^postgresql:\/\/(?:[^@]+@)?/i, "http://"), "supabase status DB_URL");
} catch (error) {
  refuse("non_local_supabase", guard.supabaseHost, {
    detail: error instanceof Error ? error.message : String(error),
  });
}

// ─── 3. Bootstrap idempotente dos cenários (escreve SOMENTE em lab_*) ────────

let scenarioBootstrap = null;
try {
  const stdout = execFileSync(process.execPath, [SCENARIOS_SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  scenarioBootstrap = JSON.parse(stdout);
} catch (error) {
  const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: "scenarios_bootstrap_failed",
        message: "Falha ao materializar os cenários locais (48-local-scenarios.mjs).",
        detail: error instanceof Error ? error.message : String(error),
        stderr: stderr.trim().slice(0, 500),
        paidCalls: 0,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

// ─── 4. Verificações de banco (somente leitura) ──────────────────────────────

const db = new Client({ connectionString: status.DB_URL });
await db.connect();

let report;
try {
  const tablesResult = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'lab\\_%' ORDER BY tablename",
  );
  const labTables = tablesResult.rows.map((row) => row.tablename);
  const missingLabTables = EXPECTED_LAB_TABLES.filter((table) => !labTables.includes(table));

  const bucketResult = await db.query(
    "SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = $1",
    [LAB_ARTIFACT_BUCKET],
  );
  const bucketRow = bucketResult.rows[0] ?? null;

  const policyResult = await db.query(
    "SELECT policyname, roles::text AS roles, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND (qual ILIKE $1 OR with_check ILIKE $1) ORDER BY policyname",
    [`%${LAB_ARTIFACT_BUCKET}%`],
  );
  const policies = policyResult.rows.map((row) => ({
    name: row.policyname,
    roles: row.roles,
    cmd: row.cmd,
  }));
  const foreignPolicies = policies.filter(
    (policy) => !/service_role/.test(policy.roles) || /anon|authenticated/.test(policy.roles),
  );

  const scenariosResult = await db.query(
    `SELECT s.slug, s.current_version, v.version, v.content_hash
       FROM public.lab_scenarios s
       JOIN public.lab_scenario_versions v ON v.scenario_id = s.id
      WHERE s.slug = ANY($1::text[])
      ORDER BY s.slug, v.version`,
    [REQUIRED_SCENARIOS],
  );
  const scenarios = REQUIRED_SCENARIOS.map((slug) => {
    const rows = scenariosResult.rows.filter((row) => row.slug === slug);
    const current = rows.find((row) => row.version === row.current_version) ?? rows.at(-1) ?? null;
    return {
      slug,
      present: Boolean(current),
      currentVersion: current ? Number(current.current_version) : null,
      contentHash: current?.content_hash ?? null,
    };
  });
  const missingScenarios = scenarios.filter((scenario) => !scenario.present || !scenario.contentHash);

  const counts = {};
  for (const table of PRODUCTIVE_TABLES) {
    const result = await db.query(`SELECT COUNT(*)::int AS n FROM public.${table}`);
    counts[table] = Number(result.rows[0].n);
  }

  const balancesResult = await db.query(
    "SELECT store_id::text AS store_id, balance FROM public.credit_balances ORDER BY store_id",
  );
  const creditBalances = balancesResult.rows.map((row) => ({
    storeId: row.store_id,
    balance: Number(row.balance),
  }));

  const objectsResult = await db.query(
    "SELECT name FROM storage.objects WHERE bucket_id = $1 ORDER BY name",
    [CAMPAIGN_IMAGES_BUCKET],
  );
  const campaignImagesObjects = objectsResult.rows.map((row) => row.name);

  const pricingResult = await db.query(
    "SELECT provider, model, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m FROM public.ai_model_pricing WHERE effective_until IS NULL ORDER BY provider, model",
  );

  const targetResult = await db.query(
    "SELECT capability, provider, model, protocol FROM public.ai_model_catalog WHERE capability = 'campaign_image' AND status = 'active' ORDER BY model",
  );
  const targets = targetResult.rows;

  const promptHashMap = promptHashes();

  // ─── 5. Orçamento (estimativa por run/cobertura) ───────────────────────────

  const target = targets[0] ?? null;
  const toolModel = target ? IMAGE_GENERATION_TOOL_MODELS[target.provider] ?? null : null;
  const toolPricingRow =
    target && toolModel
      ? pricingResult.rows.find(
          (row) => row.provider === target.provider && row.model === toolModel,
        ) ?? null
      : null;
  const toolPricingTableUsd = toNumber(toolPricingRow?.image_unit_usd ?? null);
  const toolPricingUsd =
    toolPricingTableUsd ?? (target?.provider === "openai" ? RESPONSES_IMAGE_GENERATION_BOOTSTRAP_USD : null);

  const perRun =
    toolPricingUsd === null
      ? { estimatedCostUsd: null, coverage: "missing", note: "pricing_unavailable" }
      : {
          estimatedCostUsd: Number(toolPricingUsd.toFixed(6)),
          coverage: "partial",
          costSource: "pricing_table",
          costFormulaVersion: RESPONSES_IMAGE_GENERATION_FORMULA_VERSION,
          imageToolComponentUsd: Number(toolPricingUsd.toFixed(6)),
          imageToolPricingModel: toolModel,
          costEstimationNote: NOTE_PROVISIONAL_IMAGE_TOOL_WITHOUT_TEXT,
          note: "Componente unitário da tool image_generation (sem componente textual de tokens). Estimativa PARCIAL — nunca valor exato.",
        };

  const plannedRuns =
    INITIAL_EXPERIMENT_PLAN.scenarioSlugs.length *
    INITIAL_EXPERIMENT_PLAN.repetitions *
    INITIAL_EXPERIMENT_PLAN.variants;
  const worstCaseRuns = LIMITS.DEFAULT_MAX_RUNS_PER_EXPERIMENT;
  const perRunUsd = perRun.estimatedCostUsd;
  const budget = {
    plan: {
      scenarioSlugs: INITIAL_EXPERIMENT_PLAN.scenarioSlugs,
      promptUnderTest: PROMPT_UNDER_TEST,
      variants: INITIAL_EXPERIMENT_PLAN.variants,
      repetitions: INITIAL_EXPERIMENT_PLAN.repetitions,
      runsPerVariant: INITIAL_EXPERIMENT_PLAN.runsPerVariant,
      plannedRuns,
      minPaidRuns: plannedRuns,
      maxRunsPerExperiment: LIMITS.DEFAULT_MAX_RUNS_PER_EXPERIMENT,
      maxRunsCeiling: LIMITS.MAX_RUNS_PER_EXPERIMENT,
      maxRepetitions: LIMITS.MAX_REPETITIONS,
      maxScenariosPerExperiment: LIMITS.MAX_SCENARIOS_PER_EXPERIMENT,
      maxConcurrentRuns: LIMITS.MAX_CONCURRENT_LAB_RUNS,
    },
    target: target
      ? {
          capability: target.capability,
          provider: target.provider,
          model: target.model,
          protocol: target.protocol,
        }
      : null,
    perRun,
    worstCase: {
      runs: worstCaseRuns,
      estimatedCostUsd: perRunUsd === null ? null : Number((perRunUsd * worstCaseRuns).toFixed(6)),
      coverage: perRun.coverage,
    },
    initialExperiment: {
      runs: plannedRuns,
      estimatedCostUsd: perRunUsd === null ? null : Number((perRunUsd * plannedRuns).toFixed(6)),
      coverage: perRun.coverage,
    },
    pricingRule:
      "Pricing `partial`/`missing` exige aviso na confirmação e NUNCA valor exato (faixa/estimativa). A estimativa autoritativa por run é exibida pelo endpoint /api/admin/laboratorio/experiments/[id]/estimate com cobertura complete|partial|missing. Nenhuma chamada paga é feita por este script.",
  };

  const providerKeys = {
    openai: readDotEnv(ENV_FILE).OPENAI_API_KEY ? "present" : "missing",
    gemini: readDotEnv(ENV_FILE).GEMINI_API_KEY ? "present" : "missing",
    note: "D15: confirmar que são chaves/projeto de DESENVOLVIMENTO (nunca produção). Valores nunca são impressos.",
  };

  const preSnapshot = {
    capturedAt: new Date().toISOString(),
    counts,
    creditBalances,
    campaignImagesObjects,
    promptHashes: promptHashMap,
  };

  report = {
    ok: true,
    phase: "48.1",
    plan: "48-1-14",
    task: "prep-local-uat",
    host: guard.supabaseHost,
    guard: {
      enabled: guard.enabled,
      reason: guard.reason,
      local: guard.local,
      supabaseHost: guard.supabaseHost,
      flagSource: guardEnv.source,
      allowedHostsConfigured: Boolean(guardEnv.allowedHosts),
    },
    database: {
      apiUrlHost: normalizeHostname(new URL(status.API_URL).hostname),
      dbUrlHost: normalizeHostname(new URL(status.DB_URL.replace(/^postgresql:\/\/(?:[^@]+@)?/i, "http://")).hostname),
      local: true,
    },
    labTables: { present: labTables, missing: missingLabTables },
    bucket: {
      id: LAB_ARTIFACT_BUCKET,
      exists: Boolean(bucketRow),
      public: bucketRow ? bucketRow.public : null,
      fileSizeLimit: bucketRow ? toNumber(bucketRow.file_size_limit) : null,
      allowedMimeTypes: bucketRow?.allowed_mime_types ?? null,
      policies,
      serviceRoleOnly: policies.length > 0 && foreignPolicies.length === 0,
      foreignPolicies,
    },
    scenarios: {
      bootstrap: scenarioBootstrap,
      required: scenarios,
      missing: missingScenarios.map((scenario) => scenario.slug),
    },
    providerKeys,
    budget,
    preSnapshot,
    writes: {
      paidCalls: 0,
      labTables: ["lab_scenarios", "lab_scenario_versions"],
      productiveTables: [],
      storage: [],
      note: "Somente o bootstrap idempotente dos cenários grava, e apenas nas tabelas lab_* próprias.",
    },
  };

  if (
    missingLabTables.length > 0 ||
    !bucketRow ||
    bucketRow.public !== false ||
    foreignPolicies.length > 0 ||
    missingScenarios.length > 0
  ) {
    report.ok = false;
    report.reason = "environment_not_ready";
    report.message =
      "Ambiente local incompleto: migration local, bucket lab-artifacts ou cenários controlados não conferem.";
  }
} finally {
  await db.end();
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
