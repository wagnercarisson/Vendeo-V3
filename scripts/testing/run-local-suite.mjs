#!/usr/bin/env node
/**
 * Executa a suíte local (Vitest) e imprime a prontidão dos gates de integração
 * antes e depois. Nunca usa npm/npx; chama o Vitest com o próprio `node`.
 *
 * Argumentos recebidos são repassados ao Vitest, por exemplo:
 *   npm.cmd test -- src/lib/legal/__tests__/integration.test.ts --reporter=dot
 */
import { spawnSync } from 'node:child_process';
import {
  GATE_ROWS,
  REPO_ROOT,
  gateLine,
} from './test-status.mjs';

function printGates(prefix) {
  for (const [label, , statusFn] of GATE_ROWS) {
    console.log(`[${prefix}] ${gateLine(label, statusFn()).replace('[gates] ', '')}`);
  }
}

const forwarded = process.argv.slice(2);

printGates('antes');

const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', ...forwarded],
  { cwd: REPO_ROOT, stdio: 'inherit', env: process.env },
);

printGates('depois');
process.exit(result.status ?? 1);
