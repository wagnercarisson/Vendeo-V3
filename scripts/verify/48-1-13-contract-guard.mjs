#!/usr/bin/env node
/**
 * F48.1 (plan 48-1-13) — Guard de contrato congelado do Laboratório Mínimo de IA.
 *
 * Uso:
 *   node scripts/verify/48-1-13-contract-guard.mjs [--base <sha>]
 *
 * Base do diff:
 *   - `--base <sha>` explícito, ou
 *   - o SHA persistido em `.planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt`
 *     (capturado pelo 48-1-01 ANTES de qualquer alteração de código da fase).
 *
 * O guard NUNCA usa `HEAD` como base: o `HEAD` muda ao longo da fase e, no
 * encerramento, o diff ficaria vazio — invalidando a prova de não-mudança
 * (T-48-1-103 do threat model do plano).
 *
 * Sem dependência nova: apenas `node:child_process`, `node:fs`, `node:path`.
 *
 * Cobertura:
 *   1. paths congelados (frozenPaths) ausentes do diff da fase;
 *   2. migrations: apenas arquivos NOVOS `*f48_1*`; nenhuma migration alheia;
 *   3. gateway/model-resolver sem referências ao laboratório;
 *   4. prompts oficiais byte-a-byte idênticos à base;
 *   5. seam `buildDirectorPrompt` puramente aditivo (sem remoção de produção);
 *   6. referências proibidas ao laboratório em código produtivo;
 *   7. laboratório sem referência nova a `generation_events` / `campaign-images` /
 *      `credit_transactions` / `admin_audit_log` / `campaign_art_versions` /
 *      `ai_model_selection`; `ai_model_catalog` somente leitura;
 *   8. contrato externo intacto (UI/form, schema público, snapshot/domínio,
 *      prompts, gateway, migration F47) + allowlist de arquivos alterados da fase;
 *   9. relatório JSON no stdout para registro no SUMMARY.
 *
 * Exit code 0 quando não há violação; 1 em qualquer violação (com arquivo e motivo).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const BASELINE_FILE = ".planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt";
const SHA_RE = /^[0-9a-f]{40}$/;

const SEAM_PATH = "src/lib/image-generation/services/image-generation-service.ts";
const CAMPAIGN_IMAGES_BUCKET_MIGRATION = "supabase/migrations/20260708000002_create_campaign_images_bucket.sql";
const F44_DOC_PATH = "docs/alinhamento-fase-44-temas-de-campanhas";

/* ------------------------------------------------------------------ helpers */

function fail(message) {
  console.error(`48-1-13 contract guard: ${message}`);
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readText(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) fail(`arquivo esperado ausente: ${relative}`);
  return fs.readFileSync(absolute, "utf8");
}

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".sql",
  ".txt",
  ".yml",
  ".yaml",
]);
const SKIP_DIRS = new Set(["node_modules", "__tests__", ".next", "dist", "build", "coverage"]);

function walk(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relative];
  const found = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...walk(`${relative}/${entry.name}`));
    } else if (entry.isFile()) {
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      found.push(`${relative}/${entry.name}`);
    }
  }
  return found;
}

function globUat48() {
  const dir = path.join(root, "scripts/uat");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("48-") && name.endsWith(".mjs"))
    .map((name) => `scripts/uat/${name}`);
}

const isTestFile = (file) => /(^|\/)__tests__\//.test(file) || /\.(test|spec)\.[^/]+$/.test(file);

const normalizeEol = (value) => value.replace(/\r\n/g, "\n");

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n\r]*/g, "$1");
}

function pushUnique(list, key, value) {
  if (!list.some((item) => item[key] === value[key] && JSON.stringify(item) === JSON.stringify(value))) {
    list.push(value);
  }
}

/* --------------------------------------------------------------------- base */

function resolveBase() {
  const argv = process.argv.slice(2);
  const flagIndex = argv.indexOf("--base");
  let raw;
  let origin;

  if (flagIndex !== -1) {
    raw = argv[flagIndex + 1];
    origin = "--base";
    if (!raw) fail("--base exige um SHA explícito de 40 caracteres hexadecimais.");
  } else {
    const baselinePath = path.join(root, BASELINE_FILE);
    if (!fs.existsSync(baselinePath)) {
      fail(`arquivo de baseline ausente: ${BASELINE_FILE} (informe --base <sha>).`);
    }
    raw = fs.readFileSync(baselinePath, "utf8");
    origin = BASELINE_FILE;
  }

  const base = String(raw).trim();
  if (base.length === 0) fail(`base vazia em ${origin}.`);
  if (base.includes("\u0000")) fail(`base contém bytes nulos (arquivo UTF-16?) em ${origin}.`);
  if (!SHA_RE.test(base)) {
    fail(
      `base inválida em ${origin}: esperado SHA de 40 hex minúsculos (BOM/UTF-16/linha vazia?). ` +
        `Recebido: ${JSON.stringify(base.slice(0, 80))}`
    );
  }

  try {
    git(["cat-file", "-e", `${base}^{commit}`]);
  } catch {
    fail(`base ${base} não existe neste repositório (origem: ${origin}).`);
  }

  return { base, origin };
}

/* ------------------------------------------------------------------- checks */

const frozenPaths = [
  "src/lib/ai/gateway.ts",
  "src/lib/ai/model-resolver.ts",
  "src/lib/ai/model-registry.ts",
  "src/lib/ai-cost/",
  "src/lib/campaign/",
  "src/lib/campaign-intelligence/",
  "src/lib/snapshot.ts",
  "src/lib/image-generation/providers/openai.ts",
  "src/lib/image-generation/schema.ts",
  "prompts/",
  "src/components/flow/",
  "src/app/api/campaign/generate-image/route.ts",
  "src/app/api/campaign/generate/route.ts",
  "supabase/migrations/20260914000001_f47_ai_model_catalog_selection.sql",
];

const externalContractPaths = [
  "src/components/flow/",
  "src/components/campaign/",
  "src/lib/image-generation/schema.ts",
  "src/lib/snapshot.ts",
  "src/lib/campaign/",
  "src/lib/campaign-intelligence/",
  "prompts/",
  "src/lib/ai/gateway.ts",
  "supabase/migrations/20260914000001_f47_ai_model_catalog_selection.sql",
];

const allowedPrefixes = [
  "src/lib/lab/",
  "src/lib/ai/lab-",
  "src/lib/ai/__tests__/lab-",
  "src/app/api/admin/laboratorio/",
  "src/app/(app)/admin/laboratorio/",
  "src/lib/image-generation/services/__tests__/image-generation-service",
  "fixtures/lab/",
  "scripts/lab/",
  "scripts/uat/48-",
  "supabase/migrations/",
  "openspec/changes/fase-48-1-laboratorio-ia-minimo/",
  ".planning/",
  "docs/",
];

const allowedExact = new Set([
  "src/app/(app)/admin/layout.tsx",
  "src/lib/admin/schemas.ts",
  SEAM_PATH,
  "src/app/api/campaign/generate-image/__tests__/route.test.ts",
  "src/lib/ai/__tests__/architecture-guard.test.ts",
  "scripts/verify/48-1-13-contract-guard.mjs",
  ".env.example",
  "ROADMAP.md",
  "AGENTS.md",
]);

const productionScanRoots = [
  "src/lib/ai-cost",
  "src/lib/campaign",
  "src/lib/campaign-intelligence",
  "src/lib/visual-signature",
  "src/app/api/campaign",
  "src/lib/image-generation/providers",
];

const productionForbiddenTokens = ["lab_", "lab-artifacts", "LabTelemetrySink", "LabPromptLoader"];

const labForbiddenTokens = [
  "generation_events",
  "campaign-images",
  "credit_transactions",
  "admin_audit_log",
  "campaign_art_versions",
  "ai_model_selection",
];

const { base, origin } = resolveBase();

const entries = git(["diff", "--name-status", "--no-renames", base])
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const parts = line.split("\t");
    return { status: parts[0].charAt(0), file: parts[parts.length - 1] };
  });
const changedFiles = entries.map((entry) => entry.file);

const frozenViolations = [];
const externalContractViolations = [];
const forbiddenReferences = [];

/* 1. paths congelados ------------------------------------------------------- */

const matchesPrefix = (file, prefix) => file === prefix || file.startsWith(prefix);

for (const file of changedFiles) {
  for (const frozen of frozenPaths) {
    if (matchesPrefix(file, frozen)) {
      pushUnique(frozenViolations, "file", { file, reason: `path congelado no diff da fase (${frozen})` });
    }
  }
}

/* 2. migrations ------------------------------------------------------------- */

const f48_1Migrations = [];
for (const entry of entries) {
  if (!entry.file.startsWith("supabase/migrations/")) continue;
  const name = path.basename(entry.file);
  if (name.includes("f48_1")) f48_1Migrations.push(entry.file);
  if (entry.status !== "A" || !name.includes("f48_1")) {
    pushUnique(externalContractViolations, "file", {
      file: entry.file,
      reason: `migration fora do escopo do laboratório (status=${entry.status}; esperado arquivo novo com f48_1 no nome)`,
    });
  }
}

if (changedFiles.includes(CAMPAIGN_IMAGES_BUCKET_MIGRATION)) {
  pushUnique(externalContractViolations, "file", {
    file: CAMPAIGN_IMAGES_BUCKET_MIGRATION,
    reason: "migration do bucket campaign-images aparece no diff da fase",
  });
}

/* 3. gateway / model-resolver ---------------------------------------------- */

const gatewaySource = readText("src/lib/ai/gateway.ts");
for (const token of ["lab_", "LabTelemetrySink", "ai_model_selection", "PersistedModelResolver"]) {
  if (gatewaySource.includes(token)) {
    pushUnique(frozenViolations, "file", {
      file: "src/lib/ai/gateway.ts",
      reason: `contém referência proibida "${token}"`,
    });
  }
}

const modelResolverSource = readText("src/lib/ai/model-resolver.ts");
if (/lab/i.test(modelResolverSource)) {
  pushUnique(frozenViolations, "file", {
    file: "src/lib/ai/model-resolver.ts",
    reason: 'contém referência proibida "lab"',
  });
}

/* 4. prompts oficiais ------------------------------------------------------ */

const promptFiles = walk("prompts");
let promptsUnchanged = promptFiles.length > 0;
for (const file of promptFiles) {
  let baseContent;
  try {
    baseContent = git(["show", `${base}:${file}`]);
  } catch {
    promptsUnchanged = false;
    pushUnique(frozenViolations, "file", { file, reason: "prompt ausente na base (prompt novo não é permitido)" });
    continue;
  }
  const current = fs.readFileSync(path.join(root, file), "utf8");
  if (normalizeEol(baseContent) !== normalizeEol(current)) {
    promptsUnchanged = false;
    pushUnique(frozenViolations, "file", { file, reason: "conteúdo divergente da base" });
  }
}

/* 5. seam aditivo ---------------------------------------------------------- */

const seamSource = readText(SEAM_PATH);
let additiveSeam = true;
if (!seamSource.includes("buildDirectorPrompt")) {
  additiveSeam = false;
  pushUnique(frozenViolations, "file", { file: SEAM_PATH, reason: "seam buildDirectorPrompt ausente" });
}

const seamDiff = git(["diff", "-U0", base, "--", SEAM_PATH]);
const seamRemovedLines = seamDiff
  .split(/\r?\n/)
  .filter((line) => line.startsWith("-") && !line.startsWith("---"));
const removedProductionLines = seamRemovedLines.filter((line) =>
  /generateImage|buildPromptVariables|assemblePrompt|brief_review_confirmed/.test(line)
);
for (const line of removedProductionLines) {
  additiveSeam = false;
  pushUnique(frozenViolations, "file", {
    file: SEAM_PATH,
    reason: `linha de produção removida pelo seam: ${line.trim().slice(0, 160)}`,
  });
}

/* 6. referências proibidas em código produtivo ------------------------------ */

for (const scanRoot of productionScanRoots) {
  for (const file of walk(scanRoot)) {
    if (isTestFile(file)) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const token of productionForbiddenTokens) {
      if (source.includes(token)) {
        pushUnique(forbiddenReferences, "file", { file, token, scope: "production" });
      }
    }
  }
}

/* 7. laboratório sem referência nova a superfícies produtivas --------------- */

const labScanTargets = [
  ...walk("src/lib/lab"),
  ...walk("src/lib/ai/lab-telemetry-sink.ts"),
  ...walk("src/app/api/admin/laboratorio"),
  ...walk("src/app/(app)/admin/laboratorio"),
  ...walk("scripts/lab"),
  ...globUat48(),
].filter((file) => !isTestFile(file));

for (const file of labScanTargets) {
  const source = stripComments(fs.readFileSync(path.join(root, file), "utf8"));
  for (const token of labForbiddenTokens) {
    if (source.includes(token)) {
      pushUnique(forbiddenReferences, "file", { file, token, scope: "lab" });
    }
  }
  if (source.includes("ai_model_catalog")) {
    for (const mutator of [".insert(", ".update(", ".delete("]) {
      if (source.includes(mutator)) {
        pushUnique(forbiddenReferences, "file", {
          file,
          token: `ai_model_catalog ${mutator}`,
          scope: "lab-catalog-write",
        });
      }
    }
  }
}

/* 8. contrato externo + allowlist de arquivos alterados --------------------- */

for (const file of changedFiles) {
  for (const external of externalContractPaths) {
    if (matchesPrefix(file, external)) {
      pushUnique(externalContractViolations, "file", {
        file,
        reason: `contrato externo alterado (${external})`,
      });
    }
  }
}

const isAllowedFile = (file) => {
  if (file === F44_DOC_PATH || file.startsWith(`${F44_DOC_PATH}/`)) return false;
  if (allowedExact.has(file)) return true;
  return allowedPrefixes.some((prefix) => matchesPrefix(file, prefix));
};

for (const file of changedFiles) {
  if (!isAllowedFile(file)) {
    pushUnique(externalContractViolations, "file", {
      file,
      reason: "arquivo fora da allowlist de alterações permitidas da fase",
    });
  }
}

/* ---------------------------------------------------------------- relatório */

const untrackedFiles = git(["ls-files", "--others", "--exclude-standard"])
  .split(/\r?\n/)
  .filter(Boolean);

const violationCount =
  frozenViolations.length + externalContractViolations.length + forbiddenReferences.length;

const report = {
  base,
  baseOrigin: origin,
  changedFiles,
  f48_1Migrations,
  frozenViolations,
  externalContractViolations,
  forbiddenReferences,
  promptsUnchanged,
  promptsChecked: promptFiles.length,
  additiveSeam,
  seamRemovedLines: seamRemovedLines.length,
  untrackedFiles,
  violationCount,
};

console.log(`base: ${base} (origem: ${origin})`);
console.log(`arquivos alterados: ${changedFiles.length}`);
console.log(`paths congelados: ${frozenViolations.length === 0 ? "OK" : `VIOLADO (${frozenViolations.length})`}`);
console.log(
  `prompts: ${promptsUnchanged ? `OK (${promptFiles.length} arquivos idênticos à base)` : "VIOLADO"}`
);
console.log(
  `seam aditivo: ${additiveSeam ? "OK" : "VIOLADO"} (linhas removidas no seam: ${seamRemovedLines.length})`
);
console.log(`referências proibidas: ${forbiddenReferences.length}`);
console.log(`contrato externo/allowlist: ${externalContractViolations.length === 0 ? "OK" : `VIOLADO (${externalContractViolations.length})`}`);
console.log(`migrations f48_1: ${f48_1Migrations.length}`);
console.log("F48.1 contract guard report (JSON):");
console.log(JSON.stringify(report, null, 2));

if (violationCount > 0) {
  for (const violation of frozenViolations) {
    console.error(`[frozen] ${violation.file}: ${violation.reason}`);
  }
  for (const violation of externalContractViolations) {
    console.error(`[contrato externo] ${violation.file}: ${violation.reason}`);
  }
  for (const violation of forbiddenReferences) {
    console.error(`[referência proibida] ${violation.file}: ${violation.token} (${violation.scope})`);
  }
  console.error(`48-1-13 contract guard FAIL: ${violationCount} violação(ões).`);
  process.exit(1);
}

console.log("48-1-13 contract guard PASS: 0 violações.");
