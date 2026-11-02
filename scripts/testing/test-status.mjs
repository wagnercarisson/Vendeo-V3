#!/usr/bin/env node
/**
 * Validador e inventário da suíte global de testes.
 *
 * Fonte única: `scripts/testing/test-categories.json`.
 * Categorias: local (Vitest), scripts (`node:test`), integração PostgreSQL e
 * integração isolada Produto 1:1.
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

const TEST_FILE_RE = /\.(test|spec)\.(mjs|js|ts|tsx|jsx)$/;
const TEST_DIRS = ['src', 'scripts', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);
const INVENTORY_KEYS = ['nodeTest', 'integration.postgres', 'integration.product-1-1'];

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
  return [...inventory.nodeTest, ...inventory['integration.postgres'], ...inventory['integration.product-1-1']];
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

  for (const key of INVENTORY_KEYS) {
    if (!Array.isArray(inventory[key])) {
      errors.push(`categoria ausente ou inválida: ${key}`);
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

  const integrationSet = new Set(inventory['integration.postgres'].concat(inventory['integration.product-1-1']));
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

function parseLoopback(urlString, expectedPort) {
  if (typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) return false;
    return !expectedPort || parsed.port === String(expectedPort);
  } catch {
    return false;
  }
}

export function postgresGateStatus(env = process.env) {
  const url = env.TEST_DATABASE_URL;
  const ready =
    typeof url === 'string' && url.startsWith('postgresql://') && parseLoopback(url);
  const conditional = Boolean(env.F50_4_RUN_CONCURRENCY && env.F50_4_DB_URL);
  return { ready, conditional };
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
    parseLoopback(databaseUrl, '56322');
  return { ready };
}

export function gateLine(name, ready) {
  return ready
    ? `[gates] ${name}: ambiente presente (executar pelo comando dedicado)`
    : `[gates] ${name}: GATE NÃO EXECUTADO — NÃO APROVADO`;
}

function printTable(inventory) {
  const localCount = localTestFiles(inventory).length;
  const postgres = postgresGateStatus();
  const product = product11GateStatus();
  const rows = [
    ['local (Vitest)', localCount, 'sim', 'nenhum'],
    ['scripts (node:test)', inventory.nodeTest.length, 'sim', 'nenhum'],
    [
      'integração PostgreSQL/homolog',
      inventory['integration.postgres'].length,
      postgres.ready ? 'sim' : 'GATE NÃO EXECUTADO — NÃO APROVADO',
      'TEST_DATABASE_URL (loopback)',
    ],
    [
      'integração Produto 1:1',
      inventory['integration.product-1-1'].length,
      product.ready ? 'sim' : 'GATE NÃO EXECUTADO — NÃO APROVADO',
      'F562A_ISOLATED_SUPABASE_URL / F562A_ISOLATED_SERVICE_ROLE_KEY / F562A_ISOLATED_DATABASE_URL',
    ],
  ];
  console.log('Categoria | Arquivos | Executável agora | Pré-requisitos');
  console.log('--- | --- | --- | ---');
  for (const row of rows) console.log(row.join(' | '));
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
  console.log(gateLine('PostgreSQL/homolog', postgresGateStatus().ready));
  console.log(gateLine('Produto 1:1', product11GateStatus().ready));
  console.log('\nGATE NÃO EXECUTADO ≠ APROVADO. Exit 2 nos comandos de integração significa ausência de ambiente, não falha de teste.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
