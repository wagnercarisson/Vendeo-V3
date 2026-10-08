// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";

// F56.2b1a — Plano 05: provas transacionais REAIS na instância descartável
// isolada (`vendeo-f562a-isolated`, API 127.0.0.1:56321, DB 56322). Requer o
// runner que expõe as credenciais server-side; falha fechada sem elas.

const LOCAL_API_URL = "http://127.0.0.1:56321";

let supabase: SupabaseClient;
let pg: PgClient;
let pg2: PgClient;

let storeId: string;
let otherStoreId: string;
let emptyStoreId: string;
let campaignId: string;
let otherCampaignId: string;
let emptyCampaignId: string;

const retainedOperations: Array<{ campaign: string; operation: string }> = [];

async function insertFixture(
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase.from(table).insert(values).select("id").single();
  if (error || !data) throw new Error(`fixture_insert_failed:${table}:${error?.message}`);
  return (data as { id: string }).id;
}

// `stores.user_id` é único: cada loja precisa do próprio dono.
async function createStore(name: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: `f56-2b1a-${randomUUID()}@example.invalid`,
    password: randomUUID(),
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`fixture_auth_failed:${error?.message}`);
  return insertFixture("stores", {
    user_id: data.user.id,
    name,
    segment: "outros",
    is_test_store: true,
  });
}

async function setCredits(store: string, bonus: number): Promise<void> {
  await pg.query(
    `INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
     VALUES ($1, $2, $2, 0)
     ON CONFLICT (store_id) DO UPDATE SET bonus_balance = EXCLUDED.bonus_balance, balance = EXCLUDED.balance`,
    [store, bonus],
  );
}

async function availableCredits(store: string): Promise<number> {
  const { rows } = await pg.query<{ bonus_balance: number; purchased_balance: number }>(
    "SELECT bonus_balance, purchased_balance FROM public.credit_balances WHERE store_id = $1",
    [store],
  );
  const row = rows[0];
  return (row?.bonus_balance ?? 0) + (row?.purchased_balance ?? 0);
}

async function deductionCount(store: string): Promise<number> {
  const { rows } = await pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.credit_transactions WHERE store_id = $1 AND type = 'deduction'",
    [store],
  );
  return rows[0].n;
}

async function operationRow(campaign: string, operation: string) {
  const result = (await pg.query(
    "SELECT status, amount, credit_tx_id, refund_tx_id FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1 AND operation_id = $2",
    [campaign, operation],
  )) as {
    rows: Array<{
      status: string;
      amount: number;
      credit_tx_id: string | null;
      refund_tx_id: string | null;
    }>;
  };
  return result.rows[0] ?? null;
}

async function callJson(
  sql: string,
  params: unknown[],
  client: PgClient = pg,
): Promise<Record<string, unknown>> {
  const result = (await client.query(sql, params as never[])) as {
    rows: Array<{ r: Record<string, unknown> }>;
  };
  return result.rows[0].r;
}

function reserve(store: string, campaign: string, operation: string, amount = 1, client: PgClient = pg) {
  return callJson(
    "SELECT public.product_1_1_reserve_credit_operation($1, $2, $3, $4, '{}'::jsonb) AS r",
    [store, campaign, operation, amount],
    client,
  );
}

function markArt(campaign: string, operation: string, client: PgClient = pg) {
  return callJson(
    "SELECT public.product_1_1_mark_campaign_credit_art_uploaded($1, $2) AS r",
    [campaign, operation],
    client,
  );
}

function deliver(campaign: string, operation: string, client: PgClient = pg) {
  return callJson(
    "SELECT public.product_1_1_deliver_campaign_credit_operation($1, $2) AS r",
    [campaign, operation],
    client,
  );
}

function refund(campaign: string, operation: string, reason = "test", client: PgClient = pg) {
  return callJson(
    "SELECT public.product_1_1_refund_campaign_credit_operation($1, $2, $3) AS r",
    [campaign, operation, reason],
    client,
  );
}

function reconcile(timeoutMinutes = 30, client: PgClient = pg) {
  return callJson(
    "SELECT public.product_1_1_reconcile_campaign_credit_operations($1) AS r",
    [timeoutMinutes],
    client,
  );
}

async function expectRejects(promise: Promise<unknown>, code: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toContain(code);
}

beforeAll(async () => {
  const url = process.env.P1_1_ISOLATED_SUPABASE_URL;
  const serviceRoleKey = process.env.P1_1_ISOLATED_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.P1_1_ISOLATED_DATABASE_URL;

  if (!url || !serviceRoleKey || !databaseUrl) {
    throw new Error("isolated_integration_requires_runner_and_preflight");
  }
  if (url !== LOCAL_API_URL) throw new Error("isolated_integration_api_url_mismatch");
  const parsed = new URL(databaseUrl);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.port !== "56322") {
    throw new Error("isolated_integration_database_url_mismatch");
  }

  supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  pg = new PgClient({ connectionString: databaseUrl });
  pg2 = new PgClient({ connectionString: databaseUrl });
  await pg.connect();
  await pg2.connect();

  const migrations = await pg.query<{ version: string }>(
    "SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ($1, $2) ORDER BY version",
    ["20261008000001", "20261008000002"],
  );
  expect(migrations.rows.map((row) => row.version)).toEqual([
    "20261008000001",
    "20261008000002",
  ]);

  const token = randomUUID();
  storeId = await createStore(`F56.2b1a ${token.slice(0, 8)}`);
  otherStoreId = await createStore(`F56.2b1a other ${randomUUID().slice(0, 8)}`);
  emptyStoreId = await createStore(`F56.2b1a empty ${randomUUID().slice(0, 8)}`);
  campaignId = await insertFixture("campaigns", {
    store_id: storeId,
    status: "ready",
    product_name: "Fixture",
    storage_path: `${storeId}/fixture/out.jpg`,
  });
  otherCampaignId = await insertFixture("campaigns", {
    store_id: otherStoreId,
    status: "ready",
    product_name: "Fixture other",
    storage_path: `${otherStoreId}/fixture/out.jpg`,
  });
  emptyCampaignId = await insertFixture("campaigns", {
    store_id: emptyStoreId,
    status: "ready",
    product_name: "Fixture empty",
    storage_path: `${emptyStoreId}/fixture/out.jpg`,
  });

  await setCredits(storeId, 100);
  await setCredits(otherStoreId, 100);
  await setCredits(emptyStoreId, 0);
});

afterAll(async () => {
  await pg?.end();
  await pg2?.end();
});

describe("F56.2b1a — operação de crédito Produto 1:1 (Postgres isolado real)", () => {
  it("reserva válida cria estado `reserved`, deduz 1 crédito e grava idempotência COMPOSTA no ledger", async () => {
    const operation = randomUUID();
    retainedOperations.push({ campaign: campaignId, operation });

    const beforeBalance = await availableCredits(storeId);
    const beforeDeductions = await deductionCount(storeId);

    const result = await reserve(storeId, campaignId, operation);
    expect(result).toMatchObject({ success: true, idempotent: false, status: "reserved", amount: 1 });

    const row = await operationRow(campaignId, operation);
    expect(row).toMatchObject({ status: "reserved", amount: 1 });
    expect(await availableCredits(storeId)).toBe(beforeBalance - 1);
    expect(await deductionCount(storeId)).toBe(beforeDeductions + 1);

    const { rows } = await pg.query<{ idempotency_key: string }>(
      "SELECT idempotency_key FROM public.credit_transactions WHERE store_id = $1 AND idempotency_key = $2",
      [storeId, `p1_1_reserve_${campaignId}_${operation}`],
    );
    expect(rows).toHaveLength(1);
  });

  it("rollback integral dentro da transação: nada é criado nem cobrado", async () => {
    const operation = randomUUID();
    const beforeBalance = await availableCredits(storeId);
    const beforeDeductions = await deductionCount(storeId);

    await pg.query("BEGIN");
    await reserve(storeId, campaignId, operation, 1, pg);
    await pg.query("ROLLBACK");

    expect(await operationRow(campaignId, operation)).toBeNull();
    expect(await availableCredits(storeId)).toBe(beforeBalance);
    expect(await deductionCount(storeId)).toBe(beforeDeductions);
  });

  it("falha ATÔMICA sem transação válida: saldo insuficiente não cria estado nem cobra", async () => {
    const operation = randomUUID();
    const beforeDeductions = await deductionCount(emptyStoreId);

    await expectRejects(reserve(emptyStoreId, emptyCampaignId, operation), "credit_reservation_missing_tx");

    expect(await deductionCount(emptyStoreId)).toBe(beforeDeductions);
    expect(await availableCredits(emptyStoreId)).toBe(0);
    expect(await operationRow(emptyCampaignId, operation)).toBeNull();
  });

  it("campanha de outra loja é recusada sem reserva/estado", async () => {
    const operation = randomUUID();
    await expectRejects(reserve(storeId, otherCampaignId, operation), "campaign_store_mismatch");
    expect(await operationRow(otherCampaignId, operation)).toBeNull();
  });

  it("um único crédito por entrega: amount ≠ 1 é recusado; entregar finaliza exatamente 1", async () => {
    const operation = randomUUID();
    await expectRejects(reserve(storeId, campaignId, operation, 2), "invalid_credit_amount");
    expect(await operationRow(campaignId, operation)).toBeNull();

    retainedOperations.push({ campaign: campaignId, operation });
    await reserve(storeId, campaignId, operation);
    await markArt(campaignId, operation);
    const delivered = await deliver(campaignId, operation);
    expect(delivered).toMatchObject({ status: "delivered" });
    // delivered é terminal: não pode ser estornado.
    await expectRejects(refund(campaignId, operation), "delivered_not_refundable");
  });

  it("estorno restaura a reserva uma única vez", async () => {
    const operation = randomUUID();
    retainedOperations.push({ campaign: campaignId, operation });
    const beforeBalance = await availableCredits(storeId);

    await reserve(storeId, campaignId, operation);
    expect(await availableCredits(storeId)).toBe(beforeBalance - 1);

    const first = await refund(campaignId, operation, "rollback manual");
    expect(first).toMatchObject({ status: "refunded", idempotent: false });
    expect(await availableCredits(storeId)).toBe(beforeBalance);

    const second = await refund(campaignId, operation, "rollback manual");
    expect(second).toMatchObject({ status: "refunded", idempotent: true });
    expect(await availableCredits(storeId)).toBe(beforeBalance);
  });

  it("reservas equivalentes são idempotentes; concorrentes devolvem a MESMA operação sem cobrança dupla", async () => {
    const operation = randomUUID();
    retainedOperations.push({ campaign: campaignId, operation });
    const beforeDeductions = await deductionCount(storeId);

    // Sequencial idempotente.
    const first = await reserve(storeId, campaignId, operation);
    const second = await reserve(storeId, campaignId, operation);
    expect(second).toMatchObject({ success: true, idempotent: true, status: "reserved" });
    expect(first.operation_id).toBe(operation);
    expect(await deductionCount(storeId)).toBe(beforeDeductions + 1);

    // Concorrente (duas conexões) na mesma identidade → uma única operação/cobrança.
    const concurrentOperation = randomUUID();
    retainedOperations.push({ campaign: campaignId, operation: concurrentOperation });
    const beforeConcurrent = await deductionCount(storeId);

    const [a, b] = await Promise.all([
      reserve(storeId, campaignId, concurrentOperation, 1, pg),
      reserve(storeId, campaignId, concurrentOperation, 1, pg2),
    ]);
    expect(a.status).toBe("reserved");
    expect(b.status).toBe("reserved");
    expect([a.idempotent, b.idempotent].filter((v) => v === true).length).toBe(1);

    const { rows } = await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1 AND operation_id = $2",
      [campaignId, concurrentOperation],
    );
    expect(rows[0].n).toBe(1);
    expect(await deductionCount(storeId)).toBe(beforeConcurrent + 1);
  });

  it("reservas concorrentes de identidades distintas criam operações distintas", async () => {
    const opA = randomUUID();
    const opB = randomUUID();
    retainedOperations.push({ campaign: campaignId, operation: opA });
    retainedOperations.push({ campaign: campaignId, operation: opB });

    await Promise.all([
      reserve(storeId, campaignId, opA, 1, pg),
      reserve(storeId, campaignId, opB, 1, pg2),
    ]);

    expect(await operationRow(campaignId, opA)).not.toBeNull();
    expect(await operationRow(campaignId, opB)).not.toBeNull();
  });

  it("reconciliação ADIA: não estorna `reserved` por timeout nem operação com arte", async () => {
    // Operação `reserved` "antiga" (simula interrupção entre upload e registro de estado).
    const reservedOp = randomUUID();
    retainedOperations.push({ campaign: campaignId, operation: reservedOp });
    await reserve(storeId, campaignId, reservedOp);
    await pg.query(
      "UPDATE public.product_1_1_campaign_credit_operations SET updated_at = now() - interval '2 hours' WHERE campaign_id = $1 AND operation_id = $2",
      [campaignId, reservedOp],
    );

    // Operação com arte já registrada e antiga.
    const artOp = randomUUID();
    retainedOperations.push({ campaign: campaignId, operation: artOp });
    await reserve(storeId, campaignId, artOp);
    await markArt(campaignId, artOp);
    await pg.query(
      "UPDATE public.product_1_1_campaign_credit_operations SET updated_at = now() - interval '2 hours' WHERE campaign_id = $1 AND operation_id = $2",
      [campaignId, artOp],
    );

    const beforeBalance = await availableCredits(storeId);
    const report = await reconcile(30);
    expect(report).toMatchObject({ success: true, resolved: 0 });
    expect(Number(report.deferred_count)).toBeGreaterThanOrEqual(2);

    // Nada foi estornado; estados e saldo intactos.
    expect((await operationRow(campaignId, reservedOp))?.status).toBe("reserved");
    expect((await operationRow(campaignId, artOp))?.status).toBe("art_uploaded");
    expect(await availableCredits(storeId)).toBe(beforeBalance);

    // Resolução só por ação EXPLÍCITA (refund).
    const resolved = await refund(campaignId, reservedOp, "resolução explícita");
    expect(resolved).toMatchObject({ status: "refunded" });
    expect(await availableCredits(storeId)).toBe(beforeBalance + 1);
  });

  it("as fixtures append-only permanecem retidas no target isolado (sem DELETE individual)", async () => {
    expect(retainedOperations.length).toBeGreaterThan(0);
    for (const { campaign, operation } of retainedOperations) {
      expect(await operationRow(campaign, operation)).not.toBeNull();
    }
    const { rows } = await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.product_1_1_campaign_credit_operations",
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(retainedOperations.length);
  });

  it("privilégios mínimos: RPC só para service_role; ledger append-only bloqueia UPDATE real", async () => {
    const { rows } = await pg.query<{
      reserve_exec: boolean;
      anon_exec: boolean;
      table_update: boolean;
    }>(
      `SELECT
         has_function_privilege('service_role', 'public.product_1_1_reserve_credit_operation(uuid,uuid,uuid,integer,jsonb)', 'EXECUTE') AS reserve_exec,
         has_function_privilege('anon', 'public.product_1_1_reserve_credit_operation(uuid,uuid,uuid,integer,jsonb)', 'EXECUTE') AS anon_exec,
         has_table_privilege('service_role', 'public.product_1_1_campaign_credit_operations', 'UPDATE') AS table_update`,
    );
    expect(rows[0]).toEqual({ reserve_exec: true, anon_exec: false, table_update: true });

    // O ledger é append-only: um UPDATE real é bloqueado por trigger.
    await pg.query("BEGIN");
    let updateError: unknown;
    try {
      await pg.query(
        "UPDATE public.credit_transactions SET amount = amount WHERE id = (SELECT id FROM public.credit_transactions WHERE store_id = $1 LIMIT 1)",
        [storeId],
      );
    } catch (error) {
      updateError = error;
    }
    await pg.query("ROLLBACK");
    expect((updateError as Error | undefined)?.message).toContain("append-only");
  });
});
