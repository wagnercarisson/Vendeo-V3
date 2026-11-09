#!/usr/bin/env node
/**
 * Executa um perfil de integração, validando TODOS os pré-requisitos antes.
 *
 * Uso: node scripts/testing/run-integration.mjs <perfil>
 * Perfis: postgres-homolog | postgres-local | postgres-f50-4 | app-env | product-1-1
 *
 * `postgres` sem perfil é apenas status/recusa: imprime a prontidão dos três
 * perfis e sai 2, sem executar nada.
 *
 * Exit 0 = Vitest executou (o exit code dele é repassado);
 * exit 2 = ambiente ausente/inválido ("GATE NÃO EXECUTADO — NÃO APROVADO");
 * exit 3 = perfil inválido.
 * Nunca provisiona/cria ambiente e nunca imprime valores de segredos.
 */
import { spawnSync } from 'node:child_process';
import {
  REPO_ROOT,
  appEnvGateStatus,
  f60GateStatus,
  gateLine,
  postgresF504GateStatus,
  postgresHomologGateStatus,
  postgresLocalGateStatus,
  product11GateStatus,
  readDotEnv,
} from './test-status.mjs';

const POSTGRES_PROFILES = [
  ['postgres-homolog', 'PostgreSQL/homolog (F57.2)', postgresHomologGateStatus],
  ['postgres-local', 'PostgreSQL/local-disposable', postgresLocalGateStatus],
  ['postgres-f50-4', 'PostgreSQL/f50-4', postgresF504GateStatus],
];

const PROFILES = {
  'postgres-homolog': {
    label: 'PostgreSQL/homolog (F57.2)',
    config: 'vitest.integration-postgres-homolog.config.ts',
    preflight: postgresHomologGateStatus,
  },
  'postgres-local': {
    label: 'PostgreSQL/local-disposable',
    config: 'vitest.integration-postgres-local.config.ts',
    preflight: postgresLocalGateStatus,
  },
  'postgres-f50-4': {
    label: 'PostgreSQL/f50-4',
    config: 'vitest.integration-postgres-f50-4.config.ts',
    preflight: postgresF504GateStatus,
  },
  'app-env': {
    label: 'app-env (.env.local)',
    config: 'vitest.integration-app-env.config.ts',
    preflight: () => appEnvGateStatus(process.env, readDotEnv()),
  },
  'product-1-1': {
    label: 'Produto 1:1',
    config: 'vitest.integration-product-1-1.config.ts',
    preflight: product11GateStatus,
  },
  f60: {
    label: 'F60 duas etapas',
    config: 'vitest.integration-f60.config.ts',
    preflight: f60GateStatus,
  },
};

const requested = process.argv[2];

if (requested === 'postgres') {
  for (const [, label, statusFn] of POSTGRES_PROFILES) {
    console.error(gateLine(label, statusFn()));
  }
  console.error(
    'GATE NÃO EXECUTADO — NÃO APROVADO (postgres): escolha um perfil — npm.cmd run test:integration:postgres:homolog | :local | :f50-4.',
  );
  process.exit(2);
}

const profile = PROFILES[requested];

if (!profile) {
  console.error(
    `Perfil inválido: ${requested ?? '(vazio)'}. Use: postgres-homolog | postgres-local | postgres-f50-4 | app-env | product-1-1 | f60`,
  );
  process.exit(3);
}

const status = profile.preflight();
if (!status.ready) {
  console.error(`GATE NÃO EXECUTADO — NÃO APROVADO (${requested})`);
  console.error('Pré-requisitos ausentes ou inválidos (apenas nomes):');
  for (const reason of status.reasons) console.error(`- ${reason}`);
  process.exit(2);
}

let childEnv = process.env;

if (requested === 'product-1-1') {
  const f562a = {
    url: process.env.F562A_ISOLATED_SUPABASE_URL,
    key: process.env.F562A_ISOLATED_SERVICE_ROLE_KEY,
    db: process.env.F562A_ISOLATED_DATABASE_URL,
  };
  const p11 = {
    url: process.env.P1_1_ISOLATED_SUPABASE_URL,
    key: process.env.P1_1_ISOLATED_SERVICE_ROLE_KEY,
    db: process.env.P1_1_ISOLATED_DATABASE_URL,
  };
  const presentCount = [p11.url, p11.key, p11.db].filter(
    (value) => typeof value === 'string' && value.length > 0,
  ).length;

  childEnv = { ...process.env };
  if (presentCount === 0) {
    childEnv.P1_1_ISOLATED_SUPABASE_URL = f562a.url;
    childEnv.P1_1_ISOLATED_SERVICE_ROLE_KEY = f562a.key;
    childEnv.P1_1_ISOLATED_DATABASE_URL = f562a.db;
    console.error('Aliases P1_1_ISOLATED_* derivados de F562A (mesma instância isolada).');
  } else if (
    presentCount !== 3 ||
    p11.url !== f562a.url ||
    p11.key !== f562a.key ||
    p11.db !== f562a.db
  ) {
    console.error(`GATE NÃO EXECUTADO — NÃO APROVADO (${requested})`);
    console.error('P1_1_ISOLATED_* parcial ou divergente de F562A_ISOLATED_* — nada foi executado.');
    process.exit(2);
  }
}

const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--config', profile.config],
  { cwd: REPO_ROOT, stdio: 'inherit', env: childEnv },
);

process.exit(result.status ?? 1);
