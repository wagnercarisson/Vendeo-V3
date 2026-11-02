#!/usr/bin/env node
/**
 * Validador e inventário da suíte global de testes.
 *
 * Fonte única: `scripts/testing/test-categories.json`.
 * Categorias: local (Vitest), scripts (`node:test`), três perfis PostgreSQL
 * (homolog, local/disposable e f50-4), integração por `.env.local` (app-env)
 * e integração isolada Produto 1:1.
 *
 * Uso: node scripts/testing/test-status.mjs
 * Exit 0 = mapa válido; exit 1 = falha estrutural do inventário.
 * Nunca imprime valores de variáveis de ambiente — apenas nomes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../..');

const INVENTORY_PATH = path.join(REPO_ROOT, 'scripts/testing/test-categories.json');
const DOTENV_PATH = path.join(REPO_ROOT, '.env.local');

const TEST_FILE_RE = /\.(test|spec)\.(mjs|js|ts|tsx|jsx)$/;
const TEST_DIRS = ['src', 'scripts', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);
const INTEGRATION_KEYS = [
  'integration.postgres-homolog',
  'integration.postgres-local',
  'integration.postgres-f50-4',
  'integration.app-env',
  'integration.product-1-1',
];
const INVENTORY_KEYS = ['nodeTest', ...INTEGRATION_KEYS];

// Heurística explícita (lista de padrões, não glob de exclusão).
const INTEGRATION_PATTERNS = [
  /\.postgres\.test\./,
  /credit-concurrency/,
  /credit-idempotency/,
  /credit-f50-11-integration/,
  /operation-cost-service\.integration/,
  /f50-4-concurrency/,
  /product-1-1\/.*\.integration\.test\.ts$/,
  /image-generation-operations-repository\.integration/,
  /tests\/integration\/product-1-1-credit-transaction/,
];

export function readInventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

export function allInventoried(inventory = readInventory()) {
  return INVENTORY_KEYS.flatMap((key) => inventory[key]);
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** Todos os arquivos que casam com o padrão de teste sob src/, scripts/ e tests/. */
export function walkTestFiles(dir = REPO_ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTestFiles(full, out);
    } else if (TEST_FILE_RE.test(entry.name)) {
      out.push(toPosix(path.relative(REPO_ROOT, full)));
    }
  }
  return out;
}

function walkRepoTestFiles() {
  const out = [];
  for (const dir of TEST_DIRS) {
    const full = path.join(REPO_ROOT, dir);
    if (fs.existsSync(full)) walkTestFiles(full, out);
  }
  return out;
}

function isIntegrationByHeuristic(file) {
  return INTEGRATION_PATTERNS.some((pattern) => pattern.test(file));
}

export function validateInventory(inventory = readInventory()) {
  const errors = [];

  const actualKeys = Object.keys(inventory).sort();
  const expectedKeys = [...INVENTORY_KEYS].sort();
  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) errors.push(`categoria ausente: ${key}`);
  }
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) errors.push(`categoria desconhecida: ${key}`);
  }
  if (errors.length > 0) return { ok: false, errors };

  for (const key of INVENTORY_KEYS) {
    if (!Array.isArray(inventory[key])) {
      errors.push(`categoria inválida: ${key}`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const seen = new Map();
  for (const key of INVENTORY_KEYS) {
    for (const file of inventory[key]) {
      if (seen.has(file)) {
        errors.push(`arquivo em mais de uma categoria: ${file} (${seen.get(file)} + ${key})`);
      } else {
        seen.set(file, key);
      }
    }
  }

  for (const file of allInventoried(inventory)) {
    if (!fs.existsSync(path.join(REPO_ROOT, file))) {
      errors.push(`arquivo do inventário ausente: ${file}`);
    }
  }

  for (const file of inventory.nodeTest) {
    const abs = path.join(REPO_ROOT, file);
    if (fs.existsSync(abs) && !fs.readFileSync(abs, 'utf8').includes('node:test')) {
      errors.push(`arquivo em nodeTest sem import de node:test: ${file}`);
    }
  }

  const nodeTestSet = new Set(inventory.nodeTest);
  const repoTestFiles = walkRepoTestFiles();
  for (const file of repoTestFiles) {
    if (!nodeTestSet.has(file) && fs.readFileSync(path.join(REPO_ROOT, file), 'utf8').includes('node:test')) {
      errors.push(`arquivo com node:test fora de nodeTest: ${file}`);
    }
  }

  const integrationSet = new Set(
    INTEGRATION_KEYS.flatMap((key) => inventory[key]),
  );
  for (const file of repoTestFiles) {
    if (isIntegrationByHeuristic(file) && !integrationSet.has(file)) {
      errors.push(`possível teste de integração fora do inventário: ${file}`);
    }
  }

  return { ok: errors.length === 0, errors, totals: { repoTestFiles: repoTestFiles.length } };
}

export function localTestFiles(inventory = readInventory()) {
  const excluded = new Set(allInventoried(inventory));
  return walkRepoTestFiles().filter((file) => !excluded.has(file));
}

function parsePostgresUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname) {
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);
}

export function postgresHomologGateStatus(env = process.env) {
  const reasons = [];
  const target = parsePostgresUrl(env.TEST_DATABASE_URL);
  if (
    !target ||
    target.hostname !== '127.0.0.1' ||
    target.port !== '57782' ||
    target.pathname !== '/postgres'
  ) {
    reasons.push('TEST_DATABASE_URL (esperado 127.0.0.1:57782/postgres)');
  }

  const ledgerCount = Number(env.F57_2_EXPECTED_LEDGER_COUNT ?? '');
  if (!Number.isInteger(ledgerCount) || ledgerCount < 149) {
    reasons.push('F57_2_EXPECTED_LEDGER_COUNT (inteiro >= 149)');
  }
  if (!/^[0-9a-f]{64}$/.test((env.F57_2_EXPECTED_LEDGER_SHA256 ?? '').trim())) {
    reasons.push('F57_2_EXPECTED_LEDGER_SHA256 (64 hex)');
  }
  if (env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_DB_URL) {
    reasons.push('SUPABASE_ACCESS_TOKEN/SUPABASE_DB_URL (devem estar ausentes)');
  }

  return { ready: reasons.length === 0, reasons };
}

export function postgresLocalGateStatus(env = process.env) {
  const reasons = [];
  const target = parsePostgresUrl(env.TEST_DATABASE_URL);
  if (!target || !isLoopbackHost(target.hostname)) {
    reasons.push('TEST_DATABASE_URL (PostgreSQL loopback)');
  } else if (
    target.hostname === '127.0.0.1' &&
    target.port === '57782' &&
    target.pathname === '/postgres'
  ) {
    reasons.push('TEST_DATABASE_URL (recusa o alvo do perfil homolog 127.0.0.1:57782/postgres)');
  }
  if (env.POSTGRES_LOCAL_ALLOW_WRITES !== '1') {
    reasons.push('POSTGRES_LOCAL_ALLOW_WRITES=1 (as suítes gravam e limpam fixtures)');
  }
  return { ready: reasons.length === 0, reasons };
}

export function postgresF504GateStatus(env = process.env) {
  const reasons = [];
  if (env.F50_4_RUN_CONCURRENCY !== '1') {
    reasons.push('F50_4_RUN_CONCURRENCY=1 (opt-in explícito)');
  }
  const expectedPort = env.F50_4_DB_PORT ?? '54422';
  const target = parsePostgresUrl(env.F50_4_DB_URL ?? env.TEST_DATABASE_URL);
  if (
    !target ||
    !isLoopbackHost(target.hostname) ||
    target.port !== expectedPort ||
    target.pathname !== '/postgres'
  ) {
    reasons.push(`F50_4_DB_URL (127.0.0.1:${expectedPort}/postgres)`);
  }
  return { ready: reasons.length === 0, reasons };
}

/**
 * Espelha o parser de `.env.local` usado por `operation-cost-service.integration.test.ts`
 * (somente chaves MAIÚSCULAS, valor trimado e quotes externas removidas).
 */
export function parseDotEnv(content) {
  const parsed = {};
  for (const line of String(content).replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

export function readDotEnv() {
  try {
    return fs.readFileSync(DOTENV_PATH, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Valida o alvo EFETIVO da suíte app-env: os valores de `.env.local`
 * sobrescrevem `process.env` dentro do teste, então o arquivo é a fonte.
 */
export function appEnvGateStatus(env = process.env, dotenvContent = null) {
  const reasons = [];
  const fileEnv = dotenvContent === null ? {} : parseDotEnv(dotenvContent);

  // O teste relê `.env.local` e sobrescreve `process.env`. Validamos TODOS os
  // candidatos (arquivo e processo) para que nenhum caminho de execução
  // consiga apontar para um alvo diferente do aprovado.
  const candidates = (key) =>
    [fileEnv[key], env[key]].filter((value) => typeof value === 'string');

  const urls = candidates('NEXT_PUBLIC_SUPABASE_URL');
  const urlOk = (raw) => {
    try {
      const url = new URL(raw);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        isLoopbackHost(url.hostname) &&
        !/\.supabase\.(co|in|com)$/i.test(url.hostname)
      );
    } catch {
      return false;
    }
  };
  if (urls.length === 0 || urls.some((raw) => raw.length === 0 || !urlOk(raw))) {
    reasons.push('NEXT_PUBLIC_SUPABASE_URL efetiva (loopback, no .env.local e no processo)');
  }

  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const values = candidates(key);
    if (values.length === 0 || values.some((value) => value.length === 0)) {
      reasons.push(`${key} efetiva no .env.local/processo`);
    }
  }

  return { ready: reasons.length === 0, reasons };
}

export function product11GateStatus(env = process.env) {
  const url = env.F562A_ISOLATED_SUPABASE_URL;
  const serviceRoleKey = env.F562A_ISOLATED_SERVICE_ROLE_KEY;
  const databaseUrl = env.F562A_ISOLATED_DATABASE_URL;
  const ready =
    url === 'http://127.0.0.1:56321' &&
    typeof serviceRoleKey === 'string' &&
    serviceRoleKey.length > 0 &&
    typeof databaseUrl === 'string' &&
    databaseUrl.startsWith('postgresql://') &&
    isLoopbackHost(new URL(databaseUrl).hostname) &&
    new URL(databaseUrl).port === '56322';
  return { ready, reasons: ready ? [] : ['F562A_ISOLATED_* (API 127.0.0.1:56321 / DB 56322)'] };
}

export function gateLine(name, status) {
  return status.ready
    ? `[gates] ${name}: ambiente presente (executar pelo comando dedicado)`
    : `[gates] ${name}: GATE NÃO EXECUTADO — NÃO APROVADO (${status.reasons.join('; ')})`;
}

export const GATE_ROWS = [
  ['PostgreSQL/homolog (F57.2)', 'integration.postgres-homolog', postgresHomologGateStatus],
  ['PostgreSQL/local-disposable', 'integration.postgres-local', postgresLocalGateStatus],
  ['PostgreSQL/f50-4', 'integration.postgres-f50-4', postgresF504GateStatus],
  ['app-env (.env.local)', 'integration.app-env', () => appEnvGateStatus(process.env, readDotEnv())],
  ['Produto 1:1', 'integration.product-1-1', product11GateStatus],
];

function printTable(inventory) {
  const localCount = localTestFiles(inventory).length;
  console.log('Categoria | Arquivos | Executável agora');
  console.log('--- | --- | ---');
  console.log(`local (Vitest) | ${localCount} | sim`);
  console.log(`scripts (node:test) | ${inventory.nodeTest.length} | sim`);
  for (const [label, key, statusFn] of GATE_ROWS) {
    const status = statusFn();
    console.log(
      `${label} | ${inventory[key].length} | ${status.ready ? 'ambiente presente' : 'GATE NÃO EXECUTADO — NÃO APROVADO'}`,
    );
  }
  console.log(`\nTotal de arquivos de teste no repo: ${walkRepoTestFiles().length}`);
  console.log('Fonte única: scripts/testing/test-categories.json');
}

function main() {
  const inventory = readInventory();
  const result = validateInventory(inventory);

  if (!result.ok) {
    console.error('INVENTÁRIO INVÁLIDO:');
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }

  console.log('Inventário válido (sem duplicatas, sem ausências, node:test isolado, integração coberta).\n');
  printTable(inventory);
  console.log('');
  for (const [label, , statusFn] of GATE_ROWS) {
    console.log(gateLine(label, statusFn()));
  }
  console.log('\nGATE NÃO EXECUTADO ≠ APROVADO. Exit 2 nos comandos de integração significa ausência/invalidez de ambiente, não falha de teste.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
