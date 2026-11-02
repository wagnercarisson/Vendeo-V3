#!/usr/bin/env node
/**
 * Executa os testes de script (`node:test`) listados no inventário.
 * Nunca usa npx/npm; chama `node --test` diretamente.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, readInventory } from './test-status.mjs';

const files = readInventory().nodeTest;
const missing = files.filter((file) => !fs.existsSync(path.join(REPO_ROOT, file)));

if (missing.length > 0) {
  console.error('Arquivos de script ausentes no inventário:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
