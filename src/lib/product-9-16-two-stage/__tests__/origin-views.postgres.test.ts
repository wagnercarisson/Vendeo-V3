import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertF60Target } from "../../../../scripts/testing/f60-window.mjs";

const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) throw new Error("TEST_DATABASE_URL obrigatório (perfil f60)");

const pool = new Pool({ connectionString: assertF60Target(rawUrl, process.env)!.toString(), ssl: false });

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
    await client.query("begin");
    try {
      return await fn(client);
    } finally {
      await client.query("rollback").catch(() => undefined);
    }
  });
}

async function fixture(client: PoolClient) {
  const userId = randomUUID();
  const storeId = randomUUID();
  const campaignId = randomUUID();
  const operationId = randomUUID();
  const suffix = randomUUID();
  await client.query(
    `insert into auth.users (id, aud, role, email, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, now(), now())`,
    [userId, `p916test-${suffix}@f60.test`],
  );
  await client.query(
    `insert into public.stores (id, user_id, name, segment)
     values ($1, $2, $3, 'variedades-utilidades')`,
    [storeId, userId, `p916test-${suffix}`.slice(0, 60)],
  );
  await client.query(
    `insert into public.campaigns (id, store_id, status, product_name, storage_path)
     values ($1, $2, 'generating', $3, $4)`,
    [campaignId, storeId, `p916test-${suffix}`, `f60/${campaignId}`],
  );
  await client.query("select public.grant_credits($1, 5, 'f60-pg-test', $2, '{}'::jsonb)", [
    storeId,
    `f60-pg-grant-${suffix}`,
  ]);
  return { userId, storeId, campaignId, operationId };
}

async function rpc<T = Record<string, unknown>>(client: PoolClient, name: string, values: unknown[]) {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await client.query<{ result: T }>(
    `select public.${name}(${placeholders}) as result`,
    values,
  );
  return rows[0].result;
}

describe("F60 origem/views (Postgres)", () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      const { rows } = await client.query(
        `select to_regclass('public.product_generation_active_claims_v') as active,
                to_regclass('public.product_generation_claim_history_v') as history,
                to_regclass('public.product_generation_operation_outcomes_v') as outcomes`,
      );
      expect(rows[0]).toMatchObject({ active: expect.anything(), history: expect.anything(), outcomes: expect.anything() });
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("views respeitam status, anti-join e desfecho opcional", async () => {
    await inTransaction(async (client) => {
      const f = await fixture(client);
      await rpc(client, "product_9_16_open_operation", [f.storeId, f.campaignId, f.operationId]);

      const before = await client.query(
        `select
           (select count(*)::int from public.product_generation_active_claims_v where campaign_id=$1) as active,
           (select count(*)::int from public.product_generation_claim_history_v where campaign_id=$1) as history,
           (select count(*)::int from public.product_generation_operation_outcomes_v where campaign_id=$1) as outcomes`,
        [f.campaignId],
      );
      expect(before.rows[0]).toMatchObject({ active: 0, history: 0, outcomes: 0 });

      await rpc(client, "product_9_16_acquire_step", [
        f.campaignId,
        f.operationId,
        "base",
        randomUUID(),
        "primary",
      ]);
      const during = await client.query(
        `select
           (select count(*)::int from public.product_generation_active_claims_v where campaign_id=$1) as active,
           (select count(*)::int from public.product_generation_claim_history_v where campaign_id=$1) as history,
           (select count(*)::int from public.product_generation_operation_outcomes_v where campaign_id=$1) as outcomes`,
        [f.campaignId],
      );
      expect(during.rows[0]).toMatchObject({ active: 1, history: 1, outcomes: 0 });

      const sources = await client.query<{ source: string }>(
        `select source from public.product_generation_claim_history_v where campaign_id=$1`,
        [f.campaignId],
      );
      expect(sources.rows.map((r) => r.source)).toEqual(["9_16_two_stage"]);
    });
  });

  it("funções são SECURITY DEFINER com search_path vazio e helper interno", async () => {
    await withClient(async (client) => {
      const { rows } = await client.query<{
        prosecdef: boolean;
        proconfig: string[] | null;
      }>(
        `select prosecdef, proconfig from pg_proc
          where pronamespace='public'::regnamespace
            and proname in (
              'product_9_16_open_operation','product_9_16_acquire_step',
              'product_9_16_finish_step','product_9_16_record_outcome',
              'product_9_16_resume_operation','product_abandon_residual_attempts'
            )`,
      );
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row.prosecdef).toBe(true);
        expect(row.proconfig ?? []).toContain('search_path=""');
      }
      const priv = await client.query<{ exec: boolean }>(
        `select has_function_privilege('service_role',
          'public.product_abandon_residual_attempts(uuid,uuid)', 'execute') as exec`,
      );
      expect(priv.rows[0].exec).toBe(false);
    });
  });
});
