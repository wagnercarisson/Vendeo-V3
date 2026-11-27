import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * F63 / 63-05 — provas reais do catálogo versionado no HOMOLOG EXISTENTE.
 *
 * Alvo único e permitido: container `supabase_db_vendeo-homolog`,
 * PostgreSQL `127.0.0.1:57782`, banco `postgres`.
 *
 * Regras:
 *  - Nenhum banco é criado, resetado ou apagado; nenhum `db push`/`link`.
 *  - Nenhum DDL de teste: proibido `ALTER ... DROP NOT NULL`, `DROP COLUMN`
 *    e `TRUNCATE`. Negativos usam savepoint e rollback.
 *  - Fixtures usam o prefixo `f63test-schema-` e rodam em transação com
 *    rollback. Nada de stores/users fora da transação.
 *  - Ledger é conferido por fingerprint `all_rows` (todas as linhas
 *    `version|name`, sem filtro). O F57.2 NÃO é executado nesta fase.
 */
const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) {
  throw new Error('TEST_DATABASE_URL obrigatório (homolog 127.0.0.1:57782/postgres)');
}

const BASELINE_PATH =
  '.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-baseline.json';

function parseTarget(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL inválida');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('TEST_DATABASE_URL deve usar postgresql://');
  }
  if (url.hostname !== '127.0.0.1' || url.port !== '57782') {
    throw new Error('Destino recusado: esperado 127.0.0.1:57782');
  }
  if (url.pathname !== '/postgres') {
    throw new Error('Destino recusado: banco deve ser postgres');
  }
  return url;
}

const target = parseTarget(rawUrl);
const expectedLedgerCount = Number(process.env.F63_EXPECTED_LEDGER_COUNT ?? '');
const expectedLedgerHash = (process.env.F63_EXPECTED_LEDGER_SHA256 ?? '').trim();

const pool = new Pool({ connectionString: target.toString(), ssl: false });
const runId = `f63test-schema-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Row = Record<string, unknown>;

const INSERT_VERSION_SQL = `insert into public.trial_offer_versions
  (id, offer_key, version_label, public_name, duration_days, max_total_credits,
   release_frequency, credits_per_release, published_at, published_by,
   publication_reason, created_by)
  values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
  returning id`;

type VersionOptions = {
  id?: string;
  offerKey?: string;
  versionLabel?: string;
  publicName?: string;
  durationDays?: number;
  maxTotalCredits?: number;
  releaseFrequency?: string;
  creditsPerRelease?: number | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  publicationReason?: string | null;
  createdBy?: string | null;
};

function versionValues(options: VersionOptions = {}): unknown[] {
  const merged = {
    id: crypto.randomUUID(),
    offerKey: 'trial_28d_v1',
    versionLabel: `${runId}-${crypto.randomUUID().slice(0, 8)}`,
    publicName: 'F63 TEST schema',
    durationDays: 28,
    maxTotalCredits: 20,
    releaseFrequency: 'weekly',
    creditsPerRelease: 5 as number | null,
    publishedAt: null as string | null,
    publishedBy: null as string | null,
    publicationReason: null as string | null,
    createdBy: null as string | null,
    ...options,
  };
  return [
    merged.id,
    merged.offerKey,
    merged.versionLabel,
    merged.publicName,
    merged.durationDays,
    merged.maxTotalCredits,
    merged.releaseFrequency,
    merged.creditsPerRelease,
    merged.publishedAt,
    merged.publishedBy,
    merged.publicationReason,
    merged.createdBy,
  ];
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query('begin');
    try {
      return await fn(client);
    } finally {
      await client.query('rollback').catch(() => undefined);
    }
  });
}

async function query<T = Row>(text: string, values: unknown[] = []): Promise<T[]> {
  return withClient(async (client) => (await client.query<T>(text, values)).rows);
}

async function scalarOn<T = unknown>(
  client: PoolClient,
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await client.query<Record<string, T>>(text, values);
  return Object.values(result.rows[0] ?? {})[0] as T;
}

async function expectSqlState(
  client: PoolClient,
  sql: string,
  values: unknown[],
  code: string,
): Promise<void> {
  await client.query('savepoint denied');
  try {
    await client.query(sql, values);
    throw new Error(`esperava SQLSTATE ${code}, mas a operação passou`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('esperava SQLSTATE')) throw error;
    expect((error as { code?: string }).code).toBe(code);
  } finally {
    await client.query('rollback to savepoint denied').catch(() => undefined);
  }
}

async function expectPgError(
  client: PoolClient,
  sql: string,
  values: unknown[],
  expected: { code?: string; message?: RegExp },
): Promise<void> {
  await client.query('savepoint expected_error');
  try {
    await client.query(sql, values);
    throw new Error('esperava erro do banco, mas a operação passou');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('esperava erro do banco')) throw error;
    const pgError = error as { code?: string; message?: string };
    if (expected.code) expect(pgError.code).toBe(expected.code);
    if (expected.message) expect(pgError.message ?? '').toMatch(expected.message);
  } finally {
    await client.query('rollback to savepoint expected_error').catch(() => undefined);
  }
}

async function insertVersion(client: PoolClient, options: VersionOptions = {}): Promise<string> {
  const result = await client.query<{ id: string }>(INSERT_VERSION_SQL, versionValues(options));
  return result.rows[0].id;
}

async function createUser(client: PoolClient, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1,'authenticated','authenticated',$2,now(),now())",
    [id, `${label}-${runId}-${id}@f63.test`],
  );
  return id;
}

function ledgerFingerprint(rows: Array<{ version: string; name: string | null }>): {
  count: number;
  sha256: string;
} {
  const payload = rows.map((row) => `${row.version}|${row.name ?? ''}`).join('\n');
  return {
    count: rows.length,
    sha256: createHash('sha256').update(payload, 'utf8').digest('hex'),
  };
}

async function readV1(): Promise<Row> {
  const rows = await query<Row>(
    `select id, offer_key, version_label, public_name, duration_days,
            max_total_credits, release_frequency, credits_per_release, published_at
       from public.trial_offer_versions
      where offer_key = 'trial_28d_v1' and version_label = 'v1'`,
  );
  if (rows.length !== 1) {
    throw new Error(`esperava exatamente uma v1, encontrei ${rows.length}`);
  }
  return rows[0];
}

beforeAll(async () => {
  if (!Number.isInteger(expectedLedgerCount) || expectedLedgerCount < 1) {
    throw new Error('F63_EXPECTED_LEDGER_COUNT ausente/inválido; derive do 63-03 post-c');
  }
  if (!/^[0-9a-f]{64}$/.test(expectedLedgerHash)) {
    throw new Error('F63_EXPECTED_LEDGER_SHA256 ausente/inválido');
  }

  const identity = await query<{ db: string; auth: boolean }>(
    "select current_database() as db, to_regclass('auth.users') is not null as auth",
  );
  if (identity[0]?.db !== 'postgres' || identity[0]?.auth !== true) {
    throw new Error('Alvo não é o homolog esperado (banco/auth divergentes)');
  }

  const ledger = await query<{ version: string; name: string | null }>(
    'select version, name from supabase_migrations.schema_migrations order by version',
  );
  const fingerprint = ledgerFingerprint(ledger);
  if (fingerprint.count !== expectedLedgerCount || fingerprint.sha256 !== expectedLedgerHash) {
    throw new Error('Fingerprint do ledger divergiu do esperado (all_rows)');
  }
});

afterAll(async () => {
  await pool.end();
});

describe('F63 schema — smoke de ledger, v1 e vigência', () => {
  it('1. fingerprint all_rows do ledger confere com o esperado', async () => {
    expect(expectedLedgerCount).toBeGreaterThanOrEqual(1);
    expect(expectedLedgerHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('2. existe exatamente uma v1 publicada para trial_28d_v1', async () => {
    const v1 = await readV1();
    expect(v1.offer_key).toBe('trial_28d_v1');
    expect(v1.version_label).toBe('v1');
    expect(v1.public_name).toBe('Teste gratuito de 28 dias');
    expect(Number(v1.duration_days)).toBe(28);
    expect(Number(v1.max_total_credits)).toBe(20);
    expect(v1.release_frequency).toBe('weekly');
    expect(Number(v1.credits_per_release)).toBe(5);
    expect(v1.published_at).not.toBeNull();
  });

  it('3. current_version_id aponta para a v1 publicada', async () => {
    const v1 = await readV1();
    const current = await query<{ current_version_id: string }>(
      "select current_version_id from public.trial_offer_settings where offer_key = 'trial_28d_v1'",
    );
    expect(current).toHaveLength(1);
    expect(current[0].current_version_id).toBe(v1.id);
  });
});

describe('F63 schema — colunas, constraints e triggers', () => {
  it('4. treze colunas com tipo, nullability e defaults esperados', async () => {
    const columns = await query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      ordinal_position: number;
    }>(
      `select column_name, data_type, is_nullable, column_default, ordinal_position
         from information_schema.columns
        where table_schema = 'public' and table_name = 'trial_offer_versions'
        order by ordinal_position`,
    );

    const expected = [
      ['id', 'uuid', 'NO', true],
      ['offer_key', 'text', 'NO', false],
      ['version_label', 'text', 'NO', false],
      ['public_name', 'text', 'NO', false],
      ['duration_days', 'integer', 'NO', false],
      ['max_total_credits', 'integer', 'NO', false],
      ['release_frequency', 'text', 'NO', false],
      ['credits_per_release', 'integer', 'YES', false],
      ['published_at', 'timestamp with time zone', 'YES', false],
      ['published_by', 'uuid', 'YES', false],
      ['publication_reason', 'text', 'YES', false],
      ['created_by', 'uuid', 'YES', false],
      ['created_at', 'timestamp with time zone', 'NO', true],
    ] as const;

    expect(columns).toHaveLength(expected.length);
    expected.forEach(([name, type, nullable, hasDefault], index) => {
      const column = columns[index];
      expect(column.column_name).toBe(name);
      expect(column.data_type).toBe(type);
      expect(column.is_nullable).toBe(nullable);
      if (hasDefault) expect(column.column_default).toBeTruthy();
      else expect(column.column_default).toBeNull();
    });
    expect(columns[0].column_default).toMatch(/gen_random_uuid/);
    expect(columns[12].column_default).toMatch(/now/);
  });

  it('5. constraints nomeadas, unicidades e FKs com ON DELETE correto', async () => {
    const constraints = await query<{
      conname: string;
      contype: string;
      confdeltype: string | null;
      definition: string;
    }>(
      `select conname, contype, confdeltype, pg_get_constraintdef(oid) as definition
         from pg_constraint
        where conrelid in ('public.trial_offer_versions'::regclass,
                           'public.trial_offer_settings'::regclass)`,
    );
    const byName = new Map(constraints.map((row) => [row.conname, row]));

    const checks = [
      ['chk_tov_duration_days', 'duration_days > 0'],
      ['chk_tov_max_total_credits', 'max_total_credits > 0'],
      ['chk_tov_release_frequency', 'release_frequency'],
      ['chk_tov_credits_per_release', 'credits_per_release'],
      ['chk_tov_version_label_not_blank', 'btrim'],
      ['chk_tov_public_name_not_blank', 'btrim'],
    ] as const;
    for (const [name, fragment] of checks) {
      const row = byName.get(name);
      expect(row, `constraint ausente: ${name}`).toBeTruthy();
      expect(row?.contype).toBe('c');
      expect(row?.definition).toContain(fragment);
    }

    expect(byName.get('uq_tov_offer_key_version_label')?.contype).toBe('u');
    expect(byName.get('uq_tov_offer_key_version_label')?.definition).toContain(
      'UNIQUE (offer_key, version_label)',
    );
    expect(byName.get('uq_tov_id_offer_key')?.contype).toBe('u');
    expect(byName.get('uq_tov_id_offer_key')?.definition).toContain('UNIQUE (id, offer_key)');
    expect(byName.get('trial_offer_versions_pkey')?.contype).toBe('p');

    const offerKeyFk = byName.get('fk_tov_offer_key');
    expect(offerKeyFk?.contype).toBe('f');
    expect(offerKeyFk?.confdeltype).toBe('r');
    expect(offerKeyFk?.definition).toContain('REFERENCES trial_offer_settings');

    for (const name of ['fk_tov_created_by', 'fk_tov_published_by']) {
      const row = byName.get(name);
      expect(row?.contype).toBe('f');
      expect(row?.confdeltype).toBe('n');
      expect(row?.definition).toContain('REFERENCES auth.users');
    }

    const currentFk = byName.get('fk_trial_offer_settings_current_version');
    expect(currentFk?.contype).toBe('f');
    expect(currentFk?.confdeltype).toBe('r');
    expect(currentFk?.definition).toContain('FOREIGN KEY (current_version_id, offer_key)');
    expect(currentFk?.definition).toContain('trial_offer_versions(id, offer_key)');
  });

  it('6. triggers BEFORE INSERT/UPDATE e BEFORE DELETE ligados às funções corretas', async () => {
    const triggers = await query<{ tgname: string; definition: string }>(
      `select tgname, pg_get_triggerdef(oid) as definition
         from pg_trigger
        where tgrelid in ('public.trial_offer_versions'::regclass,
                          'public.trial_offer_settings'::regclass)
          and not tgisinternal`,
    );
    const byName = new Map(triggers.map((row) => [row.tgname, row.definition]));

    const guard = byName.get('trg_trial_offer_versions_guard');
    expect(guard).toContain('BEFORE INSERT OR UPDATE ON public.trial_offer_versions');
    expect(guard).toContain('EXECUTE FUNCTION trial_offer_versions_guard()');

    const guardDelete = byName.get('trg_trial_offer_versions_guard_delete');
    expect(guardDelete).toContain('BEFORE DELETE ON public.trial_offer_versions');
    expect(guardDelete).toContain('EXECUTE FUNCTION trial_offer_versions_guard_delete()');

    const current = byName.get('trg_trial_offer_settings_guard_current_version');
    expect(current).toContain('BEFORE INSERT OR UPDATE ON public.trial_offer_settings');
    expect(current).toContain('EXECUTE FUNCTION trial_offer_settings_guard_current_version()');
  });
});

describe('F63 schema — RLS, grants e contratos de função', () => {
  it('7. RLS habilitada com exatamente uma policy service_role ALL', async () => {
    const rls = await query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.trial_offer_versions'::regclass",
    );
    expect(rls[0]?.relrowsecurity).toBe(true);

    const policies = await query<{ policyname: string; roles: string; cmd: string }>(
      `select policyname, array_to_string(roles, ',') as roles, cmd
         from pg_policies
        where schemaname = 'public' and tablename = 'trial_offer_versions'`,
    );
    expect(policies).toHaveLength(1);
    expect(policies[0].policyname).toBe('trial_offer_versions_service_role_all');
    expect(policies[0].roles).toBe('service_role');
    expect(policies[0].cmd).toBe('ALL');
  });

  it('8. volatilidade, SECURITY DEFINER/INVOKER, search_path e TimeZone', async () => {
    const names = [
      'trial_offer_calendar_reaches_total',
      'trial_offer_conditions',
      'trial_offer_public_offer',
      'trial_offer_release_schedule',
      'trial_offer_versions_guard',
      'trial_offer_versions_guard_delete',
      'trial_offer_settings_guard_current_version',
    ];
    const rows = await query<{
      proname: string;
      provolatile: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select p.proname, p.provolatile, p.prosecdef, p.proconfig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = any($1)`,
      [names],
    );
    const byName = new Map(rows.map((row) => [row.proname, row]));

    const expectSecurity = (
      name: string,
      volatile: string,
      definer: boolean,
      expectsUtc = false,
    ) => {
      const row = byName.get(name);
      expect(row, `função ausente: ${name}`).toBeTruthy();
      expect(row?.provolatile).toBe(volatile);
      expect(row?.prosecdef).toBe(definer);
      expect(row?.proconfig ?? []).toContain('search_path=""');
      if (expectsUtc) expect(row?.proconfig ?? []).toContain('TimeZone=UTC');
    };

    expectSecurity('trial_offer_calendar_reaches_total', 'i', false);
    expectSecurity('trial_offer_conditions', 's', true);
    expectSecurity('trial_offer_public_offer', 's', true);
    expectSecurity('trial_offer_release_schedule', 's', true, true);
    expectSecurity('trial_offer_versions_guard', 'v', false);
    expectSecurity('trial_offer_versions_guard_delete', 'v', false);
    expectSecurity('trial_offer_settings_guard_current_version', 'v', false);
  });

  it('9. EXECUTE restrito a service_role; tabela negada a anon/authenticated', async () => {
    const signatures = [
      'public.trial_offer_calendar_reaches_total(text,integer,integer,integer)',
      'public.trial_offer_conditions(uuid)',
      'public.trial_offer_public_offer()',
      'public.trial_offer_release_schedule(uuid,timestamptz)',
      'public.trial_offer_versions_guard()',
      'public.trial_offer_versions_guard_delete()',
      'public.trial_offer_settings_guard_current_version()',
    ];
    for (const signature of signatures) {
      const rows = await query<{ authd: boolean; anonymous: boolean; service: boolean }>(
        `select has_function_privilege('authenticated', to_regprocedure($1)::oid, 'EXECUTE') as authd,
                has_function_privilege('anon', to_regprocedure($1)::oid, 'EXECUTE') as anonymous,
                has_function_privilege('service_role', to_regprocedure($1)::oid, 'EXECUTE') as service`,
        [signature],
      );
      expect(rows[0], `função ausente: ${signature}`).toBeTruthy();
      expect(rows[0]).toMatchObject({ authd: false, anonymous: false, service: true });
    }

    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const rows = await query<{ anonymous: boolean; authd: boolean; service: boolean }>(
        `select has_table_privilege('anon', 'public.trial_offer_versions', $1) as anonymous,
                has_table_privilege('authenticated', 'public.trial_offer_versions', $1) as authd,
                has_table_privilege('service_role', 'public.trial_offer_versions', $1) as service`,
        [privilege],
      );
      expect(rows[0]).toMatchObject({ anonymous: false, authd: false, service: true });
    }
  });

  it('10. SET LOCAL ROLE: anon/authenticated negados (42501), service_role permitido', async () => {
    await inTransaction(async (client) => {
      await client.query('set local role anon');
      await expectSqlState(client, 'select count(*) from public.trial_offer_versions', [], '42501');
      await expectSqlState(client, 'select public.trial_offer_conditions(null)', [], '42501');
      await client.query('reset role');

      await client.query('set local role authenticated');
      await expectSqlState(client, 'select count(*) from public.trial_offer_versions', [], '42501');
      await expectSqlState(client, 'select public.trial_offer_conditions(null)', [], '42501');
      await client.query('reset role');

      await client.query('set local role service_role');
      const count = await scalarOn<number>(
        client,
        'select count(*)::int from public.trial_offer_versions',
      );
      expect(count).toBeGreaterThanOrEqual(1);
      const conditions = await client.query<{ result: { offer_key: string } }>(
        'select public.trial_offer_conditions(null) as result',
      );
      expect(conditions.rows[0].result.offer_key).toBe('trial_28d_v1');
      await client.query('reset role');
    });
  });
});

describe('F63 schema — domínio (checks)', () => {
  it('11. checks rejeitam frequência, duração, total, créditos, rótulo e nome inválidos', async () => {
    await inTransaction(async (client) => {
      const insert = () => INSERT_VERSION_SQL;
      const values = (options: VersionOptions) => versionValues(options);

      await expectSqlState(
        client,
        insert(),
        values({ releaseFrequency: 'biweekly' }),
        '23514',
      );
      await expectSqlState(client, insert(), values({ durationDays: 0 }), '23514');
      await expectSqlState(client, insert(), values({ maxTotalCredits: 0 }), '23514');
      await expectSqlState(
        client,
        insert(),
        values({ releaseFrequency: 'once', creditsPerRelease: 5 }),
        '23514',
      );
      await expectSqlState(
        client,
        insert(),
        values({ releaseFrequency: 'weekly', creditsPerRelease: null }),
        '23514',
      );
      await expectSqlState(
        client,
        insert(),
        values({ releaseFrequency: 'weekly', creditsPerRelease: 25 }),
        '23514',
      );
      await expectSqlState(client, insert(), values({ versionLabel: '   ' }), '23514');
      await expectSqlState(client, insert(), values({ publicName: '   ' }), '23514');
    });
  });

  it('12. FKs e unicidades: programa inexistente (23503), par duplicado e id duplicado (23505)', async () => {
    await inTransaction(async (client) => {
      await expectSqlState(
        client,
        INSERT_VERSION_SQL,
        versionValues({ offerKey: 'f63test_schema_missing_program' }),
        '23503',
      );

      const label = `${runId}-dup-pair`;
      await insertVersion(client, { versionLabel: label });
      await expectSqlState(
        client,
        INSERT_VERSION_SQL,
        versionValues({ versionLabel: label }),
        '23505',
      );

      const sharedId = crypto.randomUUID();
      await insertVersion(client, { id: sharedId });
      await expectSqlState(
        client,
        INSERT_VERSION_SQL,
        versionValues({ id: sharedId }),
        '23505',
      );

      if (runId.length === 0) throw new Error('unreachable');
    });
  });
});

describe('F63 schema — publicação e imutabilidade', () => {
  it('13. inserção publicada: motivo obrigatório e calendário suficiente', async () => {
    await inTransaction(async (client) => {
      const published = (options: VersionOptions) => ({
        publishedAt: '2026-06-01T00:00:00Z',
        publicationReason: 'f63-test-fixture',
        ...options,
      });

      await expectPgError(
        client,
        INSERT_VERSION_SQL,
        versionValues(published({ publicationReason: null })),
        { code: 'P0001', message: /publication_reason_required/ },
      );
      await expectPgError(
        client,
        INSERT_VERSION_SQL,
        versionValues(published({ publicationReason: '   ' })),
        { code: 'P0001', message: /publication_reason_required/ },
      );
      await expectPgError(
        client,
        INSERT_VERSION_SQL,
        versionValues(published({ releaseFrequency: 'monthly', durationDays: 28 })),
        { code: 'P0001', message: /calendar_insufficient/ },
      );
      await expectPgError(
        client,
        INSERT_VERSION_SQL,
        versionValues(published({ durationDays: 21 })),
        { code: 'P0001', message: /calendar_insufficient/ },
      );

      const id = await insertVersion(client, published({}));
      expect(id).toBeTruthy();
    });
  });

  it('14. versão publicada é imutável e não pode ser excluída; rascunho é editável/excluível', async () => {
    await inTransaction(async (client) => {
      const id = await insertVersion(client, {
        publishedAt: '2026-06-01T00:00:00Z',
        publicationReason: 'f63-test-fixture',
      });

      await expectPgError(
        client,
        'update public.trial_offer_versions set credits_per_release = 6 where id = $1',
        [id],
        { code: 'P0001', message: /conditions_immutable/ },
      );
      await expectPgError(
        client,
        'update public.trial_offer_versions set id = $1 where id = $2',
        [crypto.randomUUID(), id],
        { code: 'P0001', message: /id_immutable/ },
      );
      await expectPgError(
        client,
        "update public.trial_offer_versions set offer_key = 'f63test-schema-other-key' where id = $1",
        [id],
        { code: 'P0001', message: /identity_immutable/ },
      );
      await expectPgError(
        client,
        "update public.trial_offer_versions set version_label = 'v2' where id = $1",
        [id],
        { code: 'P0001', message: /identity_immutable/ },
      );
      await expectPgError(
        client,
        "update public.trial_offer_versions set publication_reason = 'changed' where id = $1",
        [id],
        { code: 'P0001', message: /conditions_immutable/ },
      );
      await expectPgError(
        client,
        'update public.trial_offer_versions set published_at = null where id = $1',
        [id],
        { code: 'P0001', message: /published_immutable/ },
      );
      await expectPgError(
        client,
        'update public.trial_offer_versions set published_at = now() where id = $1',
        [id],
        { code: 'P0001', message: /published_immutable/ },
      );
      await expectPgError(
        client,
        'delete from public.trial_offer_versions where id = $1',
        [id],
        { code: 'P0001', message: /published_delete_forbidden/ },
      );

      const draftId = await insertVersion(client, {});
      await client.query(
        'update public.trial_offer_versions set max_total_credits = 10 where id = $1',
        [draftId],
      );
      const edited = await scalarOn<number>(
        client,
        'select max_total_credits from public.trial_offer_versions where id = $1',
        [draftId],
      );
      expect(edited).toBe(10);

      const deleted = await client.query<{ id: string }>(
        'delete from public.trial_offer_versions where id = $1 returning id',
        [draftId],
      );
      expect(deleted.rows).toHaveLength(1);
      expect(deleted.rows[0].id).toBe(draftId);
    });
  });
});

describe('F63 schema — autoria SET NULL', () => {
  it('15. excluir o usuário anula created_by/published_by sem alterar condições', async () => {
    await inTransaction(async (client) => {
      const author = await createUser(client, 'set-null-author');
      const other = await createUser(client, 'set-null-other');

      const id = await insertVersion(client, {
        publishedAt: '2026-06-01T00:00:00Z',
        publicationReason: 'f63-test-fixture',
        createdBy: author,
        publishedBy: author,
      });

      const before = await client.query<Row>(
        `select public_name, duration_days, max_total_credits, release_frequency,
                credits_per_release, publication_reason, published_at, created_at
           from public.trial_offer_versions where id = $1`,
        [id],
      );

      await client.query('delete from auth.users where id = $1', [author]);

      const after = await client.query<Row>(
        `select created_by, published_by, public_name, duration_days, max_total_credits,
                release_frequency, credits_per_release, publication_reason, published_at, created_at
           from public.trial_offer_versions where id = $1`,
        [id],
      );
      expect(after.rows[0].created_by).toBeNull();
      expect(after.rows[0].published_by).toBeNull();
      const { created_by, published_by, ...conditions } = after.rows[0];
      expect(created_by).toBeNull();
      expect(published_by).toBeNull();
      expect(conditions).toEqual(before.rows[0]);

      await expectPgError(
        client,
        'update public.trial_offer_versions set published_by = $1 where id = $2',
        [other, id],
        { code: 'P0001', message: /author_immutable/ },
      );

      await expectPgError(
        client,
        'update public.trial_offer_versions set published_by = null, credits_per_release = 6 where id = $1',
        [id],
        { code: 'P0001', message: /conditions_immutable/ },
      );
    });
  });
});

describe('F63 schema — publisher guard (Migration C)', () => {
  it('16. rascunho sem published_by, primeira publicação aceita UUID e publicado só→NULL', async () => {
    await inTransaction(async (client) => {
      const first = await createUser(client, 'publisher-first');
      const second = await createUser(client, 'publisher-second');

      // (1) rascunho com published_by → rejeitado
      await expectPgError(client, INSERT_VERSION_SQL, versionValues({ publishedBy: first }), {
        code: 'P0001',
        message: /publisher_requires_publication/,
      });

      // (2) já publicado com UUID → aceito
      const publishedWithUuid = await insertVersion(client, {
        publishedAt: '2026-06-01T00:00:00Z',
        publicationReason: 'f63-test-fixture',
        publishedBy: first,
      });

      // (3) já publicado com NULL → aceito
      const publishedWithNull = await insertVersion(client, {
        publishedAt: '2026-06-01T00:00:00Z',
        publicationReason: 'f63-test-fixture',
        publishedBy: null,
      });
      expect(publishedWithNull).toBeTruthy();

      // (4) rascunho → rascunho definindo published_by → rejeitado
      const draft = await insertVersion(client, {});
      await expectPgError(
        client,
        'update public.trial_offer_versions set published_by = $1 where id = $2',
        [first, draft],
        { code: 'P0001', message: /publisher_requires_publication/ },
      );

      // (5) rascunho → publicado definindo NULL→UUID → aceito
      const publishable = await insertVersion(client, {});
      await client.query(
        `update public.trial_offer_versions
            set published_at = '2026-06-01T00:00:00Z',
                publication_reason = 'f63-test-fixture',
                published_by = $1
          where id = $2`,
        [first, publishable],
      );
      expect(
        await scalarOn<string | null>(
          client,
          'select published_by from public.trial_offer_versions where id = $1',
          [publishable],
        ),
      ).toBe(first);

      // (6) publicado trocando para outro UUID → rejeitado
      await expectPgError(
        client,
        'update public.trial_offer_versions set published_by = $1 where id = $2',
        [second, publishedWithUuid],
        { code: 'P0001', message: /author_immutable/ },
      );

      // (7) publicado UUID→NULL → aceito, demais campos congelados
      const before = await client.query<Row>(
        `select public_name, duration_days, max_total_credits, release_frequency,
                credits_per_release, publication_reason, published_at
           from public.trial_offer_versions where id = $1`,
        [publishedWithUuid],
      );
      await client.query(
        'update public.trial_offer_versions set published_by = null where id = $1',
        [publishedWithUuid],
      );
      const after = await client.query<Row>(
        `select published_by, public_name, duration_days, max_total_credits, release_frequency,
                credits_per_release, publication_reason, published_at
           from public.trial_offer_versions where id = $1`,
        [publishedWithUuid],
      );
      expect(after.rows[0].published_by).toBeNull();
      const { published_by, ...rest } = after.rows[0];
      expect(published_by).toBeNull();
      expect(rest).toEqual(before.rows[0]);

      // (8) created_by: só valor → NULL; UUID→outro UUID rejeitado
      const createdDraft = await insertVersion(client, { createdBy: first });
      await client.query(
        'update public.trial_offer_versions set created_by = null where id = $1',
        [createdDraft],
      );
      expect(
        await scalarOn<string | null>(
          client,
          'select created_by from public.trial_offer_versions where id = $1',
          [createdDraft],
        ),
      ).toBeNull();

      const immutableDraft = await insertVersion(client, { createdBy: first });
      await expectPgError(
        client,
        'update public.trial_offer_versions set created_by = $1 where id = $2',
        [second, immutableDraft],
        { code: 'P0001', message: /author_immutable/ },
      );
    });
  });
});

describe('F63 schema — vigência sem DDL', () => {
  it('17. rascunho/inexistente/NULL são rejeitados; enabled=false mantém a vigência', async () => {
    await inTransaction(async (client) => {
      const v1Id = await scalarOn<string>(
        client,
        "select id from public.trial_offer_versions where offer_key = 'trial_28d_v1' and version_label = 'v1'",
      );
      const draftId = await insertVersion(client, {});

      await expectPgError(
        client,
        "update public.trial_offer_settings set current_version_id = $1 where offer_key = 'trial_28d_v1'",
        [draftId],
        { code: 'P0001', message: /not_published/ },
      );
      await expectPgError(
        client,
        "update public.trial_offer_settings set current_version_id = gen_random_uuid() where offer_key = 'trial_28d_v1'",
        [],
        { code: 'P0001', message: /not_found/ },
      );
      await expectSqlState(
        client,
        "update public.trial_offer_settings set current_version_id = null where offer_key = 'trial_28d_v1'",
        [],
        '23502',
      );

      const versionsBefore = await scalarOn<number>(
        client,
        'select count(*)::int from public.trial_offer_versions',
      );
      await client.query(
        "update public.trial_offer_settings set enabled = false where offer_key = 'trial_28d_v1'",
      );
      const state = await client.query<{ current_version_id: string; enabled: boolean }>(
        "select current_version_id, enabled from public.trial_offer_settings where offer_key = 'trial_28d_v1'",
      );
      expect(state.rows[0].current_version_id).toBe(v1Id);
      expect(state.rows[0].enabled).toBe(false);
      expect(
        await scalarOn<number>(client, 'select count(*)::int from public.trial_offer_versions'),
      ).toBe(versionsBefore);

      const publicOffer = await client.query<{ result: { version_label: string } }>(
        'select public.trial_offer_public_offer() as result',
      );
      expect(publicOffer.rows[0].result.version_label).toBe('v1');
    });
  });

  it('18. FK composta é provada por INSERT (23503), não por ALTER', async () => {
    await inTransaction(async (client) => {
      const v1Id = await scalarOn<string>(
        client,
        "select id from public.trial_offer_versions where offer_key = 'trial_28d_v1' and version_label = 'v1'",
      );
      await expectSqlState(
        client,
        "insert into public.trial_offer_settings (offer_key, current_version_id) values ('f63test_other', $1)",
        [v1Id],
        '23503',
      );
      const residue = await scalarOn<number>(
        client,
        "select count(*)::int from public.trial_offer_settings where offer_key = 'f63test_other'",
      );
      expect(residue).toBe(0);
    });
  });
});

describe('F63 schema — guardas de schema preservados', () => {
  it('19. funções, colunas de enrollments e settings conferem com o baseline 63-01', async () => {
    const baseline = JSON.parse(readFileSync(path.resolve(process.cwd(), BASELINE_PATH), 'utf8'));
    const baselineFunctions = baseline.schema_guards.functions as Record<string, string>;
    expect(Object.keys(baselineFunctions)).toHaveLength(5);

    for (const [signature, expected] of Object.entries(baselineFunctions)) {
      const rows = await query<{ hash: string }>(
        "select coalesce(md5(pg_get_functiondef(to_regprocedure($1))), '') as hash",
        [signature],
      );
      expect(rows[0]?.hash, `função ausente/divergente: ${signature}`).toBe(expected);
      expect(rows[0].hash).toMatch(/^[0-9a-f]{32}$/);
    }

    const enrollmentColumns = (
      await query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'trial_offer_enrollments'
          order by ordinal_position`,
      )
    ).map((row) => row.column_name);
    expect(enrollmentColumns).toEqual(baseline.schema_guards.trial_offer_enrollments_columns);
    expect(enrollmentColumns).not.toContain('offer_version_id');

    const settingsColumns = (
      await query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'trial_offer_settings'
          order by ordinal_position`,
      )
    ).map((row) => row.column_name);
    const baselineSettings = baseline.schema_guards
      .trial_offer_settings_columns as string[];
    const added = settingsColumns.filter((column) => !baselineSettings.includes(column));
    const removed = baselineSettings.filter((column) => !settingsColumns.includes(column));
    expect(added).toEqual(['current_version_id']);
    expect(removed).toEqual([]);
    expect(settingsColumns.slice(0, baselineSettings.length)).toEqual(baselineSettings);

    const currentNotNull = await query<{ attnotnull: boolean; is_nullable: string }>(
      `select a.attnotnull, c.is_nullable
         from pg_attribute a
         join information_schema.columns c
           on c.table_schema = 'public' and c.table_name = 'trial_offer_settings'
          and c.column_name = a.attname
        where a.attrelid = 'public.trial_offer_settings'::regclass
          and a.attname = 'current_version_id'
          and not a.attisdropped`,
    );
    expect(currentNotNull[0]?.attnotnull).toBe(true);
    expect(currentNotNull[0]?.is_nullable).toBe('NO');
  });
});
