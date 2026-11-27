import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * F63 / 63-05 — concorrência real com duas conexões no HOMOLOG existente.
 *
 * Alvo único: 127.0.0.1:57782/postgres (container supabase_db_vendeo-homolog).
 *
 * Regras:
 *  - Nenhum store nem user é criado ou apagado. Versões não exigem `store_id`.
 *  - Fixtures publicadas usam `version_label` com prefixo `f63test-conc-` e
 *    permanecem INERTES após a suíte (versão publicada não pode ser excluída).
 *    Rascunhos do prefixo são removidos e `current_version_id` volta à v1.
 *  - Duas conexões `pg.Client` independentes, `BEGIN` explícito,
 *    `lock_timeout='5s'`/`statement_timeout='30s'` e observação de
 *    `pg_stat_activity.wait_event_type = 'Lock'`. `Promise.all` sozinho NÃO é
 *    prova de serialização.
 *  - Nenhum DDL destrutivo; nenhuma escrita fora de versões/settings.
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
const connectionString = target.toString();
const pool = new Pool({ connectionString, ssl: false });
const runId = `f63test-conc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const labelPrefix = `${runId}-`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function newClient(label: string): Promise<Client> {
  const client = new Client({ connectionString, ssl: false });
  await client.connect();
  await client.query("SET application_name = 'f63_conc_" + label + "'");
  await client.query("SET lock_timeout = '5s'");
  await client.query("SET statement_timeout = '30s'");
  return client;
}

async function begin(client: Client): Promise<void> {
  await client.query('BEGIN');
}

async function pidOf(client: Client): Promise<number> {
  const result = await client.query<{ pid: number }>('select pg_backend_pid() as pid');
  return result.rows[0].pid;
}

async function waitForLock(
  pid: number,
  timeoutMs = 4000,
): Promise<{ type: string; event: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await pool.query<{ wait_event_type: string | null; wait_event: string | null }>(
      'select wait_event_type, wait_event from pg_stat_activity where pid = $1',
      [pid],
    );
    const row = result.rows[0];
    if (row?.wait_event_type) {
      return { type: row.wait_event_type, event: row.wait_event ?? 'unknown' };
    }
    await sleep(50);
  }
  return null;
}

async function v1Id(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    "select id from public.trial_offer_versions where offer_key = 'trial_28d_v1' and version_label = 'v1'",
  );
  if (result.rows.length !== 1) throw new Error('v1 publicada ausente');
  return result.rows[0].id;
}

type FixtureOptions = {
  publishedAt?: string | null;
  durationDays?: number;
  maxTotalCredits?: number;
  releaseFrequency?: string;
  creditsPerRelease?: number | null;
};

async function insertFixture(
  label: string,
  options: FixtureOptions = {},
): Promise<{ id: string; versionLabel: string }> {
  const id = crypto.randomUUID();
  const versionLabel = `${labelPrefix}${label}`;
  await pool.query(
    `insert into public.trial_offer_versions
       (id, offer_key, version_label, public_name, duration_days, max_total_credits,
        release_frequency, credits_per_release, published_at, publication_reason)
     values ($1, 'trial_28d_v1', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      versionLabel,
      `F63 TEST ${label}`,
      options.durationDays ?? 28,
      options.maxTotalCredits ?? 20,
      options.releaseFrequency ?? 'weekly',
      options.creditsPerRelease === undefined ? 5 : options.creditsPerRelease,
      options.publishedAt ?? null,
      options.publishedAt === null || options.publishedAt === undefined ? null : 'f63-test-fixture',
    ],
  );
  return { id, versionLabel };
}

async function restoreV1(): Promise<void> {
  const id = await v1Id();
  await pool.query(
    "update public.trial_offer_settings set current_version_id = $1 where offer_key = 'trial_28d_v1'",
    [id],
  );
}

async function deleteDrafts(): Promise<void> {
  await pool.query(
    'delete from public.trial_offer_versions where version_label like $1 and published_at is null',
    [`${labelPrefix}%`],
  );
}

async function listPublishedFixtures(): Promise<string[]> {
  const result = await pool.query<{ version_label: string }>(
    "select version_label from public.trial_offer_versions where version_label like 'f63test-%' and published_at is not null order by version_label",
  );
  return result.rows.map((row) => row.version_label);
}

beforeAll(async () => {
  const identity = await pool.query<{ db: string; auth: boolean }>(
    "select current_database() as db, to_regclass('auth.users') is not null as auth",
  );
  if (identity.rows[0]?.db !== 'postgres' || identity.rows[0]?.auth !== true) {
    throw new Error('Alvo não é o homolog esperado (banco/auth divergentes)');
  }
  await v1Id();
});

afterAll(async () => {
  try {
    // A vigência volta à v1 ANTES de apagar rascunhos (a FK composta protegeria
    // qualquer rascunho referenciado, embora os cenários nunca o façam).
    await restoreV1();
  } finally {
    try {
      await deleteDrafts();
    } finally {
      const published = await listPublishedFixtures();
      console.log(
        `[f63-concurrency] fixtures publicadas inertes (${published.length}): ${published.join(', ') || '(nenhuma)'}`,
      );
      await pool.end();
    }
  }
});

describe('F63 concorrência — publicação, edição e vigência', () => {
  it('1. duas publicações simultâneas: uma vence, a outra falha com espera de lock', async () => {
    const { id, versionLabel } = await insertFixture('pub-race');
    const clientA = await newClient('race-a');
    const clientB = await newClient('race-b');
    try {
      await begin(clientA);
      await clientA.query(
        "update public.trial_offer_versions set published_at = now(), publication_reason = 'f63-test-fixture' where id = $1",
        [id],
      );

      await begin(clientB);
      const bPid = await pidOf(clientB);
      let secondError: unknown = null;
      const pending = clientB
        .query(
          "update public.trial_offer_versions set published_at = now(), publication_reason = 'f63-test-fixture' where id = $1",
          [id],
        )
        .then(
          () => undefined,
          (error) => {
            secondError = error;
          },
        );

      const observed = await waitForLock(bPid);
      await clientA.query('COMMIT');
      await pending;
      await clientB.query('ROLLBACK').catch(() => undefined);

      expect(observed?.type).toBe('Lock');
      expect((secondError as { code?: string }).code).toBe('P0001');

      const row = await pool.query<{ published_at: string | null; publication_reason: string | null }>(
        'select published_at, publication_reason from public.trial_offer_versions where id = $1',
        [id],
      );
      expect(row.rows[0].published_at).not.toBeNull();
      expect(row.rows[0].publication_reason).toBe('f63-test-fixture');

      const same = await pool.query<{ count: number }>(
        'select count(*)::int as count from public.trial_offer_versions where version_label = $1',
        [versionLabel],
      );
      expect(same.rows[0].count).toBe(1);
    } finally {
      await clientA.end().catch(() => undefined);
      await clientB.end().catch(() => undefined);
    }
  });

  it('2a. edição segura lock e a publicação posterior congela o estado editado', async () => {
    const { id } = await insertFixture('edit-pub');
    const clientA = await newClient('edit-a');
    const clientB = await newClient('edit-b');
    try {
      await begin(clientA);
      await clientA.query(
        'update public.trial_offer_versions set max_total_credits = 10 where id = $1',
        [id],
      );

      await begin(clientB);
      const bPid = await pidOf(clientB);
      let publishError: unknown = null;
      const pending = clientB
        .query(
          "update public.trial_offer_versions set published_at = now(), publication_reason = 'f63-test-fixture' where id = $1",
          [id],
        )
        .then(
          () => undefined,
          (error) => {
            publishError = error;
          },
        );

      const observed = await waitForLock(bPid);
      await clientA.query('COMMIT');
      await pending;
      await clientB.query('COMMIT').catch(() => undefined);

      expect(observed?.type).toBe('Lock');
      expect(publishError).toBeNull();

      const row = await pool.query<{
        max_total_credits: number;
        credits_per_release: number;
        release_frequency: string;
        duration_days: number;
        published_at: string | null;
      }>(
        `select max_total_credits, credits_per_release, release_frequency, duration_days, published_at
           from public.trial_offer_versions where id = $1`,
        [id],
      );
      expect(row.rows[0]).toMatchObject({
        max_total_credits: 10,
        credits_per_release: 5,
        release_frequency: 'weekly',
        duration_days: 28,
      });
      expect(row.rows[0].published_at).not.toBeNull();
    } finally {
      await clientA.end().catch(() => undefined);
      await clientB.end().catch(() => undefined);
    }
  });

  it('2b. publicação commitada rejeita edição concorrente posterior (P0001)', async () => {
    const { id } = await insertFixture('pub-edit');
    const clientA = await newClient('pubedit-a');
    const clientB = await newClient('pubedit-b');
    try {
      await begin(clientA);
      await clientA.query(
        "update public.trial_offer_versions set published_at = now(), publication_reason = 'f63-test-fixture' where id = $1",
        [id],
      );
      await clientA.query('COMMIT');

      await begin(clientB);
      let editError: unknown = null;
      await clientB
        .query('update public.trial_offer_versions set max_total_credits = 10 where id = $1', [id])
        .catch((error) => {
          editError = error;
        });
      await clientB.query('ROLLBACK').catch(() => undefined);

      expect((editError as { code?: string }).code).toBe('P0001');
      expect((editError as { message?: string }).message ?? '').toMatch(/conditions_immutable/);

      const row = await pool.query<{ max_total_credits: number; published_at: string | null }>(
        'select max_total_credits, published_at from public.trial_offer_versions where id = $1',
        [id],
      );
      expect(row.rows[0].max_total_credits).toBe(20);
      expect(row.rows[0].published_at).not.toBeNull();
    } finally {
      await clientA.end().catch(() => undefined);
      await clientB.end().catch(() => undefined);
    }
  });

  it('3. troca simultânea de vigência serializa, ambas publicadas e condições intactas', async () => {
    const x = await insertFixture('vig-x', { publishedAt: '2026-06-01T00:00:00Z' });
    const y = await insertFixture('vig-y', { publishedAt: '2026-06-01T00:00:00Z' });

    const snapshot = async () =>
      (
        await pool.query<Record<string, unknown>>(
          `select id, public_name, duration_days, max_total_credits, release_frequency,
                  credits_per_release, publication_reason, published_at
             from public.trial_offer_versions where id in ($1, $2) order by id`,
          [x.id, y.id],
        )
      ).rows;
    const before = await snapshot();

    const clientA = await newClient('vig-a');
    const clientB = await newClient('vig-b');
    try {
      await begin(clientA);
      await clientA.query(
        "update public.trial_offer_settings set current_version_id = $1 where offer_key = 'trial_28d_v1'",
        [x.id],
      );

      await begin(clientB);
      const bPid = await pidOf(clientB);
      let secondError: unknown = null;
      const pending = clientB
        .query(
          "update public.trial_offer_settings set current_version_id = $1 where offer_key = 'trial_28d_v1'",
          [y.id],
        )
        .then(
          () => undefined,
          (error) => {
            secondError = error;
          },
        );

      const observed = await waitForLock(bPid);
      await clientA.query('COMMIT');
      await pending;
      await clientB.query('COMMIT').catch(() => undefined);

      expect(observed?.type).toBe('Lock');
      expect(secondError).toBeNull();

      const current = await pool.query<{ current_version_id: string }>(
        "select current_version_id from public.trial_offer_settings where offer_key = 'trial_28d_v1'",
      );
      expect([x.id, y.id]).toContain(current.rows[0].current_version_id);

      const after = await snapshot();
      expect(after).toEqual(before);
      for (const row of after) {
        expect(row.published_at).not.toBeNull();
      }
    } finally {
      await clientA.end().catch(() => undefined);
      await clientB.end().catch(() => undefined);
    }
  });
});
