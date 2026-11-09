import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluateF60Window, isHomologTarget } from "../../../../scripts/testing/f60-window.mjs";

/**
 * F60 / Plano 60-02 — contrato Postgres do controle de duas etapas.
 *
 * NÃO é executado sem autorização separada de alvo. O perfil `f60` exige
 * `F60_TEST_ALLOW_WRITES=1`; homolog exige NOVA `F60_HOMOLOG_AUTHORIZED=1` e
 * `F60_EXCLUSIVITY_WINDOW` vigente. A prova 60-01 já cobriu o comportamento
 * transacional; aqui validamos schema/RLS/grants/idempotência do módulo.
 */
const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) {
  throw new Error("TEST_DATABASE_URL obrigatório (perfil f60)");
}

function assertTarget(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL deve usar postgresql://");
  }
  if (isHomologTarget(url)) {
    if (process.env.F60_HOMOLOG_AUTHORIZED !== "1") {
      throw new Error("homolog exige NOVA F60_HOMOLOG_AUTHORIZED=1 (janela do 60-01 encerrada)");
    }
    const window = evaluateF60Window(process.env.F60_EXCLUSIVITY_WINDOW);
    if (window.status !== "active") {
      throw new Error(`homolog exige F60_EXCLUSIVITY_WINDOW vigente (${window.status})`);
    }
  } else if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("TEST_DATABASE_URL deve apontar para loopback");
  }
  if (process.env.F60_TEST_ALLOW_WRITES !== "1") {
    throw new Error("F60_TEST_ALLOW_WRITES=1 é obrigatório (a suíte grava fixtures)");
  }
  return url;
}

const target = assertTarget(rawUrl);
const pool = new Pool({ connectionString: target.toString(), ssl: false });

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

async function rpc<T = Record<string, unknown>>(
  client: PoolClient,
  name: string,
  values: unknown[],
): Promise<T> {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await client.query<{ result: T }>(
    `select public.${name}(${placeholders}) as result`,
    values,
  );
  return rows[0].result;
}

async function createFixture(client: PoolClient) {
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
  return { userId, storeId, campaignId, operationId, suffix };
}

describe("F60 contrato Postgres", () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      const { rows } = await client.query(
        `select
           to_regclass('public.product_9_16_two_stage_operations') is not null as ops,
           to_regclass('public.product_9_16_two_stage_steps') is not null as steps,
           to_regclass('public.product_9_16_two_stage_attempt_claims') is not null as claims,
           to_regclass('public.product_9_16_two_stage_outcomes') is not null as outcomes,
           to_regclass('public.product_generation_active_claims_v') is not null as active_v,
           to_regclass('public.product_generation_claim_history_v') is not null as history_v,
           to_regclass('public.product_generation_operation_outcomes_v') is not null as outcomes_v`,
      );
      expect(rows[0]).toMatchObject({
        ops: true,
        steps: true,
        claims: true,
        outcomes: true,
        active_v: true,
        history_v: true,
        outcomes_v: true,
      });
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("RLS/grants: service_role lê, não escreve; helper de abandono é interno", async () => {
    await withClient(async (client) => {
      const { rows } = await client.query(
        `select
           has_table_privilege('service_role', 'public.product_9_16_two_stage_operations', 'insert') as ins_ops,
           has_table_privilege('service_role', 'public.product_9_16_two_stage_operations', 'update') as upd_ops,
           has_table_privilege('service_role', 'public.product_9_16_two_stage_operations', 'delete') as del_ops,
           has_table_privilege('service_role', 'public.product_9_16_two_stage_operations', 'select') as sel_ops,
           has_function_privilege('service_role', 'public.product_abandon_residual_attempts(uuid,uuid)', 'execute') as exec_abandon`,
      );
      expect(rows[0]).toMatchObject({
        ins_ops: false,
        upd_ops: false,
        del_ops: false,
        sel_ops: true,
        exec_abandon: false,
      });
    });
  });

  it("funções são SECURITY DEFINER com search_path vazio", async () => {
    await withClient(async (client) => {
      const { rows } = await client.query<{
        proname: string;
        prosecdef: boolean;
        proconfig: string[] | null;
      }>(
        `select proname, prosecdef, proconfig
           from pg_proc
          where pronamespace = 'public'::regnamespace
            and proname in (
              'product_9_16_open_operation',
              'product_9_16_acquire_step',
              'product_9_16_finish_step',
              'product_9_16_record_outcome',
              'product_9_16_resume_operation',
              'product_abandon_residual_attempts'
            )`,
      );
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row.prosecdef).toBe(true);
        expect(row.proconfig ?? []).toContain('search_path=""');
      }
    });
  });

  it("abertura é idempotente e base concluída mantém crédito reservado", async () => {
    await inTransaction(async (client) => {
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

      const opened = await rpc<Record<string, unknown>>(client, "product_9_16_open_operation", [
        storeId,
        campaignId,
        operationId,
      ]);
      expect(opened.success).toBe(true);
      expect(opened.idempotent).toBe(false);

      const replay = await rpc<Record<string, unknown>>(client, "product_9_16_open_operation", [
        storeId,
        campaignId,
        operationId,
      ]);
      expect(replay.success).toBe(true);
      expect(replay.idempotent).toBe(true);

      const acquired = await rpc<Record<string, unknown>>(client, "product_9_16_acquire_step", [
        campaignId,
        operationId,
        "base",
        randomUUID(),
        "primary",
      ]);
      expect(acquired.acquired).toBe(true);
      expect(acquired.authorization).toBe("execute");

      const finished = await rpc<Record<string, unknown>>(client, "product_9_16_finish_step", [
        campaignId,
        operationId,
        acquired.attempt_token,
        "in_progress",
        "completed",
        null,
      ]);
      expect(finished.success).toBe(true);

      const { rows } = await client.query(
        `select c.status as credit_status, s.status as base_status
           from public.product_1_1_campaign_credit_operations c
           join public.product_9_16_two_stage_steps s
             on s.campaign_id = c.campaign_id and s.operation_id = c.operation_id
          where c.campaign_id = $1 and c.operation_id = $2 and s.stage = 'base'`,
        [campaignId, operationId],
      );
      expect(rows[0]).toMatchObject({ credit_status: "reserved", base_status: "done" });
    });
  });

  it("CAS rejeita token divergente e transição após conclusão", async () => {
    await inTransaction(async (client) => {
      const f = await createFixture(client);
      await rpc(client, "product_9_16_open_operation", [
        f.storeId,
        f.campaignId,
        f.operationId,
      ]);
      const acquired = await rpc<Record<string, unknown>>(client, "product_9_16_acquire_step", [
        f.campaignId,
        f.operationId,
        "base",
        randomUUID(),
        "primary",
      ]);
      const wrong = await rpc<Record<string, unknown>>(client, "product_9_16_finish_step", [
        f.campaignId,
        f.operationId,
        randomUUID(),
        "in_progress",
        "completed",
        null,
      ]);
      expect(wrong).toMatchObject({ success: false, reason: "invalid_transition" });

      const completed = await rpc<Record<string, unknown>>(client, "product_9_16_finish_step", [
        f.campaignId,
        f.operationId,
        acquired.attempt_token,
        "in_progress",
        "completed",
        null,
      ]);
      expect(completed.success).toBe(true);
      const again = await rpc<Record<string, unknown>>(client, "product_9_16_finish_step", [
        f.campaignId,
        f.operationId,
        acquired.attempt_token,
        "in_progress",
        "failed",
        "definitive",
      ]);
      expect(again).toMatchObject({ success: false, reason: "invalid_transition" });
    });
  });

  it("índice parcial impede segunda tentativa ativa", async () => {
    await inTransaction(async (client) => {
      const f = await createFixture(client);
      await rpc(client, "product_9_16_open_operation", [
        f.storeId,
        f.campaignId,
        f.operationId,
      ]);
      const first = await rpc<Record<string, unknown>>(client, "product_9_16_acquire_step", [
        f.campaignId,
        f.operationId,
        "base",
        randomUUID(),
        "primary",
      ]);
      expect(first.acquired).toBe(true);
      const second = await rpc<Record<string, unknown>>(client, "product_9_16_acquire_step", [
        f.campaignId,
        f.operationId,
        "base",
        randomUUID(),
        "primary",
      ]);
      expect(second).toMatchObject({ acquired: false, reason: "operation_in_progress" });
      const { rows } = await client.query<{ n: number }>(
        `select count(*)::int as n from public.product_9_16_two_stage_attempt_claims
          where campaign_id = $1 and operation_id = $2 and status = 'in_progress'`,
        [f.campaignId, f.operationId],
      );
      expect(rows[0].n).toBe(1);
    });
  });

  it("request_id é idempotente e conflita se o alvo divergir", async () => {
    await inTransaction(async (client) => {
      const f = await createFixture(client);
      await rpc(client, "product_9_16_open_operation", [
        f.storeId,
        f.campaignId,
        f.operationId,
      ]);
      const requestId = randomUUID();
      const first = await rpc<Record<string, unknown>>(client, "product_9_16_acquire_step", [
        f.campaignId,
        f.operationId,
        "base",
        requestId,
        "primary",
      ]);
      const replay = await rpc<Record<string, unknown>>(client, "product_9_16_acquire_step", [
        f.campaignId,
        f.operationId,
        "base",
        requestId,
        "primary",
      ]);
      expect(first.authorization).toBe("execute");
      expect(replay).toMatchObject({ acquired: false, authorization: "query_only", reason: null });
      const conflict = await rpc<Record<string, unknown>>(client, "product_9_16_acquire_step", [
        f.campaignId,
        f.operationId,
        "base",
        requestId,
        "fallback",
      ]);
      expect(conflict).toMatchObject({ acquired: false, reason: "operation_identity_conflict" });
    });
  });

  it("desfecho é idempotente e divergência é conflito", async () => {
    await inTransaction(async (client) => {
      const f = await createFixture(client);
      await rpc(client, "product_9_16_open_operation", [
        f.storeId,
        f.campaignId,
        f.operationId,
      ]);
      const first = await rpc<Record<string, unknown>>(client, "product_9_16_record_outcome", [
        f.campaignId,
        f.operationId,
        "base",
        "unknown",
        "ref-1",
      ]);
      const replay = await rpc<Record<string, unknown>>(client, "product_9_16_record_outcome", [
        f.campaignId,
        f.operationId,
        "base",
        "unknown",
        "ref-1",
      ]);
      expect(first.success).toBe(true);
      expect(replay).toMatchObject({ success: true, idempotent: true, outcome: "unknown" });
      const conflict = await rpc<Record<string, unknown>>(client, "product_9_16_record_outcome", [
        f.campaignId,
        f.operationId,
        "expansion",
        "failed",
        "ref-2",
      ]);
      expect(conflict).toMatchObject({ success: false, reason: "operation_identity_conflict" });
    });
  });

  it("escrita direta como service_role é recusada com 42501", async () => {
    await inTransaction(async (client) => {
      await client.query("set local role service_role");
      await expect(
        client.query(
          `insert into public.product_9_16_two_stage_operations
             (campaign_id, operation_id, store_id)
           values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid())`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      // O erro 42501 aborta a transação; NÃO executar RESET ROLE aqui (25P02).
      // O ROLLBACK de inTransaction encerra a transação e desfaz o SET LOCAL ROLE.
    });
  });
});
