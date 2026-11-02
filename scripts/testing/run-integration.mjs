#!/usr/bin/env node
/**
 * Executa uma categoria de integração, validando o ambiente antes.
 *
 * Uso: node scripts/testing/run-integration.mjs <postgres|product-1-1>
 * Exit 0 = Vitest executou (o exit code dele é repassado);
 * exit 2 = ambiente ausente/inválido ("GATE NÃO EXECUTADO — NÃO APROVADO");
 * exit 3 = categoria inválida.
 * Nunca provisiona/altera banco e nunca imprime valores de segredos.
 */
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './test-status.mjs';

const CONFIGS = {
  postgres: 'vitest.integration-postgres.config.ts',
  'product-1-1': 'vitest.integration-product-1-1.config.ts',
};

const category = process.argv[2];
const config = CONFIGS[category];

if (!config) {
  console.error(`Categoria inválida: ${category ?? '(vazia)'}. Use: postgres | product-1-1`);
  process.exit(3);
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

function reportUnexecuted(missing) {
  console.error(`GATE NÃO EXECUTADO — NÃO APROVADO (${category})`);
  console.error('Variáveis ausentes ou inválidas (apenas nomes):');
  for (const name of missing) console.error(`- ${name}`);
  process.exit(2);
}

function runVitest(env) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', '--config', config],
    { cwd: REPO_ROOT, stdio: 'inherit', env },
  );
  process.exit(result.status ?? 1);
}

if (category === 'postgres') {
  const missing = [];
  const url = process.env.TEST_DATABASE_URL;
  if (typeof url !== 'string' || !url.startsWith('postgresql://') || !parseLoopback(url)) {
    missing.push('TEST_DATABASE_URL');
  }
  if (missing.length > 0) reportUnexecuted(missing);

  if (!process.env.F50_4_RUN_CONCURRENCY || !process.env.F50_4_DB_URL) {
    console.error(
      'Aviso: F50_4_RUN_CONCURRENCY/F50_4_DB_URL ausentes — gate condicional f50-4-concurrency ficará SKIPADO — NÃO APROVADO.',
    );
  }
  runVitest(process.env);
}

if (category === 'product-1-1') {
  const f562a = {
    url: process.env.F562A_ISOLATED_SUPABASE_URL,
    key: process.env.F562A_ISOLATED_SERVICE_ROLE_KEY,
    db: process.env.F562A_ISOLATED_DATABASE_URL,
  };

  const f562aValid =
    f562a.url === 'http://127.0.0.1:56321' &&
    typeof f562a.key === 'string' &&
    f562a.key.length > 0 &&
    typeof f562a.db === 'string' &&
    f562a.db.startsWith('postgresql://') &&
    parseLoopback(f562a.db, '56322');

  if (!f562aValid) {
    reportUnexecuted([
      'F562A_ISOLATED_SUPABASE_URL',
      'F562A_ISOLATED_SERVICE_ROLE_KEY',
      'F562A_ISOLATED_DATABASE_URL',
    ]);
  }

  const p11 = {
    url: process.env.P1_1_ISOLATED_SUPABASE_URL,
    key: process.env.P1_1_ISOLATED_SERVICE_ROLE_KEY,
    db: process.env.P1_1_ISOLATED_DATABASE_URL,
  };
  const p11Present = [p11.url, p11.key, p11.db].map(
    (value) => typeof value === 'string' && value.length > 0,
  );
  const presentCount = p11Present.filter(Boolean).length;

  const childEnv = { ...process.env };
  if (presentCount === 0) {
    childEnv.P1_1_ISOLATED_SUPABASE_URL = f562a.url;
    childEnv.P1_1_ISOLATED_SERVICE_ROLE_KEY = f562a.key;
    childEnv.P1_1_ISOLATED_DATABASE_URL = f562a.db;
    console.error(
      'Aliases P1_1_ISOLATED_* derivados de F562A (mesma instância isolada).',
    );
  } else if (
    presentCount !== 3 ||
    p11.url !== f562a.url ||
    p11.key !== f562a.key ||
    p11.db !== f562a.db
  ) {
    reportUnexecuted([
      'P1_1_ISOLATED_SUPABASE_URL',
      'P1_1_ISOLATED_SERVICE_ROLE_KEY',
      'P1_1_ISOLATED_DATABASE_URL',
    ]);
  }

  runVitest(childEnv);
}
