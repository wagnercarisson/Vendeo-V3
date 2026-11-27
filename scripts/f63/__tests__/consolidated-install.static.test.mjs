import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations');
const CONSOLIDATED_RE = /^\d{14}_offer_catalog_consolidated_install\.sql$/;
const CONSOLIDATED_FILES = readdirSync(MIGRATIONS_DIR).filter((name) => CONSOLIDATED_RE.test(name));

test('existe exatamente uma migration consolidada com timestamp de 14 dígitos', () => {
  assert.equal(CONSOLIDATED_FILES.length, 1, `esperada 1 migration consolidada; encontradas ${CONSOLIDATED_FILES.length}`);
  const file = CONSOLIDATED_FILES[0];
  assert.match(file, CONSOLIDATED_RE);
  assert.match(file.slice(0, 14), /^\d{14}$/);
});

const consolidatedFile = CONSOLIDATED_FILES[0];
const sql = readFileSync(path.join(MIGRATIONS_DIR, consolidatedFile), 'utf8');
const withoutLineComments = sql.replace(/--[^\n]*/g, '');

test('precondições fail-closed cobrem todos os objetos da F63 e o singleton', () => {
  assert.ok(sql.includes('F63_CONSOLIDATED_'), 'prefixo de mensagem');
  assert.ok(sql.includes("to_regclass('public.trial_offer_versions')"), 'tabela');
  assert.ok(sql.includes("column_name = 'current_version_id'"), 'coluna');
  assert.ok(sql.includes('fk_trial_offer_settings_current_version'), 'FK');
  for (const signature of [
    'public.trial_offer_calendar_reaches_total(text,integer,integer,integer)',
    'public.trial_offer_versions_guard()',
    'public.trial_offer_versions_guard_delete()',
    'public.trial_offer_settings_guard_current_version()',
    'public.trial_offer_conditions(uuid)',
    'public.trial_offer_public_offer()',
    'public.trial_offer_release_schedule(uuid,timestamp with time zone)',
  ]) {
    assert.ok(sql.includes(`to_regprocedure('${signature}')`), `precondição ausente: ${signature}`);
  }
  for (const trigger of [
    'trg_trial_offer_versions_guard',
    'trg_trial_offer_versions_guard_delete',
    'trg_trial_offer_settings_guard_current_version',
  ]) {
    assert.ok(sql.includes(trigger), `trigger ausente: ${trigger}`);
  }
  assert.ok(sql.includes("offer_key = 'trial_28d_v1'"), 'singleton');
  assert.ok(sql.includes('F63_CONSOLIDATED_PRECONDITION_FAILED'), 'abort fail-closed');
});

test('guard final e comentário final de D estão presentes', () => {
  assert.ok(sql.includes('trial_offer_publisher_requires_publication'), 'rascunho sem publisher');
  assert.ok(sql.includes('NULL -> UUID'), 'primeira publicação aceita publisher');
  assert.ok(sql.includes('a primeira publicação aceita NULL ou UUID'), 'comentário da coluna published_by');
  assert.ok(sql.includes('inclusive por UPDATE direto ou ação referencial'), 'transição UUID -> NULL por UPDATE direto');
  assert.ok(sql.includes('não distingue a origem referencial'), 'comentário final de D');
  assert.ok(!sql.includes('CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()'), 'não usar replace do guard');
});

test('as três leituras são criadas antes do primeiro INSERT da v1', () => {
  const boundary = sql.indexOf('INSERT INTO public.trial_offer_versions');
  assert.notEqual(boundary, -1, 'INSERT da v1 ausente');
  for (const name of ['trial_offer_conditions', 'trial_offer_public_offer', 'trial_offer_release_schedule']) {
    const position = sql.search(new RegExp(`CREATE FUNCTION public\\.${name}\\s*\\(`));
    assert.notEqual(position, -1, `função ausente: ${name}`);
    assert.ok(position < boundary, `${name} deve vir antes do INSERT da v1`);
  }
});

test('SQL de produção não contém limpeza, DROP destrutivo ou CASCADE executável', () => {
  for (const forbidden of [
    'DELETE FROM supabase_migrations',
    'DROP TABLE',
    'DROP COLUMN',
    'TRUNCATE',
    'CASCADE',
  ]) {
    assert.equal(
      withoutLineComments.toUpperCase().includes(forbidden.toUpperCase()),
      false,
      `comando proibido encontrado: ${forbidden}`,
    );
  }
});

test('bloco REVERT existe e está integralmente comentado', () => {
  const revertIndex = sql.lastIndexOf('-- REVERT');
  assert.notEqual(revertIndex, -1, 'bloco REVERT ausente');
  const tail = sql.slice(revertIndex);
  const live = tail.replace(/--[^\n]*/g, '').trim();
  assert.equal(live, '', 'REVERT contém comandos executáveis');
});

test('comentários do estado final da 2A estão presentes', () => {
  for (const marker of [
    'COMMENT ON FUNCTION public.trial_offer_versions_guard_delete()',
    'COMMENT ON FUNCTION public.trial_offer_settings_guard_current_version()',
    'COMMENT ON FUNCTION public.trial_offer_conditions(UUID)',
    'COMMENT ON FUNCTION public.trial_offer_public_offer()',
    'COMMENT ON FUNCTION public.trial_offer_release_schedule(UUID, TIMESTAMPTZ)',
    'COMMENT ON COLUMN public.trial_offer_settings.current_version_id',
  ]) {
    assert.ok(sql.includes(marker), `comentário ausente: ${marker}`);
  }
});

test('checagem pós-arquivamento é condicional ao manifesto histórico', () => {
  const manifest = path.join(ROOT, 'supabase/migration-archive/f63-2a/manifest.json');
  if (!existsSync(manifest)) return;
  const files = readdirSync(MIGRATIONS_DIR);
  for (const legacy of [
    '20261126223854_offer_catalog_versions.sql',
    '20261126230735_offer_catalog_seed_v1.sql',
    '20261126231022_offer_catalog_published_by_fix.sql',
    '20261127004704_f63_trial_offer_versions_guard_comment.sql',
  ]) {
    assert.equal(files.includes(legacy), false, `arquivo histórico ainda em migrations: ${legacy}`);
  }
  const f63 = files.filter((name) => name.includes('offer_catalog'));
  assert.deepEqual(f63, [CONSOLIDATED_FILES[0]], 'deve existir exatamente uma migration F63 consolidada');
});
