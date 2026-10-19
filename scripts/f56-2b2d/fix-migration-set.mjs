#!/usr/bin/env node
// F56.2b2d — Plano 03 / Task 1: manifesto determinístico do conjunto definitivo de migrations.
//
// PROPÓSITO
//   Fixar por SHA-256 o conjunto definitivo de migrations (ordem por versão), calculado DEPOIS
//   da implementação e SEM presumir ledger 129. Consumido pelos Planos 05/06/07/08 do release.
//
// PROIBIÇÕES EXPLÍCITAS (read-only / offline)
//   - NÃO chama a CLI `supabase`, NÃO executa `db push`, `migration repair`, `migration up`,
//     reset, deploy nem qualquer comando remoto.
//   - NÃO abre conexão de banco nem de rede (sem `fetch`, sem `http(s)`, sem `npx` remoto).
//   - NÃO lê secrets nem variáveis de ambiente sensíveis.
//   - NÃO grava nada fora do arquivo informado em `--out`.
//   Este script apenas LÊ `*.sql` locais e CALCULA/COMPARA hashes.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";

// Padrão de nome aceito: YYYYMMDDNNNNNN_<descrição>.sql (14 dígitos de versão).
export const MIGRATION_NAME_PATTERN = /^(\d{14})_[A-Za-z0-9_]+\.sql$/;

/**
 * SHA-256 em hex. Aceita bytes (Buffer/TypedArray) ou string (conteúdo UTF-8),
 * ou ainda um caminho de arquivo quando `{ asPath: true }`.
 * @param {Buffer|Uint8Array|string} input
 * @param {{ asPath?: boolean }} [opts]
 * @returns {string} 64 hex chars
 */
export function computeSha256(input, opts = {}) {
  let bytes;
  if (Buffer.isBuffer(input) || ArrayBuffer.isView(input)) {
    bytes = Buffer.from(input);
  } else if (typeof input === "string") {
    bytes = opts.asPath ? readFileSync(input) : Buffer.from(input, "utf8");
  } else {
    throw new Error("computeSha256: entrada inválida (esperado Buffer|TypedArray|string)");
  }
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Extrai a versão (14 dígitos) do nome; retorna null se fora do padrão.
 * @param {string} fileName
 * @returns {string|null}
 */
export function parseMigrationVersion(fileName) {
  const m = MIGRATION_NAME_PATTERN.exec(String(fileName));
  return m ? m[1] : null;
}

/**
 * Lista apenas `*.sql` do diretório (não recursivo), sem hashear.
 * @param {string} dir
 * @returns {Array<{ version: string, file: string }>}
 */
export function listMigrationFiles(dir) {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => e.name);
  return names.map((file) => ({ version: parseMigrationVersion(file), file }));
}

/**
 * Constrói o conjunto ordenado por versão, rejeitando nome fora do padrão ou versão duplicada.
 * `entries` aceita strings (nome do arquivo) ou `{ file, version?, sha256? }`.
 * `hashOf(file)` é opcional e sobrescreve/anexa o sha256 (para CLI: lê do disco).
 * @param {Array<string|{ file: string, version?: string, sha256?: string }>} entries
 * @param {{ hashOf?: (file: string) => string }} [opts]
 * @returns {{ files: Array<{ version: string, file: string, sha256: string }>, count: number }}
 */
export function buildMigrationSet(entries, opts = {}) {
  if (!Array.isArray(entries)) {
    throw new Error("buildMigrationSet: esperado array de arquivos");
  }
  const seen = new Map();
  const files = [];
  for (const raw of entries) {
    const file = typeof raw === "string" ? raw : raw && raw.file;
    if (typeof file !== "string" || file.length === 0) {
      throw new Error("buildMigrationSet: entrada sem nome de arquivo");
    }
    const declared = typeof raw === "object" && raw ? raw.version : undefined;
    const version = declared || parseMigrationVersion(file);
    if (!version || !MIGRATION_NAME_PATTERN.test(file)) {
      throw new Error(`buildMigrationSet: nome fora do padrão YYYYMMDDNNNNNN_*.sql: '${file}'`);
    }
    if (seen.has(version)) {
      throw new Error(`buildMigrationSet: versão duplicada '${version}' (${seen.get(version)} e ${file})`);
    }
    seen.set(version, file);
    let sha256 = typeof raw === "object" && raw ? raw.sha256 : undefined;
    if (typeof opts.hashOf === "function") {
      sha256 = opts.hashOf(file);
    }
    files.push({ version, file, sha256: sha256 ?? "" });
  }
  files.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  return { files, count: files.length };
}

/**
 * Compara um manifesto com o conjunto atual; detecta missing / extra / hash_mismatch.
 * @param {{ files?: Array<{ version: string, file: string, sha256: string }> }} manifest
 * @param {Array<string|{ file: string, version?: string, sha256?: string }>} entries
 * @param {{ hashOf?: (file: string) => string }} [opts]
 * @returns {{ ok: boolean, missing: string[], extra: string[], hash_mismatch: Array<{ file: string, expected: string, actual: string }>, countMatch: boolean }}
 */
export function compareMigrationSet(manifest, entries, opts = {}) {
  const expected = buildMigrationSet(manifest?.files ?? []);
  const actual = buildMigrationSet(entries, opts);
  const expByVersion = new Map(expected.files.map((f) => [f.version, f]));
  const actByVersion = new Map(actual.files.map((f) => [f.version, f]));

  const missing = [];
  const extra = [];
  const hash_mismatch = [];

  for (const [version, f] of expByVersion) {
    if (!actByVersion.has(version)) {
      missing.push(f.file);
      continue;
    }
    const a = actByVersion.get(version);
    if (f.sha256 && a.sha256 && f.sha256 !== a.sha256) {
      hash_mismatch.push({ file: f.file, expected: f.sha256, actual: a.sha256 });
    }
  }
  for (const [version, f] of actByVersion) {
    if (!expByVersion.has(version)) extra.push(f.file);
  }

  const countMatch = expected.count === actual.count;
  const ok = missing.length === 0 && extra.length === 0 && hash_mismatch.length === 0;
  return { ok, missing, extra, hash_mismatch, countMatch };
}

/**
 * Serializa o manifesto. `ledger_applied`/`ledger_pending` só aparecem quando explicitamente
 * fornecidos (NUNCA inventar 129).
 * @param {{ files: Array<{ version: string, file: string, sha256: string }>, count: number }} set
 * @param {{ dir?: string, generatedAt?: string, ledgerApplied?: number|null, ledgerPending?: number|null }} [meta]
 * @returns {string}
 */
export function serializeManifest(set, meta = {}) {
  const manifest = {
    generated_at: meta.generatedAt ?? new Date().toISOString(),
    dir: meta.dir ?? null,
    count: set.count,
    files: set.files,
  };
  if (typeof meta.ledgerApplied === "number") manifest.ledger_applied = meta.ledgerApplied;
  if (typeof meta.ledgerPending === "number") manifest.ledger_pending = meta.ledgerPending;
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function readEntriesFromDir(dir) {
  return listMigrationFiles(dir);
}

function hashOfDir(dir) {
  return (file) => computeSha256(path.join(dir, file), { asPath: true });
}

function parseArgs(argv) {
  const args = { dir: null, out: null, check: null, applied: null, pending: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dir") args.dir = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--check") args.check = argv[++i];
    else if (a === "--applied") args.applied = Number(argv[++i]);
    else if (a === "--pending") args.pending = Number(argv[++i]);
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`argumento desconhecido: ${a}`);
  }
  return args;
}

function usage() {
  return [
    "uso:",
    "  node scripts/f56-2b2d/fix-migration-set.mjs --dir <dir> --out <manifest.json> [--applied N --pending N]",
    "  node scripts/f56-2b2d/fix-migration-set.mjs --check <manifest.json> [--dir <dir>]",
  ].join("\n");
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`ERRO: ${err.message}`);
    console.error(usage());
    process.exit(2);
  }
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  try {
    if (args.check) {
      const dir = args.dir ?? "supabase/migrations";
      const manifest = JSON.parse(readFileSync(args.check, "utf8"));
      const result = compareMigrationSet(manifest, readEntriesFromDir(dir), { hashOf: hashOfDir(dir) });
      if (result.ok) {
        console.log(`MANIFESTO OK: ${manifest?.count ?? "?"} arquivos conferem (SHA-256 e conjunto).`);
        process.exit(0);
      }
      console.error("MANIFESTO DIVERGENTE:");
      if (result.missing.length) console.error(` - missing: ${result.missing.join(", ")}`);
      if (result.extra.length) console.error(` - extra: ${result.extra.join(", ")}`);
      for (const h of result.hash_mismatch) {
        console.error(` - hash_mismatch: ${h.file} (esperado ${h.expected}, atual ${h.actual})`);
      }
      if (!result.countMatch) console.error(" - count divergente");
      process.exit(1);
    }

    if (!args.dir || !args.out) {
      console.error("ERRO: --dir e --out são obrigatórios para gerar o manifesto.");
      console.error(usage());
      process.exit(2);
    }
    const set = buildMigrationSet(readEntriesFromDir(args.dir), { hashOf: hashOfDir(args.dir) });
    const bad = set.files.filter((f) => !/^[0-9a-f]{64}$/.test(f.sha256));
    if (bad.length) {
      console.error(`ERRO: hash ausente/inválido em: ${bad.map((b) => b.file).join(", ")}`);
      process.exit(2);
    }
    writeFileSync(
      args.out,
      serializeManifest(set, {
        dir: args.dir,
        ledgerApplied: Number.isFinite(args.applied) && args.applied !== null ? args.applied : undefined,
        ledgerPending: Number.isFinite(args.pending) && args.pending !== null ? args.pending : undefined,
      }),
      "utf8",
    );
    console.log(`MANIFESTO GERADO: ${set.count} arquivos → ${args.out}`);
    process.exit(0);
  } catch (err) {
    console.error(`ERRO: ${err.message}`);
    process.exit(1);
  }
}

const modulePath = decodeURIComponent(new URL(import.meta.url).pathname);
const normalized = /^\/[A-Za-z]:/.test(modulePath) ? modulePath.slice(1) : modulePath;
const invoked = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(normalized) : false;
if (invoked) {
  main();
}
