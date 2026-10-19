#!/usr/bin/env node
// F56.2b2d — Plano 03 / Task 2: avaliador fail-closed de evidência de release/piloto.
//
// PROPÓSITO
//   (a) Avaliador PURO `evaluateReleaseGate(document, requiredCriteria)` com conjunto FECHADO
//       de critérios por perfil. `APPROVED` só com TODOS os obrigatórios `PASS` + fonte + timestamp;
//       ausência, `FAIL`, `INCONCLUSIVE`, status inválido ou contradição ⇒ não aprovado.
//   (b) CLI `--check <evidence.json> --profile release|backup|migrations|pilot` (exit 0 só aprovado)
//       e `--probe` read-only com allowlist de host e redaction obrigatória.
//
// PROIBIÇÕES EXPLÍCITAS
//   - NÃO executa `db push`, reset, deploy, `migration repair` nem chamada a provider de IA.
//   - NÃO grava segredo em arquivo; NÃO usa `npx` remoto.
//   - No modo `--probe`, executa SOMENTE leituras e NUNCA imprime tokens/chaves (redaction).

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// Conjunto FECHADO de critérios obrigatórios por perfil. Nada fora destas chaves é considerado.
export const REQUIRED_CRITERIA = Object.freeze({
  release: [
    "backup_manifest",
    "restore_proof",
    "migration_set_match",
    "ledger_complete",
    "deploy_commit_branch_off",
    "config_preflight_complete",
    "legacy_non_regression",
  ],
  backup: [
    "backup_db_manifest",
    "backup_storage_objects",
    "backup_encrypted_uploaded",
    "restore_separate_destination",
    "restore_counts_match",
    "restore_checksums_match",
    "restore_signed_url_read",
    "pitr_not_assumed",
  ],
  migrations: [
    "migration_set_match",
    "ledger_complete",
    "lab_migrations_treated",
    "no_repair_used",
  ],
  pilot: [
    "hosted_proofs_pass",
    "acceptance_to_start",
    "authorization_granted",
    "window_flag_on",
    "spend_under_cap",
    "no_non_test_store",
    "shutdown_flag_off_revoked",
  ],
});

export const VALID_CRITERION_STATUS = Object.freeze(new Set(["PASS", "FAIL", "INCONCLUSIVE"]));
export const LOOPBACK_HOSTS = Object.freeze(new Set(["127.0.0.1", "localhost", "::1"]));

/**
 * Redaction obrigatória: nunca deixar vazar tokens/chaves em logs ou mensagens.
 * @param {unknown} input
 * @returns {string}
 */
export function redact(input) {
  let text = typeof input === "string" ? input : String(input ?? "");
  text = text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]");
  text = text.replace(/([?&](?:apikey|api_key|key|token|access_token|password|secret)=)[^&\s]+/gi, "$1[REDACTED]");
  text = text.replace(/(authorization\s*:\s*bearer\s+)\S+/gi, "$1[REDACTED]");
  text = text.replace(/(sb_[a-z_]*_?[A-Za-z0-9]{12,})/g, "[REDACTED_KEY]");
  text = text.replace(/((?:service_role|anon|secret|password|api[_-]?key)\s*[:=]\s*)[^\s"',]+/gi, "$1[REDACTED]");
  return text;
}

/**
 * Normaliza o campo `criteria` do documento (array ou objeto) em um Map id→entrada.
 * @param {unknown} document
 * @returns {{ map: Map<string, object>, duplicate: string[], structural: string[] }}
 */
export function parseCriteria(document) {
  const structural = [];
  const duplicate = [];
  const map = new Map();
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    structural.push("documento ausente ou inválido (esperado objeto)");
    return { map, duplicate, structural };
  }
  const raw = document.criteria;
  if (raw === undefined) {
    structural.push("campo 'criteria' ausente");
    return { map, duplicate, structural };
  }
  const entries = Array.isArray(raw)
    ? raw.map((e) => [e?.id, e])
    : Object.entries(raw).map(([id, e]) => [id, e]);
  for (const [id, entry] of entries) {
    if (typeof id !== "string" || id.length === 0) {
      structural.push("critério sem id");
      continue;
    }
    if (map.has(id)) {
      duplicate.push(id);
      continue;
    }
    map.set(id, entry ?? {});
  }
  return { map, duplicate, structural };
}

/**
 * Avaliador puro fail-closed.
 * @param {unknown} document
 * @param {string[]} requiredCriteria
 * @returns {{ profile: string|null, approved: boolean, allPass: boolean, criteria: Array<object>, blocking: string[], errors: string[] }}
 */
export function evaluateReleaseGate(document, requiredCriteria) {
  const required = Array.isArray(requiredCriteria) ? requiredCriteria : [];
  const errors = [];
  const { map, duplicate, structural } = parseCriteria(document);
  errors.push(...structural);
  for (const id of duplicate) errors.push(`critério duplicado '${id}'`);

  const criteria = [];
  const blocking = [];

  for (const id of required) {
    const entry = map.get(id);
    if (!entry) {
      criteria.push({ id, status: "MISSING", source: null, timestamp: null, ok: false, reason: "ausente" });
      blocking.push(id);
      continue;
    }
    const status = typeof entry.status === "string" ? entry.status : "";
    const source = typeof entry.source === "string" ? entry.source.trim() : "";
    const timestamp = typeof entry.timestamp === "string" ? entry.timestamp.trim() : "";
    const problems = [];
    if (!VALID_CRITERION_STATUS.has(status)) problems.push(`status inválido '${status}'`);
    if (!source) problems.push("sem fonte");
    if (!timestamp) problems.push("sem timestamp");
    if (status !== "PASS") problems.push(`status ${status || "ausente"} (não PASS)`);
    const ok = problems.length === 0;
    criteria.push({ id, status: status || "MISSING", source: source || null, timestamp: timestamp || null, ok, reason: problems.join("; ") || "ok" });
    if (!ok) blocking.push(id);
  }

  const allPass = blocking.length === 0 && errors.length === 0;

  const claimed = document && typeof document === "object" ? document.approved : undefined;
  if (claimed === true && !allPass) errors.push("documento declarado 'approved: true' contradiz critérios não-PASS");
  if (claimed === false && allPass) errors.push("documento declarado 'approved: false' contradiz critérios todos PASS");

  const approved = allPass && errors.length === 0 && claimed !== false;
  const profile = document && typeof document === "object" && typeof document.profile === "string" ? document.profile : null;
  return { profile, approved, allPass, criteria, blocking, errors };
}

/**
 * Fail-closed de host: loopback sempre permitido; outro host só se estiver na allowlist.
 * @param {string} rawUrl
 * @param {Iterable<string>} [allowedHosts]
 * @returns {string} host autorizado
 */
export function assertAllowedHost(rawUrl, allowedHosts = []) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw new Error("probe: URL inválida");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("probe: protocolo não suportado");
  }
  const host = url.hostname;
  const allow = new Set([...LOOPBACK_HOSTS, ...allowedHosts].map((h) => String(h).trim()).filter(Boolean));
  if (!allow.has(host)) {
    throw new Error(`probe: host não autorizado '${host}' (allowlist F56_2B2D_ALLOWED_HOSTS)`);
  }
  return host;
}

function parseArgs(argv) {
  const args = { check: null, profile: null, probe: false, url: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--check") args.check = argv[++i];
    else if (a === "--profile") args.profile = argv[++i];
    else if (a === "--probe") args.probe = true;
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`argumento desconhecido: ${a}`);
  }
  return args;
}

function usage() {
  return [
    "uso:",
    "  node scripts/f56-2b2d/verify-hosted-release.mjs --check <evidence.json> --profile release|backup|migrations|pilot",
    "  node scripts/f56-2b2d/verify-hosted-release.mjs --probe --url <supabase-url>",
  ].join("\n");
}

// Leituras explicitamente read-only no modo probe. Nunca imprime tokens/chaves.
async function runProbe(url, env, fetchImpl) {
  const host = assertAllowedHost(url, String(env.F56_2B2D_ALLOWED_HOSTS ?? "").split(","));
  const base = url.replace(/\/+$/, "");
  const apikey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY ?? "";
  const headers = apikey ? { apikey, Authorization: `Bearer ${apikey}` } : {};
  const rows = [];
  try {
    const res = await fetchImpl(`${base}/rest/v1/feature_flags?select=key,enabled&key=like.product_1_1_%`, { headers });
    const body = await res.text();
    rows.push(res.ok ? `flags: ${body}` : `flags: HTTP ${res.status}`);
  } catch (err) {
    rows.push(`flags: erro (${err?.name ?? "erro"})`);
  }
  console.log(`probe host=${host}`);
  for (const line of rows) console.log(redact(line));
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`ERRO: ${redact(err.message)}`);
    console.error(usage());
    process.exit(2);
  }
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  if (args.probe) {
    if (!args.url) {
      console.error("ERRO: --probe exige --url");
      process.exit(2);
    }
    try {
      assertAllowedHost(args.url, String(process.env.F56_2B2D_ALLOWED_HOSTS ?? "").split(","));
    } catch (err) {
      console.error(`ERRO: ${redact(err.message)}`);
      process.exit(1);
    }
    runProbe(args.url, process.env, globalThis.fetch).catch((err) => {
      console.error(`ERRO probe: ${redact(err?.message ?? err)}`);
      process.exit(1);
    });
    return;
  }

  if (!args.check || !args.profile) {
    console.error("ERRO: --check e --profile são obrigatórios.");
    console.error(usage());
    process.exit(2);
  }
  if (!Object.prototype.hasOwnProperty.call(REQUIRED_CRITERIA, args.profile)) {
    console.error(`ERRO: perfil inválido '${redact(args.profile)}'`);
    process.exit(2);
  }

  let document;
  try {
    document = JSON.parse(readFileSync(args.check, "utf8"));
  } catch (err) {
    console.error(`ERRO: não foi possível ler ${redact(args.check)}: ${redact(err.message)}`);
    process.exit(2);
  }

  const result = evaluateReleaseGate(document, REQUIRED_CRITERIA[args.profile]);
  for (const c of result.criteria) {
    console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.id} | ${c.status} | ${c.source ?? "-"} | ${c.timestamp ?? "-"}`);
  }
  for (const e of result.errors) console.error(` - ${redact(e)}`);
  if (result.approved) {
    console.log(`GATE ${args.profile}: APPROVED (${result.criteria.length} critérios PASS)`);
    console.log("FAIL-STOP: liberado apenas mediante aprovação humana explícita do checkpoint.");
    process.exit(0);
  }
  console.error(`GATE ${args.profile}: NOT_APPROVED`);
  if (result.blocking.length) console.error(` - bloqueando: ${result.blocking.join(", ")}`);
  process.exit(1);
}

const modulePath = decodeURIComponent(new URL(import.meta.url).pathname);
const normalized = /^\/[A-Za-z]:/.test(modulePath) ? modulePath.slice(1) : modulePath;
const invoked = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(normalized) : false;
if (invoked) {
  main();
}
