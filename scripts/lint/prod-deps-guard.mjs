#!/usr/bin/env node
/**
 * Guard de dependências produtivas — quick 261121-k4g.
 *
 * Contrato:
 * - Lê apenas `package-lock.json` (padrão) ou o arquivo passado em `--lock`.
 * - NUNCA instala nada, NUNCA acessa rede, NUNCA escreve fora de `--out`.
 * - Universo comparado: TODAS as entradas de `packages` com `dev !== true` e
 *   `devOptional !== true` — a árvore produtiva como o npm a marca no lockfile.
 *   Isso inclui, por construção, as entradas `peer: true` (peers efetivamente
 *   resolvidos) e as `optional: true`. Um walk manual por `dependencies` +
 *   `optionalDependencies` alcança menos entradas e deixaria peers resolvidos
 *   de fora, por isso não é usado como fonte da verdade.
 * - Peers ausentes/opcionais simplesmente não existem no lockfile; nada é
 *   instalado para "satisfazer" a conferência.
 * - Qualquer diferença de presença, `version`, `resolved`, `integrity`,
 *   `optional` ou `peer` entre dois snapshots = PARADA (exit 1), sem
 *   atualização automática.
 *
 * Uso:
 *   node scripts/lint/prod-deps-guard.mjs snapshot --out <arquivo> [--lock <arquivo>]
 *   node scripts/lint/prod-deps-guard.mjs compare --before <a> --after <b>
 *
 * Exit codes:
 *   0 — snapshot gravado ou snapshots idênticos
 *   1 — erro de uso/leitura ou diferença detectada
 */

import fs from 'node:fs';
import path from 'node:path';

const COMPARED_FIELDS = ['version', 'resolved', 'integrity', 'optional', 'peer'];

function usage() {
  console.error(
    [
      'Uso:',
      '  node scripts/lint/prod-deps-guard.mjs snapshot --out <arquivo> [--lock <arquivo>]',
      '  node scripts/lint/prod-deps-guard.mjs compare --before <a> --after <b>',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new Error(`Argumento inesperado: ${token}`);
    const key = token.slice(2);
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Valor ausente para --${key}`);
    }
    options[key] = value;
    i += 1;
  }
  return { mode, options };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isProductionVisible(entry) {
  return entry.dev !== true && entry.devOptional !== true;
}

function snapshot(lockPath) {
  const lock = readJson(lockPath);
  if (!lock || typeof lock !== 'object' || !lock.packages) {
    throw new Error(`Lockfile inválido (sem "packages"): ${lockPath}`);
  }
  const lockfileVersion = Number(lock.lockfileVersion);
  if (!Number.isFinite(lockfileVersion) || lockfileVersion < 2) {
    throw new Error(`lockfileVersion não suportado: ${lock.lockfileVersion}`);
  }

  const allEntries = Object.entries(lock.packages).filter(([key]) => key !== '');
  const productionEntries = allEntries.filter(([, entry]) => isProductionVisible(entry));

  const packages = {};
  for (const [key, entry] of productionEntries.sort(([a], [b]) => a.localeCompare(b))) {
    packages[key] = {
      version: entry.version ?? null,
      resolved: entry.resolved ?? null,
      integrity: entry.integrity ?? null,
      optional: entry.optional === true,
      peer: entry.peer === true,
    };
  }

  return {
    lockfileVersion,
    counts: {
      entries: allEntries.length,
      production: productionEntries.length,
      peerResolved: productionEntries.filter(([, entry]) => entry.peer === true).length,
      optional: productionEntries.filter(([, entry]) => entry.optional === true).length,
      dev: allEntries.length - productionEntries.length,
    },
    packages,
  };
}

function compare(beforePath, afterPath) {
  const before = readJson(beforePath);
  const after = readJson(afterPath);
  const beforePackages = before.packages ?? {};
  const afterPackages = after.packages ?? {};

  const beforeKeys = Object.keys(beforePackages);
  const afterKeys = Object.keys(afterPackages);
  const afterKeySet = new Set(afterKeys);
  const beforeKeySet = new Set(beforeKeys);

  const added = afterKeys.filter((key) => !beforeKeySet.has(key));
  const removed = beforeKeys.filter((key) => !afterKeySet.has(key));
  const changed = [];

  for (const key of beforeKeys) {
    if (!afterKeySet.has(key)) continue;
    const from = beforePackages[key];
    const to = afterPackages[key];
    const fields = COMPARED_FIELDS.filter((field) => from[field] !== to[field]);
    if (fields.length > 0) {
      changed.push({
        key,
        fields: fields.map((field) => `${field}: ${JSON.stringify(from[field])} -> ${JSON.stringify(to[field])}`),
      });
    }
  }

  const totals = {
    before: { production: Object.keys(beforePackages).length, peerResolved: before.counts?.peerResolved ?? null },
    after: { production: Object.keys(afterPackages).length, peerResolved: after.counts?.peerResolved ?? null },
  };

  const lines = [];
  lines.push(`Produção antes: ${totals.before.production} entradas (peer resolvidos: ${totals.before.peerResolved})`);
  lines.push(`Produção depois: ${totals.after.production} entradas (peer resolvidos: ${totals.after.peerResolved})`);

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    lines.push('Resultado: árvore produtiva idêntica (presença e metadados).');
    console.log(lines.join('\n'));
    return 0;
  }

  lines.push(`Resultado: DIFERENÇA DETECTADA — ${added.length} adicionada(s), ${removed.length} removida(s), ${changed.length} alterada(s).`);
  for (const key of added) lines.push(`  + ${key}@${afterPackages[key].version}`);
  for (const key of removed) lines.push(`  - ${key}@${beforePackages[key].version}`);
  for (const entry of changed) lines.push(`  ~ ${entry.key}: ${entry.fields.join('; ')}`);
  console.log(lines.join('\n'));
  return 1;
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    return 1;
  }

  const { mode, options } = parsed;

  try {
    if (mode === 'snapshot') {
      const lockPath = options.lock ?? 'package-lock.json';
      const outPath = options.out;
      if (!outPath) throw new Error('--out é obrigatório no modo snapshot');
      const data = snapshot(lockPath);
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
      console.log(
        `Snapshot produtivo gravado: ${outPath} (${data.counts.production} entradas, ${data.counts.peerResolved} peers resolvidos, ${data.counts.optional} opcionais).`,
      );
      return 0;
    }

    if (mode === 'compare') {
      if (!options.before || !options.after) throw new Error('--before e --after são obrigatórios no modo compare');
      return compare(options.before, options.after);
    }

    usage();
    return 1;
  } catch (error) {
    console.error(`Erro: ${error.message}`);
    return 1;
  }
}

process.exitCode = main();
