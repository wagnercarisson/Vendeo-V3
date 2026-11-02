#!/usr/bin/env node
/**
 * Executa a suíte local (Vitest) e imprime a prontidão dos gates de integração
 * antes e depois. Nunca usa npm/npx; chama o Vitest com o próprio `node`.
 */
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, gateLine, postgresGateStatus, product11GateStatus } from './test-status.mjs';

function printGates(prefix) {
  console.log(
    `[${prefix}] ${gateLine('PostgreSQL/homolog', postgresGateStatus().ready).replace('[gates] ', '')}`,
  );
  console.log(
    `[${prefix}] ${gateLine('Produto 1:1', product11GateStatus().ready).replace('[gates] ', '')}`,
  );
}

printGates('antes');

const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run'],
  { cwd: REPO_ROOT, stdio: 'inherit', env: process.env },
);

printGates('depois');
process.exit(result.status ?? 1);
