import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STAGES,
  LEDGER_DELTA_BY_STAGE,
  expectedEffects,
  evaluateStage,
  buildSettingsComparison,
  buildSchemaComparison,
} from '../preservation-report.mjs';
import {
  classifyFailure,
  isAllowedF63Signature,
  parseArgs,
  validateArgs,
  verifyPostRemoval,
  buildInspectionFailure,
} from '../reconcile-f63-homolog.mjs';

const settings = {
  id: 'settings-1',
  offer_key: 'trial_28d_v1',
  enabled: true,
  launch_at: '2026-10-28T21:22:16.361965+00:00',
  individual_launch_at: null,
  updated_by: 'user-1',
  updated_at: '2026-10-28T21:22:16.361965+00:00',
  created_at: '2026-10-26T20:48:15.88138+00:00',
};
const baseline = {
  ledger: { count: 158 },
  preserved: Object.fromEntries(
    ['trial_offer_enrollments', 'credit_balances', 'credit_transactions', 'freemium_entitlements']
      .map((table) => [table, { count: 1, row_checksum_md5: `md5-${table}` }]),
  ),
  settings_guard: settings,
  schema_guards: {
    functions: Object.fromEntries(
      [
        'public.start_trial_offer_enrollment(uuid,timestamptz)',
        'public.grant_trial_offer_installment(uuid,integer,timestamptz)',
        'public.process_trial_offer_installments(timestamptz)',
        'public.trial_offer_eligibility(uuid,timestamptz)',
        'public.admin_set_trial_offer_enabled(boolean,uuid,text,uuid)',
      ].map((signature) => [signature, `hash-${signature}`]),
    ),
    trial_offer_enrollments_columns: ['id', 'store_id'],
    trial_offer_settings_columns: Object.keys(settings),
  },
};
const noFixtures = { published: [], drafts: [], referenced_by_current: [] };
const preInstallVersions = {
  table_present: false,
  total: 0,
  draft_count: 0,
  current_version_id: null,
  current_version_label: null,
  current_version_id_nullable: true,
  rows: [],
};
const v1Row = { version_label: 'v1', published_at: '2026-01-01T00:00:00Z', id: 'v1' };
const postInstallVersions = {
  table_present: true,
  total: 1,
  draft_count: 0,
  current_version_id: 'v1',
  current_version_label: 'v1',
  current_version_id_nullable: false,
  rows: [v1Row],
};
const fixtureRow = { version_label: 'f63test-calendar-1', published_at: '2026-01-01T00:00:00Z', id: 'fixture' };
const postTestsVersions = {
  ...postInstallVersions,
  total: 2,
  rows: [v1Row, fixtureRow],
};

test('stages e deltas não carregam post-d', () => {
  assert.deepEqual(
    [...STAGES].sort(),
    ['post-a', 'post-b', 'post-c', 'post-install', 'post-tests', 'post-tests-consolidated', 'pre-install'],
  );
  assert.equal('post-d' in LEDGER_DELTA_BY_STAGE, false);
  assert.equal(LEDGER_DELTA_BY_STAGE['pre-install'], 0);
  assert.equal(LEDGER_DELTA_BY_STAGE['post-install'], 1);
  assert.equal(LEDGER_DELTA_BY_STAGE['post-tests-consolidated'], 1);
  assert.equal(expectedEffects('pre-install').length > 0, true);
});

test('pre-install compara settings e schema sem current_version_id', () => {
  const settingsComparison = buildSettingsComparison(baseline, settings, preInstallVersions, 'pre-install');
  assert.equal(settingsComparison.settingsEqual, true);
  assert.equal(settingsComparison.currentVersionEqual, true);
  const schemaComparison = buildSchemaComparison(baseline, {
    functions: baseline.schema_guards.functions,
    trial_offer_enrollments_columns: baseline.schema_guards.trial_offer_enrollments_columns,
    trial_offer_settings_columns: baseline.schema_guards.trial_offer_settings_columns,
  }, 'pre-install');
  assert.equal(schemaComparison.functionsMd5Match, true);
  assert.equal(schemaComparison.enrollmentsEqual, true);
  assert.equal(schemaComparison.settingsColumnsExpected, true);
  assert.deepEqual(schemaComparison.schemaGuards.trial_offer_settings_columns.added, []);
});

test('post-install e post-tests-consolidated esperam current_version_id', () => {
  const postSettings = buildSettingsComparison(baseline, settings, postInstallVersions, 'post-install');
  assert.equal(postSettings.settingsEqual, true);
  assert.equal(postSettings.currentVersionEqual, true);
  const schemaComparison = buildSchemaComparison(baseline, {
    functions: baseline.schema_guards.functions,
    trial_offer_enrollments_columns: baseline.schema_guards.trial_offer_enrollments_columns,
    trial_offer_settings_columns: [...baseline.schema_guards.trial_offer_settings_columns, 'current_version_id'],
  }, 'post-install');
  assert.equal(schemaComparison.settingsColumnsExpected, true);
  assert.deepEqual(schemaComparison.schemaGuards.trial_offer_settings_columns.added, ['current_version_id']);
});

test('evaluateStage cobre pre-install, post-install e post-tests-consolidated', () => {
  assert.deepEqual(
    evaluateStage('pre-install', { count: 158 }, baseline, preInstallVersions, noFixtures),
    { ledger_delta_ok: true, versions_ok: true, test_rows_inert: true },
  );
  assert.deepEqual(
    evaluateStage('post-install', { count: 159 }, baseline, postInstallVersions, noFixtures),
    { ledger_delta_ok: true, versions_ok: true, test_rows_inert: true },
  );
  assert.deepEqual(
    evaluateStage('post-tests-consolidated', { count: 159 }, baseline, postTestsVersions, {
      published: ['f63test-calendar-1'],
      drafts: [],
      referenced_by_current: [],
    }),
    { ledger_delta_ok: true, versions_ok: true, test_rows_inert: true },
  );
});

test('evaluateStage falha quando o delta ou os labels estão errados', () => {
  assert.equal(evaluateStage('post-install', { count: 158 }, baseline, postInstallVersions, noFixtures).ledger_delta_ok, false);
  assert.equal(evaluateStage('pre-install', { count: 158 }, baseline, postInstallVersions, noFixtures).versions_ok, false);
  assert.equal(evaluateStage('post-tests-consolidated', { count: 159 }, baseline, postTestsVersions, {
    published: ['f63test-calendar-1'],
    drafts: ['f63test-draft'],
    referenced_by_current: [],
  }).test_rows_inert, false);
});

test('classifyFailure distingue rollback, pós-commit e resultado desconhecido', () => {
  assert.equal(classifyFailure({ rollbackConfirmed: true }).class, 'sql_error_rollback_confirmed');
  assert.equal(classifyFailure({ commitConfirmed: true }).class, 'post_commit_verification_failed');
  assert.equal(classifyFailure({}).class, 'unknown_commit_outcome');
});

test('assinaturas externas exigem match exato, não prefixo', () => {
  assert.equal(isAllowedF63Signature('public.trial_offer_versions_guard()'), true);
  assert.equal(isAllowedF63Signature('public.trial_offer_release_schedule(uuid, timestamp with time zone)'), true);
  assert.equal(isAllowedF63Signature('public.trial_offer_versions_guard_extra()'), false);
  assert.equal(isAllowedF63Signature('outro_schema.trial_offer_versions_guard()'), false);
});

test('falha de leitura pós-execução fica unknown sem presumir estado', async () => {
  await assert.rejects(
    verifyPostRemoval(
      '.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-baseline.json',
      { readLedgerFingerprint: async () => { throw new Error('read failure'); } },
    ),
    /read failure/,
  );
  const evidence = buildInspectionFailure({
    exitCode: 1,
    error: new Error('read failure'),
    before: { versions: { labels_ok: true } },
  });
  assert.equal(evidence.failure_class, 'unknown_commit_outcome');
  assert.equal(evidence.state_observed, null);
  assert.equal(evidence.commit_confirmed, null);
  assert.equal(evidence.blocked, true);
});

test('R0 exige baseline, evidence e log; flags de alvo são rejeitadas', () => {
  assert.throws(() => validateArgs({ r0: true, evidence: 'e', log: 'l' }), /baseline/);
  assert.throws(() => validateArgs({ dryRun: true }), /baseline/);
  assert.throws(() => validateArgs({ execute: true, baseline: 'b' }), /evidence|log/);
  assert.throws(() => parseArgs(['--url', 'http://x']), /desconhecido/);
  assert.doesNotThrow(() => validateArgs({ r0: true, baseline: 'b', evidence: 'e', log: 'l' }));
  assert.doesNotThrow(() => validateArgs({ dryRun: true, baseline: 'b' }));
});
