#!/usr/bin/env node
/**
 * F63.1 — relatório de preservação (somente leitura).
 *
 * Estágios:
 *   post-a, post-b, post-c, post-tests   — evidências históricas executadas.
 *   pre-install                          — base anterior à F63, após R1.
 *   post-install                         — instalação consolidada (ledger 159).
 *   post-tests-consolidated              — suíte F63 após a instalação consolidada.
 *
 * Não carrega `post-d`: D nunca foi aplicada e não é stage do harness.
 * Este módulo é somente leitura: docker inspect/port e SELECTs via psql.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  PRESERVED_TABLES,
  SCHEMA_FUNCTION_SIGNATURES,
  assertHomologIdentity,
  readLedgerFingerprint,
  readPreservedSnapshot,
  readSchemaGuards,
  readSettingsGuard,
  readVersionState,
} from './homolog-identity.mjs';

export const STAGES = [
  'post-a',
  'post-b',
  'post-c',
  'post-tests',
  'pre-install',
  'post-install',
  'post-tests-consolidated',
];
export const LEDGER_DELTA_BY_STAGE = {
  'post-a': 1,
  'post-b': 2,
  'post-c': 3,
  'post-tests': 3,
  'pre-install': 0,
  'post-install': 1,
  'post-tests-consolidated': 1,
};
const TEST_FIXTURE_PREFIX = 'f63test-';
const CONSOLIDATED_RE = /^\d{14}_offer_catalog_consolidated_install\.sql$/;
const MIGRATION_FILES = [
  {
    label: 'A',
    legacyFile: 'supabase/migrations/20261126223854_offer_catalog_versions.sql',
    archivedFile: 'supabase/migration-archive/f63-2a/20261126223854_offer_catalog_versions.sql',
    expectedSha256: 'ed652a26fc9294cdc239a842c2aebb00ccc1a182ff39e9dae13def947f8329bc',
  },
  {
    label: 'B',
    legacyFile: 'supabase/migrations/20261126230735_offer_catalog_seed_v1.sql',
    archivedFile: 'supabase/migration-archive/f63-2a/20261126230735_offer_catalog_seed_v1.sql',
    expectedSha256: 'e511295e7b7419431f05b9a112258afd3c3651de23ecd85d384ee9d26115c4b7',
  },
  {
    label: 'C',
    legacyFile: 'supabase/migrations/20261126231022_offer_catalog_published_by_fix.sql',
    archivedFile: 'supabase/migration-archive/f63-2a/20261126231022_offer_catalog_published_by_fix.sql',
    expectedSha256: '817cbd8a946ac3ee4f1d3e8080cdba175866d9be44bdde6b83f03eb1cd1d549c',
  },
];

function parseArgs(argv) {
  const args = {
    baseline: null, stage: null, out: null, mdOut: null, help: false,
    consolidatedVersion: null, consolidatedSha256: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--baseline') { args.baseline = argv[i + 1]; i += 1; }
    else if (current === '--stage') { args.stage = argv[i + 1]; i += 1; }
    else if (current === '--out') { args.out = argv[i + 1]; i += 1; }
    else if (current === '--md-out') { args.mdOut = argv[i + 1]; i += 1; }
    else if (current === '--consolidated-version') { args.consolidatedVersion = argv[i + 1]; i += 1; }
    else if (current === '--consolidated-sha256') { args.consolidatedSha256 = argv[i + 1]; i += 1; }
    else if (current === '--help' || current === '-h') { args.help = true; }
    else throw new Error(`argumento desconhecido: ${current}`);
  }
  return args;
}

function normalize(value) {
  return JSON.stringify(value === undefined ? null : value);
}

export function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function readBaseline(file) {
  const abs = path.resolve(process.cwd(), file);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (data.read_only !== true) throw new Error('baseline is not marked read_only');
  if (!data.preserved || Object.keys(data.preserved).length !== PRESERVED_TABLES.length) {
    throw new Error('baseline is missing the preserved snapshot');
  }
  if (!data.ledger || typeof data.ledger.count !== 'number') {
    throw new Error('baseline is missing the ledger fingerprint');
  }
  return data;
}

export function expectedEffects(stage) {
  if (stage === 'pre-install') {
    return [
      'objects: F63 objects absent after reconciliation',
      'settings: current_version_id absent',
      'ledger: 158 rows, delta 0 against the 63-01 baseline',
    ];
  }
  if (stage === 'post-install') {
    return [
      'settings: current_version_id assigned to v1 and NOT NULL',
      'versions: exactly one published/current v1 from the consolidated install',
      'ledger: delta +1 against the 63-01 baseline',
    ];
  }
  if (stage === 'post-tests-consolidated') {
    return [
      'settings: current_version_id assigned to v1 and NOT NULL',
      'versions: v1 published/current plus inert f63test-% fixtures',
      'ledger: delta +1 against the 63-01 baseline',
    ];
  }
  const effects = [
    'settings: current_version_id column added (nullable, no value assigned)',
    'ledger: +1 row from the structure migration',
  ];
  if (stage === 'post-b' || stage === 'post-c' || stage === 'post-tests') {
    effects.push('settings: current_version_id assigned to the published v1 and set NOT NULL');
    effects.push('versions: seed v1 published and current');
    effects.push(stage === 'post-b'
      ? 'ledger: +2 rows from the structure and seed migrations'
      : 'ledger: +3 rows from the structure, seed and publisher-fix migrations');
  }
  if (stage === 'post-c') {
    effects.push('versions: publisher guard corrected (published_by accepted only at first publication)');
  }
  if (stage === 'post-tests') {
    effects.push('versions: f63test-% published rows are inert test fixtures');
  }
  return effects;
}

function buildPreservedComparison(baseline, current) {
  const preserved = {};
  let allEqual = true;
  for (const { table } of PRESERVED_TABLES) {
    const baseEntry = baseline.preserved[table] ?? {};
    const currentEntry = current[table] ?? {};
    const equal = baseEntry.count === currentEntry.count
      && baseEntry.row_checksum_md5 === currentEntry.row_checksum_md5;
    if (!equal) allEqual = false;
    preserved[table] = {
      count: currentEntry.count,
      row_checksum_md5: currentEntry.row_checksum_md5,
      sha256: currentEntry.sha256,
      equal,
      baseline_count: baseEntry.count,
      baseline_row_checksum_md5: baseEntry.row_checksum_md5,
    };
  }
  return { preserved, allEqual };
}

export function buildSettingsComparison(baseline, current, versions, stage) {
  let equal = true;
  const settings = {};
  for (const column of Object.keys(baseline.settings_guard)) {
    settings[column] = current[column];
    if (normalize(baseline.settings_guard[column]) !== normalize(current[column])) {
      equal = false;
    }
  }

  const preInstall = stage === 'pre-install';
  const postA = stage === 'post-a';
  const expectedLabel = preInstall || postA ? null : 'v1';
  const currentVersionEqual = preInstall
    ? versions.table_present === false
      && versions.current_version_id === null
      && versions.current_version_id_nullable === true
    : postA
      ? versions.current_version_id === null && versions.current_version_id_nullable === true
      : versions.current_version_id !== null
        && versions.current_version_label === expectedLabel
        && versions.current_version_id_nullable === false;

  return {
    settings: {
      ...settings,
      equal,
      current_version_id: {
        value: versions.current_version_id,
        expected_version_label: expectedLabel,
        equal: currentVersionEqual,
      },
    },
    settingsEqual: equal,
    currentVersionEqual,
  };
}

export function buildSchemaComparison(baseline, current, stage) {
  const baselineFunctions = baseline.schema_guards?.functions ?? {};
  const currentFunctions = current.functions ?? {};
  const functionsMd5Match = Object.keys(baselineFunctions).length === SCHEMA_FUNCTION_SIGNATURES.length
    && SCHEMA_FUNCTION_SIGNATURES.every((signature) => baselineFunctions[signature] === currentFunctions[signature]);

  const baselineEnrollments = baseline.schema_guards?.trial_offer_enrollments_columns ?? [];
  const currentEnrollments = current.trial_offer_enrollments_columns ?? [];
  const enrollmentsEqual = sameArray(baselineEnrollments, currentEnrollments);

  const baselineSettings = baseline.schema_guards?.trial_offer_settings_columns ?? [];
  const currentSettings = current.trial_offer_settings_columns ?? [];
  const added = currentSettings.filter((column) => !baselineSettings.includes(column));
  const removed = baselineSettings.filter((column) => !currentSettings.includes(column));
  const expectedAdded = stage === 'pre-install' ? [] : ['current_version_id'];
  const addedExpected = sameArray(added, expectedAdded);
  const removedExpected = removed.length === 0;
  const equalExpected = addedExpected && removedExpected;

  return {
    schemaGuards: {
      functions_md5_match: functionsMd5Match,
      trial_offer_enrollments_columns_equal: enrollmentsEqual,
      trial_offer_settings_columns: { added, removed, equal_expected: equalExpected },
    },
    functionsMd5Match,
    enrollmentsEqual,
    settingsColumnsExpected: equalExpected,
  };
}

function classifyTestRows(versions) {
  const fixtureRows = versions.rows.filter((row) => row.version_label.startsWith(TEST_FIXTURE_PREFIX));
  return {
    published: fixtureRows.filter((row) => row.published_at !== null).map((row) => row.version_label),
    drafts: fixtureRows.filter((row) => row.published_at === null).map((row) => row.version_label),
    referenced_by_current: fixtureRows.filter((row) => row.id === versions.current_version_id).map((row) => row.version_label),
  };
}

export function evaluateStage(stage, ledger, baseline, versions, testRows) {
  const delta = ledger.count - baseline.ledger.count;
  const expectedDelta = LEDGER_DELTA_BY_STAGE[stage];
  const v1Published = versions.rows.filter((row) => row.version_label === 'v1' && row.published_at !== null).length === 1;
  let versionsOk;
  if (stage === 'pre-install') {
    versionsOk = versions.table_present === false;
  } else if (stage === 'post-a') {
    versionsOk = versions.table_present === true && versions.total === 0;
  } else if (stage === 'post-install') {
    versionsOk = versions.table_present === true
      && versions.total === 1
      && v1Published
      && versions.current_version_label === 'v1';
  } else if (stage === 'post-tests-consolidated') {
    versionsOk = versions.table_present === true
      && v1Published
      && versions.draft_count === 0
      && testRows.drafts.length === 0
      && testRows.referenced_by_current.length === 0;
  } else {
    versionsOk = versions.table_present === true && v1Published;
  }
  const testRowsInert = stage === 'post-tests' || stage === 'post-tests-consolidated'
    ? testRows.drafts.length === 0 && testRows.referenced_by_current.length === 0
    : true;
  return { ledger_delta_ok: delta === expectedDelta, versions_ok: versionsOk, test_rows_inert: testRowsInert };
}

export function findConsolidatedMigration() {
  const files = fs.readdirSync(path.join(process.cwd(), 'supabase/migrations'))
    .filter((name) => CONSOLIDATED_RE.test(name));
  if (files.length !== 1) {
    throw new Error(`expected exactly one consolidated migration; found ${files.length}`);
  }
  const file = files[0];
  const version = file.slice(0, 14);
  const sha256 = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(process.cwd(), 'supabase/migrations', file)))
    .digest('hex');
  return { file: `supabase/migrations/${file}`, version, sha256 };
}

function renderMarkdown(report) {
  const preservedRows = PRESERVED_TABLES.map(({ table }) => {
    const entry = report.preserved[table];
    return `| ${table} | ${entry.count} | ${entry.baseline_count} | ${entry.equal ? 'sim' : 'não'} | \`${entry.row_checksum_md5}\` |`;
  }).join('\n');
  const checkRows = Object.entries(report.checks)
    .map(([name, value]) => `| ${name} | ${value ? 'ok' : 'falha'} |`)
    .join('\n');
  const migrationRows = Object.entries(report.migration_hashes)
    .map(([label, entry]) => `| ${label} | \`${entry.resolved_path}\` | \`${entry.resolved_from}\` | \`${entry.sha256 ?? 'ausente'}\` | ${entry.equal ? 'sim' : 'não'} |`)
    .join('\n');

  return `# F63.1 — Relatório de preservação (${report.stage})

**Fase:** ${report.phase}
**Estágio:** \`${report.stage}\`
**Capturado (UTC):** ${report.captured_at_utc}
**Modo:** somente leitura (\`read_only: true\`)

## Alvo

- Container: \`${report.target.container}\`
- Publicação: \`${report.target.published}\`
- Banco: \`${report.target.database}\`
- Versão do servidor: ${report.target.server_version}

## Ledger

| Campo | Valor |
|---|---|
| Contagem | ${report.ledger.count} |
| Maior versão | \`${report.ledger.max_version ?? 'NULL'}\` |
| SHA-256 | \`${report.ledger.sha256}\` |

## Tabelas preservadas

| Tabela | Contagem atual | Contagem baseline | Igual | MD5 atual |
|---|---|---|---|---|
${preservedRows}

## Vigência

- \`current_version_id\`: ${report.settings_guard.current_version_id.value ?? 'NULL'}
- Rótulo esperado: ${report.settings_guard.current_version_id.expected_version_label ?? 'NULL'}
- Igual ao esperado: ${report.settings_guard.current_version_id.equal}

## Guardas de schema

- Hashes das cinco funções iguais: ${report.schema_guards.functions_md5_match}
- Colunas de \`trial_offer_enrollments\` iguais: ${report.schema_guards.trial_offer_enrollments_columns_equal}
- Colunas de \`trial_offer_settings\` adicionadas: ${JSON.stringify(report.schema_guards.trial_offer_settings_columns.added)}
- Colunas de \`trial_offer_settings\` removidas: ${JSON.stringify(report.schema_guards.trial_offer_settings_columns.removed)}
- Adição esperada: ${report.schema_guards.trial_offer_settings_columns.equal_expected}

## Consolidado

- Arquivo: \`${report.consolidated.file}\`
- Versão: \`${report.consolidated.version}\`
- SHA-256: \`${report.consolidated.sha256}\`
- Pin fornecido: versão=\`${report.consolidated.pin_version ?? 'não fornecido'}\`, sha256=\`${report.consolidated.pin_sha256 ?? 'não fornecido'}\`
- Pin confere: ${report.consolidated.pin_ok}

## Hashes das migrations

| Migration | Arquivo resolvido | Origem | SHA-256 | Igual ao esperado |
|---|---|---|---|---|
${migrationRows}

## Fixtures de teste (\`${TEST_FIXTURE_PREFIX}\`)

- Publicadas (inertes): ${JSON.stringify(report.test_created_rows.published)}
- Rascunhos: ${JSON.stringify(report.test_created_rows.drafts)}
- Referenciadas pela vigência: ${JSON.stringify(report.test_created_rows.referenced_by_current)}

## Checks

| Check | Resultado |
|---|---|
${checkRows}
`;
}

function writeArtifact(file, content) {
  const abs = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function buildMigrationHashes() {
  const hashes = {};
  const manifestPresent = fs.existsSync(path.resolve(process.cwd(), 'supabase/migration-archive/f63-2a/manifest.json'));
  for (const { label, legacyFile, archivedFile, expectedSha256 } of MIGRATION_FILES) {
    const archivedExists = fs.existsSync(path.resolve(process.cwd(), archivedFile));
    const legacyExists = fs.existsSync(path.resolve(process.cwd(), legacyFile));
    const resolvedPath = manifestPresent ? archivedFile : (archivedExists ? archivedFile : legacyFile);
    const resolvedFrom = manifestPresent || archivedExists ? 'archive' : 'legacy';
    const present = manifestPresent
      ? archivedExists && !legacyExists
      : fs.existsSync(path.resolve(process.cwd(), resolvedPath));
    const sha256 = present
      ? crypto.createHash('sha256').update(fs.readFileSync(path.resolve(process.cwd(), resolvedPath))).digest('hex')
      : null;
    hashes[label] = {
      resolved_path: resolvedPath,
      resolved_from: resolvedFrom,
      present,
      legacy_present: legacyExists,
      sha256,
      expected_sha256: expectedSha256,
      equal: present && sha256 === expectedSha256,
    };
  }
  return hashes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/f63/preservation-report.mjs --baseline <json> --stage <post-a|post-b|post-c|post-tests|pre-install|post-install|post-tests-consolidated> [--consolidated-version <v>] [--consolidated-sha256 <sha>] [--out <json>] [--md-out <md>]');
    return 0;
  }
  if (!args.baseline) throw new Error('--baseline is required');
  if (!args.stage || !STAGES.includes(args.stage)) {
    throw new Error(`--stage must be one of: ${STAGES.join(', ')}`);
  }

  const baseline = readBaseline(args.baseline);
  const identity = await assertHomologIdentity();
  const ledger = await readLedgerFingerprint();
  const currentPreserved = await readPreservedSnapshot();
  const currentSchema = await readSchemaGuards();
  const currentSettings = await readSettingsGuard();
  const versions = await readVersionState();
  const consolidated = findConsolidatedMigration();
  const migrationHashes = buildMigrationHashes();
  const migrationHashesEqual = Object.values(migrationHashes).every((entry) => entry.equal);

  const preservedComparison = buildPreservedComparison(baseline, currentPreserved);
  const settingsComparison = buildSettingsComparison(baseline, currentSettings, versions, args.stage);
  const schemaComparison = buildSchemaComparison(baseline, currentSchema, args.stage);
  const testRows = classifyTestRows(versions);
  const stageChecks = evaluateStage(args.stage, ledger, baseline, versions, testRows);

  const pinVersion = args.consolidatedVersion ?? null;
  const pinSha = args.consolidatedSha256 ?? null;
  const pinOk = (!pinVersion || pinVersion === consolidated.version)
    && (!pinSha || pinSha === consolidated.sha256);

  const checks = {
    target_identity_ok: true,
    ledger_delta_ok: stageChecks.ledger_delta_ok,
    preserved_equal: preservedComparison.allEqual,
    settings_guard_equal: settingsComparison.settingsEqual,
    current_version_ok: settingsComparison.currentVersionEqual,
    schema_functions_equal: schemaComparison.functionsMd5Match,
    enrollments_columns_equal: schemaComparison.enrollmentsEqual,
    settings_columns_expected: schemaComparison.settingsColumnsExpected,
    versions_ok: stageChecks.versions_ok,
    test_rows_inert: stageChecks.test_rows_inert,
    migration_hashes_equal: migrationHashesEqual,
    consolidated_migration_present: fs.existsSync(path.resolve(process.cwd(), consolidated.file)),
    consolidated_pin_ok: pinOk,
  };

  const report = {
    phase: '63.1',
    stage: args.stage,
    captured_at_utc: new Date().toISOString(),
    read_only: true,
    target: {
      container: identity.container,
      running: identity.running,
      image: identity.image,
      published: identity.published,
      container_port: identity.containerPort,
      database: identity.database,
      server_version: identity.serverVersion,
      workdir: identity.workdir,
    },
    ledger: { count: ledger.count, max_version: ledger.maxVersion, sha256: ledger.sha256 },
    preserved: preservedComparison.preserved,
    settings_guard: settingsComparison.settings,
    schema_guards: schemaComparison.schemaGuards,
    consolidated: {
      ...consolidated,
      pin_version: pinVersion,
      pin_sha256: pinSha,
      pin_ok: pinOk,
    },
    migration_hashes: migrationHashes,
    expected_migration_effects: expectedEffects(args.stage),
    test_created_rows: testRows,
    checks,
  };

  if (args.out) {
    const written = writeArtifact(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`preservation json: ${written}`);
  }
  if (args.mdOut) {
    const written = writeArtifact(args.mdOut, renderMarkdown(report));
    console.log(`preservation markdown: ${written}`);
  }

  console.log(`stage=${report.stage} ledger=${report.ledger.count} (baseline ${baseline.ledger.count}) preserved_equal=${preservedComparison.allEqual} settings_equal=${settingsComparison.settingsEqual}`);
  const failures = Object.entries(checks).filter(([, value]) => value !== true);
  if (failures.length > 0) {
    console.error(`preservation checks failed: ${failures.map(([name]) => name).join(', ')}`);
    return 1;
  }
  console.log('preservation checks: OK');
  return 0;
}

const ENTRYPOINT = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ENTRYPOINT) {
  main()
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      console.error(`f63 preservation report: ${error.message}`);
      process.exitCode = 1;
    });
}
