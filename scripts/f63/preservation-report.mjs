#!/usr/bin/env node
/**
 * F63 — relatório de preservação (somente leitura).
 *
 * Compara o estado atual do homolog contra o baseline do 63-01 e classifica
 * os efeitos esperados das migrations e os dados criados pelos testes.
 *
 * Estágios:
 *   post-a    — depois da migration de estrutura (versões/tabela/coluna).
 *   post-b    — depois do seed da versão v1 publicada e vigente.
 *   post-c    — depois da correção do guard de publicação (published_by).
 *   post-tests — depois da suíte F63; fixtures `f63test-` publicadas são inertes.
 *
 * Este módulo é somente leitura: usa `docker inspect`, `docker port` e
 * consultas de leitura via `docker exec psql`. Não há DDL nem DML.
 *
 * Uso:
 *   node scripts/f63/preservation-report.mjs --baseline <json> --stage post-a|post-b|post-c|post-tests [--out <json>] [--md-out <md>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRESERVED_TABLES,
  SETTINGS_COLUMNS,
  SCHEMA_FUNCTION_SIGNATURES,
  assertHomologIdentity,
  readLedgerFingerprint,
  readPreservedSnapshot,
  readSchemaGuards,
  readSettingsGuard,
  readVersionState,
} from './homolog-identity.mjs';

const STAGES = ['post-a', 'post-b', 'post-c', 'post-tests'];
const TEST_FIXTURE_PREFIX = 'f63test-';
const LEDGER_DELTA_BY_STAGE = { 'post-a': 1, 'post-b': 2, 'post-c': 3, 'post-tests': 3 };

function parseArgs(argv) {
  const args = { baseline: null, stage: null, out: null, mdOut: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--baseline') {
      args.baseline = argv[i + 1];
      i += 1;
    } else if (current === '--stage') {
      args.stage = argv[i + 1];
      i += 1;
    } else if (current === '--out') {
      args.out = argv[i + 1];
      i += 1;
    } else if (current === '--md-out') {
      args.mdOut = argv[i + 1];
      i += 1;
    } else if (current === '--help' || current === '-h') {
      args.help = true;
    } else {
      throw new Error(`argumento desconhecido: ${current}`);
    }
  }
  return args;
}

function normalize(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

function expectedEffects(stage) {
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
    const equal =
      baseEntry.count === currentEntry.count &&
      baseEntry.row_checksum_md5 === currentEntry.row_checksum_md5;
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

function buildSettingsComparison(baseline, current, versions, stage) {
  let equal = true;
  const settings = {};
  for (const column of SETTINGS_COLUMNS) {
    settings[column] = current[column];
    if (normalize(baseline.settings_guard?.[column]) !== normalize(current[column])) {
      equal = false;
    }
  }

  const expectedLabel = stage === 'post-a' ? null : 'v1';  const currentVersionEqual =
    stage === 'post-a'
      ? versions.current_version_id === null && versions.current_version_id_nullable === true
      : versions.current_version_id !== null &&
        versions.current_version_label === expectedLabel &&
        versions.current_version_id_nullable === false;

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

function buildSchemaComparison(baseline, current) {
  const baselineFunctions = baseline.schema_guards?.functions ?? {};
  const currentFunctions = current.functions ?? {};
  const functionsMd5Match =
    Object.keys(baselineFunctions).length === SCHEMA_FUNCTION_SIGNATURES.length &&
    SCHEMA_FUNCTION_SIGNATURES.every((signature) => baselineFunctions[signature] === currentFunctions[signature]);

  const baselineEnrollments = baseline.schema_guards?.trial_offer_enrollments_columns ?? [];
  const currentEnrollments = current.trial_offer_enrollments_columns ?? [];
  const enrollmentsEqual = sameArray(baselineEnrollments, currentEnrollments);

  const baselineSettings = baseline.schema_guards?.trial_offer_settings_columns ?? [];
  const currentSettings = current.trial_offer_settings_columns ?? [];
  const added = currentSettings.filter((column) => !baselineSettings.includes(column));
  const removed = baselineSettings.filter((column) => !currentSettings.includes(column));
  const addedExpected = sameArray(added, ['current_version_id']);
  const removedExpected = removed.length === 0;
  const equalExpected = addedExpected && removedExpected;

  return {
    schemaGuards: {
      functions_md5_match: functionsMd5Match,
      trial_offer_enrollments_columns_equal: enrollmentsEqual,
      trial_offer_settings_columns: {
        added,
        removed,
        equal_expected: equalExpected,
      },
    },
    functionsMd5Match,
    enrollmentsEqual,
    settingsColumnsExpected: equalExpected,
  };
}

function classifyTestRows(versions) {
  const fixtureRows = versions.rows.filter((row) => row.version_label.startsWith(TEST_FIXTURE_PREFIX));
  return {
    published: fixtureRows
      .filter((row) => row.published_at !== null)
      .map((row) => row.version_label),
    drafts: fixtureRows
      .filter((row) => row.published_at === null)
      .map((row) => row.version_label),
    referenced_by_current: fixtureRows
      .filter((row) => row.id === versions.current_version_id)
      .map((row) => row.version_label),
  };
}

function evaluateStage(stage, ledger, baseline, versions, testRows) {
  const delta = ledger.count - baseline.ledger.count;
  const expectedDelta = LEDGER_DELTA_BY_STAGE[stage];

  const versionsOk =
    versions.table_present &&
    (stage === 'post-a'
      ? versions.total === 0
      : versions.rows.filter((row) => row.version_label === 'v1' && row.published_at !== null).length === 1);

  const testRowsInert =
    stage === 'post-tests'
      ? testRows.drafts.length === 0 && testRows.referenced_by_current.length === 0
      : true;

  return {
    ledger_delta_ok: delta === expectedDelta,
    versions_ok: versionsOk,
    test_rows_inert: testRowsInert,
  };
}

function renderMarkdown(report) {
  const preservedRows = PRESERVED_TABLES.map(({ table }) => {
    const entry = report.preserved[table];
    return `| ${table} | ${entry.count} | ${entry.baseline_count} | ${entry.equal ? 'sim' : 'não'} | \`${entry.row_checksum_md5}\` |`;
  }).join('\n');
  const checkRows = Object.entries(report.checks)
    .map(([name, value]) => `| ${name} | ${value ? 'ok' : 'falha'} |`)
    .join('\n');

  return `# F63 — Relatório de preservação (${report.stage})

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Uso: node scripts/f63/preservation-report.mjs --baseline <json> --stage post-a|post-b|post-c|post-tests [--out <json>] [--md-out <md>]');
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

  const preservedComparison = buildPreservedComparison(baseline, currentPreserved);
  const settingsComparison = buildSettingsComparison(baseline, currentSettings, versions, args.stage);
  const schemaComparison = buildSchemaComparison(baseline, currentSchema);
  const testRows = classifyTestRows(versions);
  const stageChecks = evaluateStage(args.stage, ledger, baseline, versions, testRows);

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
  };

  const report = {
    phase: '63',
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
    ledger: {
      count: ledger.count,
      max_version: ledger.maxVersion,
      sha256: ledger.sha256,
    },
    preserved: preservedComparison.preserved,
    settings_guard: settingsComparison.settings,
    schema_guards: schemaComparison.schemaGuards,
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

  console.log(
    `stage=${report.stage} ledger=${report.ledger.count} (baseline ${baseline.ledger.count}) preserved_equal=${preservedComparison.allEqual} settings_equal=${settingsComparison.settingsEqual}`,
  );
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
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`f63 preservation report: ${error.message}`);
      process.exitCode = 1;
    });
}
