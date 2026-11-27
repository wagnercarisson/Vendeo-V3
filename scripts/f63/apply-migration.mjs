#!/usr/bin/env node
/**
 * F63 — aplicador transacional de migration no homolog existente.
 *
 * Escopo:
 *   - Aplicar UM arquivo de migration em UMA transação (BEGIN ... COMMIT).
 *   - Inserir a linha do ledger `supabase_migrations.schema_migrations` na
 *     MESMA transação da migration (rollback integral em caso de falha).
 *   - Reutilizar `assertHomologIdentity()` / `readLedgerFingerprint()` do
 *     `homolog-identity.mjs`; nenhuma lógica de Docker é duplicada aqui.
 *   - Emitir evidência JSON pinada e log UTF-8 sem credenciais.
 *
 * Proibições explícitas (não implementadas de propósito):
 *   - `db reset`, `db push`, `supabase link`, qualquer banco remoto;
 *   - criação de banco, backup obrigatório ou reset de ambiente;
 *   - edição manual do ledger fora da transação da migration;
 *   - impressão de connection string, senha, JWT ou variável de ambiente.
 *
 * Uso:
 *   node scripts/f63/apply-migration.mjs --file <sql> --expected-version <14 dígitos> --stage <post-a|post-b|post-c> --dry-run
 *   node scripts/f63/apply-migration.mjs --file <sql> --expected-version <14 dígitos> --stage <post-a|post-b|post-c> \
 *     --evidence <json> --log <log>
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertHomologIdentity, readLedgerFingerprint } from './homolog-identity.mjs';

const LEDGER_TABLE = 'supabase_migrations.schema_migrations';
const DOCKER_TIMEOUT_MS = 300_000;
const VERSION_RE = /^\d{14}$/;
const NAME_RE = /^[a-z0-9_]+$/;
const STAGES = ['post-a', 'post-b', 'post-c'];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseArgs(argv) {
  const args = {
    file: null,
    expectedVersion: null,
    stage: null,
    dryRun: false,
    evidence: null,
    log: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--file') {
      args.file = argv[i + 1];
      i += 1;
    } else if (current === '--expected-version') {
      args.expectedVersion = argv[i + 1];
      i += 1;
    } else if (current === '--stage') {
      args.stage = argv[i + 1];
      i += 1;
    } else if (current === '--dry-run') {
      args.dryRun = true;
    } else if (current === '--evidence') {
      args.evidence = argv[i + 1];
      i += 1;
    } else if (current === '--log') {
      args.log = argv[i + 1];
      i += 1;
    } else if (current === '--help' || current === '-h') {
      args.help = true;
    } else {
      throw new Error(`argumento desconhecido: ${current}`);
    }
  }
  return args;
}

function printUsage() {
  console.log(
    'Uso: node scripts/f63/apply-migration.mjs --file <sql> --expected-version <14 dígitos> --stage <post-a|post-b|post-c> [--dry-run] [--evidence <json>] [--log <log>]',
  );
}

function deriveNames(file) {
  const base = path.basename(file);
  if (!base.endsWith('.sql')) {
    throw new Error('migration file must end with .sql');
  }
  const stem = base.slice(0, -'.sql'.length);
  if (stem.length < 16 || stem[14] !== '_') {
    throw new Error('migration file must be named <14 digits>_<name>.sql');
  }
  const version = stem.slice(0, 14);
  const name = stem.slice(15);
  if (!VERSION_RE.test(version)) {
    throw new Error('migration version must be 14 numeric digits (UTC timestamp)');
  }
  if (!NAME_RE.test(name)) {
    throw new Error('migration name must match ^[a-z0-9_]+$');
  }
  return { version, name };
}

function buildWrapper(migrationSql, version, name) {
  const trimmed = migrationSql.replace(/\r\n/g, '\n');
  return [
    '\\set VERBOSITY verbose',
    'BEGIN;',
    "SET LOCAL lock_timeout = '10s';",
    "SET LOCAL statement_timeout = '180s';",
    trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`,
    `INSERT INTO ${LEDGER_TABLE} (version, name) VALUES ('${version}', '${name}');`,
    'COMMIT;',
    '',
  ].join('\n');
}

function dockerCp(localFile, container, remoteFile) {
  execFileSync('docker', ['cp', localFile, `${container}:${remoteFile}`], {
    encoding: 'utf8',
    timeout: DOCKER_TIMEOUT_MS,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runPsql(container, remoteFile) {
  const startedAt = Date.now();
  try {
    const stdout = execFileSync(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-X',
        '-v',
        'ON_ERROR_STOP=1',
        '-q',
        '-f',
        remoteFile,
      ],
      {
        encoding: 'utf8',
        timeout: DOCKER_TIMEOUT_MS,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return { exitCode: 0, stdout, stderr: '', durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      exitCode: typeof error?.status === 'number' ? error.status : 1,
      stdout: String(error?.stdout ?? ''),
      stderr: String(error?.stderr ?? error?.message ?? ''),
      durationMs: Date.now() - startedAt,
    };
  }
}

function writeArtifact(file, content) {
  const abs = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function renderLog({ file, version, name, fileSha, wrapperSha, result, ledgerBefore, ledgerAfter, evidencePath, stage }) {
  const lines = [
    '# F63 — apply-migration log',
    `file: ${file}`,
    `version: ${version}`,
    `name: ${name}`,
    `file_sha256: ${fileSha}`,
    `wrapper_sha256: ${wrapperSha}`,
    `executed_at_utc: ${new Date().toISOString()}`,
    `stage: ${stage}`,
    `exit_code: ${result.exitCode}`,
    `duration_ms: ${result.durationMs}`,
    `ledger_before_count: ${ledgerBefore?.count ?? 'unknown'}`,
    `ledger_before_sha256: ${ledgerBefore?.sha256 ?? 'unknown'}`,
    `ledger_after_count: ${ledgerAfter?.count ?? 'unknown'}`,
    `ledger_after_sha256: ${ledgerAfter?.sha256 ?? 'unknown'}`,
    `evidence: ${evidencePath ?? '(não gravada)'}`,
    '',
  ];
  if (result.exitCode !== 0) {
    lines.push(
      'transaction: ABORTED — wrapper BEGIN/COMMIT com ON_ERROR_STOP=1;',
      'a conexão foi encerrada sem COMMIT, portanto nenhum DDL/DML parcial permaneceu.',
      'diagnóstico: corrigir APENAS o arquivo da migration, revalidar o dry-run e reaplicar.',
      '',
    );
  }
  lines.push('--- stdout ---', result.stdout ?? '', '--- stderr ---', result.stderr ?? '', '');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return 0;
  }
  if (!args.file) throw new Error('--file is required');
  if (!args.expectedVersion) throw new Error('--expected-version is required');
  if (args.stage !== null && !STAGES.includes(args.stage)) {
    throw new Error(`--stage must be one of: ${STAGES.join(', ')}`);
  }
  if (!args.dryRun && args.stage === null) {
    throw new Error('--stage is required for real apply (post-a|post-b|post-c)');
  }

  const absFile = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(absFile)) {
    throw new Error(`migration file not found: ${args.file}`);
  }
  const migrationSql = fs.readFileSync(absFile, 'utf8');
  const fileSha = sha256(migrationSql);
  const { version, name } = deriveNames(absFile);

  if (args.expectedVersion !== version) {
    throw new Error(`--expected-version ${args.expectedVersion} does not match file version ${version}`);
  }

  const identity = await assertHomologIdentity();
  const ledgerBefore = await readLedgerFingerprint();

  if (ledgerBefore.lastRows.some((row) => row.version === version)) {
    throw new Error(`version ${version} is already present in the ledger (last rows)`);
  }
  const ledgerContains = execFileSync(
    'docker',
    [
      'exec',
      identity.container,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-X',
      '-tAXq',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `select count(*) from ${LEDGER_TABLE} where version = '${version}';`,
    ],
    { encoding: 'utf8', timeout: DOCKER_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (ledgerContains !== '0') {
    throw new Error(`version ${version} is already present in the ledger`);
  }

  const wrapper = buildWrapper(migrationSql, version, name);
  const wrapperSha = sha256(wrapper);

  if (args.dryRun) {
    console.log('[dry-run] nenhuma execução: sem docker cp e sem psql -f');
    console.log(`[dry-run] container: ${identity.container}`);
    console.log(`[dry-run] published: ${identity.published}`);
    console.log(`[dry-run] database: ${identity.database}`);
    console.log(`[dry-run] server_version: ${identity.serverVersion}`);
    console.log(`[dry-run] file: ${args.file}`);
    console.log(`[dry-run] file_sha256: ${fileSha}`);
    console.log(`[dry-run] version: ${version}`);
    console.log(`[dry-run] name: ${name}`);
    console.log(`[dry-run] stage: ${args.stage ?? '(not provided; required for real apply)'}`);
    console.log(`[dry-run] version_absent_from_ledger: true`);
    console.log(`[dry-run] ledger_before: count=${ledgerBefore.count} sha256=${ledgerBefore.sha256}`);
    console.log(`[dry-run] wrapper_sha256: ${wrapperSha}`);
    console.log('[dry-run] wrapper: BEGIN; SET LOCAL lock_timeout/statement_timeout; <migration>; INSERT ledger; COMMIT;');
    console.log('[dry-run] nenhum comando remoto, nenhum reset/push/link, nenhuma credencial impressa');
    return 0;
  }

  // Reconfirma identidade imediatamente antes de montar/executar o wrapper.
  const confirmed = await assertHomologIdentity();
  const wrapperFile = path.join(os.tmpdir(), `f63-apply-${version}.sql`);
  fs.writeFileSync(wrapperFile, wrapper, 'utf8');
  const remoteFile = `/tmp/f63-apply-${version}.sql`;

  let result;
  try {
    dockerCp(wrapperFile, confirmed.container, remoteFile);
    result = runPsql(confirmed.container, remoteFile);
  } catch (error) {
    result = {
      exitCode: 1,
      stdout: '',
      stderr: String(error?.stderr ?? error?.message ?? ''),
      durationMs: 0,
    };
  }

  let ledgerAfter = null;
  try {
    ledgerAfter = await readLedgerFingerprint();
  } catch {
    ledgerAfter = null;
  }

  const evidence = {
    phase: '63',
    stage: args.stage,
    executed_at_utc: new Date().toISOString(),
    target: {
      container: confirmed.container,
      published: confirmed.published,
      database: confirmed.database,
      server_version: confirmed.serverVersion,
    },
    file: path.basename(absFile),
    file_sha256: fileSha,
    version,
    name,
    wrapper_sha256: wrapperSha,
    ledger_before: { count: ledgerBefore.count, sha256: ledgerBefore.sha256 },
    ledger_after: ledgerAfter
      ? { count: ledgerAfter.count, sha256: ledgerAfter.sha256 }
      : { count: null, sha256: null },
    exit_code: result.exitCode,
    duration_ms: result.durationMs,
  };

  const evidencePath = args.evidence ? writeArtifact(args.evidence, `${JSON.stringify(evidence, null, 2)}\n`) : null;
  const logContent = renderLog({
    file: path.basename(absFile),
    version,
    name,
    fileSha,
    wrapperSha,
    result,
    ledgerBefore,
    ledgerAfter,
    evidencePath,
    stage: evidence.stage,
  });
  if (args.log) writeArtifact(args.log, logContent);

  console.log(`container: ${confirmed.container}`);
  console.log(`version=${version} name=${name} exit_code=${result.exitCode} duration_ms=${result.durationMs}`);
  console.log(`ledger_before.count=${ledgerBefore.count} ledger_after.count=${ledgerAfter?.count ?? 'unknown'}`);
  if (result.exitCode !== 0) {
    console.error('apply FAILED — transação abortada; nenhum DDL parcial deve permanecer.');
    console.error(String(result.stderr ?? '').split('\n').slice(0, 20).join('\n'));
  }
  return result.exitCode;
}

const ENTRYPOINT = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === ENTRYPOINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`f63 apply-migration: ${error.message}`);
      process.exitCode = 1;
    });
}
