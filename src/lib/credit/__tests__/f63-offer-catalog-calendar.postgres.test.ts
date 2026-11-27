import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  readCurrentTrialOffer,
  readTrialOfferConditions,
  readTrialOfferSchedule,
  type TrialOfferRpcClient,
} from '@/lib/credit/trial-offer/offer';
import {
  FORBIDDEN_PUBLIC_FIELDS,
  PUBLIC_OFFER_FIELDS,
  TRIAL_OFFER_RPC,
} from '@/lib/credit/trial-offer/offer-contract';
import {
  TRIAL_DURATION_DAYS,
  TRIAL_INSTALLMENT_AMOUNT,
  TRIAL_INSTALLMENT_DAYS,
  TRIAL_MAX_GRANTED,
  TRIAL_OFFER_KEY,
} from '@/lib/credit/trial-offer/constants';

/**
 * F63 / 63-05 — calendário, contratos SQL↔TS e leitura pura no HOMOLOG.
 *
 * Alvo único: 127.0.0.1:57782/postgres (container supabase_db_vendeo-homolog).
 * Fixtures publicadas usam o prefixo `f63test-calendar-` e rodam em transação
 * com rollback (nada persistido). Nenhum DDL, nenhuma reserva de créditos.
 */
const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) {
  throw new Error('TEST_DATABASE_URL obrigatório (homolog 127.0.0.1:57782/postgres)');
}

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
  if (url.hostname !== '127.0.0.1' || url.port !== '57782' || url.pathname !== '/postgres') {
    throw new Error('Destino recusado: esperado 127.0.0.1:57782/postgres');
  }
  return url;
}

const target = parseTarget(rawUrl);
const pool = new Pool({ connectionString: target.toString(), ssl: false });
const runId = `f63test-calendar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Row = Record<string, unknown>;

type Schedule = {
  expires_at: string;
  releases: Array<{ seq: number; due_at: string; amount: number }>;
  total: number;
};

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

async function scheduleFor(client: PoolClient, versionId: string, startedAt: string): Promise<Schedule> {
  const result = await client.query<{ result: Schedule }>(
    'select public.trial_offer_release_schedule($1,$2) as result',
    [versionId, startedAt],
  );
  return result.rows[0].result;
}

async function scheduleRaw(
  client: PoolClient,
  versionId: string,
  startedAt: string,
): Promise<string> {
  const result = await client.query<{ result: string }>(
    'select public.trial_offer_release_schedule($1,$2)::text as result',
    [versionId, startedAt],
  );
  return result.rows[0].result;
}

async function expectPgError(
  client: PoolClient,
  sql: string,
  values: unknown[],
  message: RegExp,
): Promise<void> {
  await client.query('savepoint expected_error');
  try {
    await client.query(sql, values);
    throw new Error('esperava erro do banco, mas a operação passou');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('esperava erro do banco')) throw error;
    const pgError = error as { code?: string; message?: string };
    expect(pgError.code).toBe('P0001');
    expect(pgError.message ?? '').toMatch(message);
  } finally {
    await client.query('rollback to savepoint expected_error').catch(() => undefined);
  }
}

type PublishedOptions = {
  label: string;
  durationDays?: number;
  maxTotalCredits?: number;
  releaseFrequency?: string;
  creditsPerRelease?: number | null;
  publicName?: string;
};

async function insertPublished(client: PoolClient, options: PublishedOptions): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    `insert into public.trial_offer_versions
       (id, offer_key, version_label, public_name, duration_days, max_total_credits,
        release_frequency, credits_per_release, published_at, publication_reason)
     values ($1, 'trial_28d_v1', $2, $3, $4, $5, $6, $7, '2026-06-01T00:00:00Z', 'f63-test-fixture')`,
    [
      id,
      `${runId}-${options.label}`,
      options.publicName ?? `F63 TEST ${options.label}`,
      options.durationDays ?? 28,
      options.maxTotalCredits ?? 20,
      options.releaseFrequency ?? 'weekly',
      options.creditsPerRelease === undefined ? 5 : options.creditsPerRelease,
    ],
  );
  return id;
}

async function v1IdOn(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    "select id from public.trial_offer_versions where offer_key = 'trial_28d_v1' and version_label = 'v1'",
  );
  return result.rows[0].id;
}

function assertCalendarReaches(schedule: Schedule, maxTotalCredits: number): void {
  expect(schedule.releases.length).toBeGreaterThan(0);
  expect(schedule.releases.map((release) => release.seq)).toEqual(
    schedule.releases.map((_release, index) => index),
  );
  const sum = schedule.releases.reduce((total, release) => total + release.amount, 0);
  expect(sum).toBe(maxTotalCredits);
  expect(schedule.total).toBe(maxTotalCredits);
  for (const release of schedule.releases) {
    expect(Number.isInteger(release.amount)).toBe(true);
    expect(release.amount).toBeGreaterThan(0);
    expect(Date.parse(release.due_at)).toBeLessThan(Date.parse(schedule.expires_at));
  }
}

function makeAdapter(client: PoolClient): TrialOfferRpcClient {
  return {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      try {
        if (name === TRIAL_OFFER_RPC.publicOffer) {
          const result = await client.query<{ result: unknown }>(
            'select public.trial_offer_public_offer() as result',
          );
          return { data: result.rows[0].result, error: null };
        }
        if (name === TRIAL_OFFER_RPC.conditions) {
          const result = await client.query<{ result: unknown }>(
            'select public.trial_offer_conditions($1) as result',
            [args?.p_version_id ?? null],
          );
          return { data: result.rows[0].result, error: null };
        }
        if (name === TRIAL_OFFER_RPC.schedule) {
          const result = await client.query<{ result: unknown }>(
            'select public.trial_offer_release_schedule($1,$2) as result',
            [args?.p_version_id, args?.p_started_at],
          );
          return { data: result.rows[0].result, error: null };
        }
        throw new Error(`rpc inesperada: ${name}`);
      } catch (error) {
        return { data: null, error };
      }
    },
  } as unknown as TrialOfferRpcClient;
}

beforeAll(async () => {
  const identity = await query<{ db: string; auth: boolean }>(
    "select current_database() as db, to_regclass('auth.users') is not null as auth",
  );
  if (identity[0]?.db !== 'postgres' || identity[0]?.auth !== true) {
    throw new Error('Alvo não é o homolog esperado (banco/auth divergentes)');
  }
  const v1 = await query("select 1 from public.trial_offer_versions where offer_key = 'trial_28d_v1' and version_label = 'v1' and published_at is not null");
  if (v1.length !== 1) throw new Error('v1 publicada ausente');
});

afterAll(async () => {
  await pool.end();
});

describe('F63 calendário — v1 e fixtures publicadas', () => {
  it('1. v1 semanal produz 0/7/14/21, 5 cada, total 20 e expires_at +28d', async () => {
    await inTransaction(async (client) => {
      const v1 = await v1IdOn(client);
      for (const startedAt of ['2026-03-10T09:30:00Z', '2026-12-28T23:00:00Z']) {
        const schedule = await scheduleFor(client, v1, startedAt);
        expect(schedule.releases).toHaveLength(4);
        expect(schedule.releases.map((release) => release.amount)).toEqual([5, 5, 5, 5]);
        expect(schedule.releases.map((release) => release.seq)).toEqual([0, 1, 2, 3]);
        schedule.releases.forEach((release, index) => {
          expect(Date.parse(release.due_at)).toBe(
            Date.parse(startedAt) + index * 7 * 86_400_000,
          );
        });
        expect(Date.parse(schedule.expires_at)).toBe(
          Date.parse(startedAt) + 28 * 86_400_000,
        );
        assertCalendarReaches(schedule, 20);
      }
    });
  });

  it('2. mensal usa mês de calendário (31/01 → 28/02, 31/03, 30/04)', async () => {
    await inTransaction(async (client) => {
      const id = await insertPublished(client, {
        label: 'monthly-calendar',
        durationDays: 120,
        releaseFrequency: 'monthly',
        creditsPerRelease: 5,
      });
      const startedAt = '2026-01-31T12:00:00Z';
      const schedule = await scheduleFor(client, id, startedAt);
      expect(schedule.releases).toHaveLength(4);
      expect(schedule.releases.map((release) => release.amount)).toEqual([5, 5, 5, 5]);
      const expected = [
        '2026-01-31T12:00:00Z',
        '2026-02-28T12:00:00Z',
        '2026-03-31T12:00:00Z',
        '2026-04-30T12:00:00Z',
      ];
      expect(schedule.releases.map((release) => Date.parse(release.due_at))).toEqual(
        expected.map((value) => Date.parse(value)),
      );
      assertCalendarReaches(schedule, 20);
    });
  });

  it('3. semanal 20/7 libera 7, 7 e 6; once entrega o total; daily 4×5', async () => {
    await inTransaction(async (client) => {
      const weekly = await insertPublished(client, {
        label: 'weekly-7',
        maxTotalCredits: 20,
        creditsPerRelease: 7,
      });
      const weeklySchedule = await scheduleFor(client, weekly, '2026-05-01T00:00:00Z');
      expect(weeklySchedule.releases.map((release) => release.amount)).toEqual([7, 7, 6]);
      assertCalendarReaches(weeklySchedule, 20);

      const once = await insertPublished(client, {
        label: 'once',
        durationDays: 30,
        releaseFrequency: 'once',
        creditsPerRelease: null,
      });
      const onceSchedule = await scheduleFor(client, once, '2026-05-01T00:00:00Z');
      expect(onceSchedule.releases).toHaveLength(1);
      expect(onceSchedule.releases[0].amount).toBe(20);
      expect(Date.parse(onceSchedule.releases[0].due_at)).toBe(
        Date.parse('2026-05-01T00:00:00Z'),
      );
      assertCalendarReaches(onceSchedule, 20);

      const daily = await insertPublished(client, {
        label: 'daily',
        durationDays: 4,
        releaseFrequency: 'daily',
        creditsPerRelease: 5,
      });
      const dailySchedule = await scheduleFor(client, daily, '2026-05-01T00:00:00Z');
      expect(dailySchedule.releases.map((release) => release.seq)).toEqual([0, 1, 2, 3]);
      expect(dailySchedule.releases.map((release) => release.amount)).toEqual([5, 5, 5, 5]);
      assertCalendarReaches(dailySchedule, 20);
    });
  });

  it('4. borda do helper e rejeição de calendário insuficiente', async () => {
    await inTransaction(async (client) => {
      const reaches = async (
        frequency: string,
        credits: number,
        total: number,
        duration: number,
      ) =>
        (
          await client.query<{ result: boolean }>(
            'select public.trial_offer_calendar_reaches_total($1,$2,$3,$4) as result',
            [frequency, credits, total, duration],
          )
        ).rows[0].result;

      expect(await reaches('weekly', 5, 20, 21)).toBe(false);
      expect(await reaches('weekly', 5, 20, 22)).toBe(true);
      expect(await reaches('monthly', 5, 20, 93)).toBe(false);
      expect(await reaches('monthly', 5, 20, 94)).toBe(true);

      await expectPgError(
        client,
        `insert into public.trial_offer_versions
           (offer_key, version_label, public_name, duration_days, max_total_credits,
            release_frequency, credits_per_release, published_at, publication_reason)
         values ('trial_28d_v1', $1, 'F63 TEST bad weekly', 21, 20, 'weekly', 5,
                 '2026-06-01T00:00:00Z', 'f63-test-fixture')`,
        [`${runId}-bad-weekly`],
        /calendar_insufficient/,
      );
      await expectPgError(
        client,
        `insert into public.trial_offer_versions
           (offer_key, version_label, public_name, duration_days, max_total_credits,
            release_frequency, credits_per_release, published_at, publication_reason)
         values ('trial_28d_v1', $1, 'F63 TEST bad monthly', 28, 20, 'monthly', 5,
                 '2026-06-01T00:00:00Z', 'f63-test-fixture')`,
        [`${runId}-bad-monthly`],
        /calendar_insufficient/,
      );
    });
  });
});

describe('F63 calendário — independência de timezone e leitura pura', () => {
  it('5. mesmo início sob UTC/São Paulo/Tóquio devolve payload idêntico', async () => {
    await inTransaction(async (client) => {
      const id = await insertPublished(client, {
        label: 'tz-monthly',
        durationDays: 120,
        releaseFrequency: 'monthly',
        creditsPerRelease: 5,
      });
      const startedAt = '2026-01-31T23:30:00Z';
      const payloads: string[] = [];
      for (const timeZone of ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo']) {
        await client.query("select set_config('TimeZone', $1, true)", [timeZone]);
        payloads.push(await scheduleRaw(client, id, startedAt));
      }
      expect(payloads[1]).toBe(payloads[0]);
      expect(payloads[2]).toBe(payloads[0]);

      const schedule = JSON.parse(payloads[0]) as Schedule;
      expect(Date.parse(schedule.expires_at)).toBe(
        Date.parse(startedAt) + 120 * 86_400_000,
      );
      expect(schedule.releases.map((release) => Date.parse(release.due_at))).toEqual([
        Date.parse('2026-01-31T23:30:00Z'),
        Date.parse('2026-02-28T23:30:00Z'),
        Date.parse('2026-03-31T23:30:00Z'),
        Date.parse('2026-04-30T23:30:00Z'),
      ]);
      assertCalendarReaches(schedule, 20);
    });
  });

  it('6. calendário é leitura pura: nenhuma linha em créditos/concessões', async () => {
    const before = await query<{ enrollments: number; balances: number; transactions: number }>(
      `select
         (select count(*)::int from public.trial_offer_enrollments) as enrollments,
         (select count(*)::int from public.credit_balances) as balances,
         (select count(*)::int from public.credit_transactions) as transactions`,
    );

    await inTransaction(async (client) => {
      const v1 = await v1IdOn(client);
      await scheduleFor(client, v1, '2026-03-10T09:30:00Z');
      const monthly = await insertPublished(client, {
        label: 'pure-read',
        durationDays: 120,
        releaseFrequency: 'monthly',
        creditsPerRelease: 5,
      });
      await scheduleFor(client, monthly, '2026-01-31T12:00:00Z');
    });

    const after = await query<{ enrollments: number; balances: number; transactions: number }>(
      `select
         (select count(*)::int from public.trial_offer_enrollments) as enrollments,
         (select count(*)::int from public.credit_balances) as balances,
         (select count(*)::int from public.credit_transactions) as transactions`,
    );
    expect(after).toEqual(before);
  });
});

describe('F63 contratos — SQL real e módulo TypeScript', () => {
  it('7. conditions/public_offer expõem os campos contratados e nada proibido', async () => {
    await inTransaction(async (client) => {
      const v1 = await v1IdOn(client);

      const current = await client.query<{ result: Row }>(
        'select public.trial_offer_conditions(null) as result',
      );
      const byId = await client.query<{ result: Row }>(
        'select public.trial_offer_conditions($1) as result',
        [v1],
      );
      const publicOffer = await client.query<{ result: Row }>(
        'select public.trial_offer_public_offer() as result',
      );

      for (const result of [current.rows[0].result, byId.rows[0].result]) {
        expect(Object.keys(result).sort()).toEqual(
          [
            'offer_key',
            'version_id',
            'version_label',
            'public_name',
            'duration_days',
            'max_total_credits',
            'release_frequency',
            'credits_per_release',
            'published_at',
          ].sort(),
        );
        expect(result.offer_key).toBe('trial_28d_v1');
        expect(result.version_id).toBe(v1);
        expect(result.version_label).toBe('v1');
        expect(Number(result.duration_days)).toBe(28);
        expect(Number(result.max_total_credits)).toBe(20);
        expect(result.release_frequency).toBe('weekly');
        expect(Number(result.credits_per_release)).toBe(5);
        expect(result.published_at).not.toBeNull();
      }

      const publicResult = publicOffer.rows[0].result;
      expect(Object.keys(publicResult).sort()).toEqual([...PUBLIC_OFFER_FIELDS].sort());
      for (const forbidden of FORBIDDEN_PUBLIC_FIELDS) {
        expect(publicResult).not.toHaveProperty(forbidden);
      }
    });
  });

  it('8. falha fechada para rascunho e versão inexistente', async () => {
    await inTransaction(async (client) => {
      const draftId = crypto.randomUUID();
      await client.query(
        `insert into public.trial_offer_versions
           (id, offer_key, version_label, public_name, duration_days, max_total_credits,
            release_frequency, credits_per_release)
         values ($1, 'trial_28d_v1', $2, 'F63 TEST draft', 28, 20, 'weekly', 5)`,
        [draftId, `${runId}-draft-contract`],
      );
      await expectPgError(
        client,
        'select public.trial_offer_conditions($1)',
        [draftId],
        /not_published/,
      );
      await expectPgError(
        client,
        'select public.trial_offer_conditions($1)',
        [crypto.randomUUID()],
        /version_not_found/,
      );
    });
  });

  it('9. adapter pg alimenta o módulo TS com o mesmo resultado do SQL', async () => {
    await inTransaction(async (client) => {
      const v1 = await v1IdOn(client);
      const startedAt = '2026-03-10T09:30:00Z';
      const adapter = makeAdapter(client);

      const sqlPublic = (
        await client.query<{ result: Row }>('select public.trial_offer_public_offer() as result')
      ).rows[0].result;
      const tsPublic = await readCurrentTrialOffer(adapter);
      expect(tsPublic.versionLabel).toBe(sqlPublic.version_label);
      expect(tsPublic.publicName).toBe(sqlPublic.public_name);
      expect(tsPublic.durationDays).toBe(Number(sqlPublic.duration_days));
      expect(tsPublic.maxTotalCredits).toBe(Number(sqlPublic.max_total_credits));
      expect(tsPublic.releaseFrequency).toBe(sqlPublic.release_frequency);
      expect(tsPublic.creditsPerRelease).toBe(Number(sqlPublic.credits_per_release));

      const sqlConditions = (
        await client.query<{ result: Row }>('select public.trial_offer_conditions($1) as result', [
          v1,
        ])
      ).rows[0].result;
      const tsConditions = await readTrialOfferConditions(v1, adapter);
      expect(tsConditions.offerKey).toBe(sqlConditions.offer_key);
      expect(tsConditions.versionId).toBe(sqlConditions.version_id);
      expect(tsConditions.versionLabel).toBe(sqlConditions.version_label);
      expect(tsConditions.publishedAt).toBe(sqlConditions.published_at);

      const sqlSchedule = await scheduleFor(client, v1, startedAt);
      const tsSchedule = await readTrialOfferSchedule(v1, startedAt, adapter);
      expect(tsSchedule.expiresAt).toBe(sqlSchedule.expires_at);
      expect(tsSchedule.total).toBe(sqlSchedule.total);
      expect(tsSchedule.releases.map((release) => release.dueAt)).toEqual(
        sqlSchedule.releases.map((release) => release.due_at),
      );
      expect(tsSchedule.releases.map((release) => release.amount)).toEqual(
        sqlSchedule.releases.map((release) => release.amount),
      );
    });
  });

  it('10. seed v1 coincide com constants.ts; troca de fonte pertence à fatia 4', async () => {
    await inTransaction(async (client) => {
      const v1 = await v1IdOn(client);
      const schedule = await scheduleFor(client, v1, '2026-03-10T09:30:00Z');

      // A 2A apenas prepara a leitura. Os consumidores atuais (constants.ts,
      // status.ts, completion.ts, public-offer-copy.ts) NÃO foram religados;
      // a troca de fonte pertence à fatia 4.
      expect(TRIAL_OFFER_KEY).toBe('trial_28d_v1');
      expect(TRIAL_DURATION_DAYS).toBe(28);
      expect(TRIAL_MAX_GRANTED).toBe(20);
      expect(TRIAL_INSTALLMENT_AMOUNT).toBe(5);
      expect(TRIAL_INSTALLMENT_DAYS).toEqual([0, 7, 14, 21]);

      expect(schedule.total).toBe(TRIAL_MAX_GRANTED);
      expect(schedule.releases.map((release) => release.amount)).toEqual(
        TRIAL_INSTALLMENT_DAYS.map(() => TRIAL_INSTALLMENT_AMOUNT),
      );
      expect(Date.parse(schedule.expires_at)).toBe(
        Date.parse('2026-03-10T09:30:00Z') + TRIAL_DURATION_DAYS * 86_400_000,
      );
    });
  });
});
