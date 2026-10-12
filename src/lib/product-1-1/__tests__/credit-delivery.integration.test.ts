// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { CreditOperationError } from "../credit-operation/types";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import {
  attemptClaimRows,
  availableCredits,
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  deductionCount,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b1b — Plano 09 / Task 2: crédito (um por entrega, estorno único,
 * reenvio-consulta sem mutação). Postgres real; provider não é chamado.
 */

let ctx: IsolatedContext;
let storeId: string;

const reserve = (campaign: string, operation: string) =>
  new ProductOneToOneCreditOperationClient(ctx.supabase).reserve({
    storeId,
    campaignId: campaign,
    operationId: operation,
  });

describe("F56.2b1b — credit delivery (Postgres real)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 10);
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("reserva reduz o saldo; `delivered` consome exatamente um crédito", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const before = await availableCredits(ctx.pg, storeId);

    const reserved = await reserve(campaign, operationId);
    expect(reserved).toMatchObject({ status: "reserved", amount: 1, consumedDefinitive: false });
    expect(await availableCredits(ctx.pg, storeId)).toBe(before - 1);
    expect(await deductionCount(ctx.pg, storeId)).toBe(1);

    await ctx.pg.query(
      "SELECT public.product_1_1_mark_campaign_credit_art_uploaded($1, $2) AS r",
      [campaign, operationId],
    );
    const delivered = await new ProductOneToOneCreditOperationClient(ctx.supabase).deliver(
      campaign,
      operationId,
    );
    expect(delivered).toMatchObject({ status: "delivered", consumedDefinitive: true });
    // Um crédito por entrega — nenhuma segunda dedução.
    expect(await deductionCount(ctx.pg, storeId)).toBe(1);
    expect(await availableCredits(ctx.pg, storeId)).toBe(before - 1);
  });

  it("`refunded` restaura o saldo uma única vez", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const before = await availableCredits(ctx.pg, storeId);

    const client = new ProductOneToOneCreditOperationClient(ctx.supabase);
    await reserve(campaign, operationId);
    expect(await availableCredits(ctx.pg, storeId)).toBe(before - 1);

    const refunded = await client.refund(campaign, operationId, "confirmed_absent");
    expect(refunded).toMatchObject({ status: "refunded" });
    expect(await availableCredits(ctx.pg, storeId)).toBe(before);

    // Replay idempotente: NÃO restaura duas vezes.
    const replay = await client.refund(campaign, operationId, "confirmed_absent");
    expect(replay).toMatchObject({ status: "refunded", idempotent: true });
    expect(await availableCredits(ctx.pg, storeId)).toBe(before);
  });

  it("tentativas/fallback NÃO criam nova reserva (saldo/ledger inalterados)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const before = await availableCredits(ctx.pg, storeId);
    await reserve(campaign, operationId);
    const afterReserve = await availableCredits(ctx.pg, storeId);
    const deductionsAfterReserve = await deductionCount(ctx.pg, storeId);

    const attempts = new ProductOneToOneAttemptStartClient(ctx.supabase);
    const first = await attempts.acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 1,
    });
    expect(first.acquired).toBe(true);
    await attempts.finish({ campaignId: campaign, operationId, attemptNumber: 1, status: "failed" });
    const second = await attempts.acquire({
      campaignId: campaign,
      operationId,
      target: "fallback",
      attemptNumber: 2,
    });
    expect(second).toMatchObject({ acquired: true, target: "fallback" });
    await attempts.finish({ campaignId: campaign, operationId, attemptNumber: 2, status: "failed" });

    // As tentativas NÃO tocam o crédito.
    expect(await availableCredits(ctx.pg, storeId)).toBe(afterReserve);
    expect(await deductionCount(ctx.pg, storeId)).toBe(deductionsAfterReserve);
    expect(before - 1).toBe(afterReserve);
    expect(await attemptClaimRows(ctx.pg, campaign, operationId)).toHaveLength(2);
    const row = await creditOperationRow(ctx.pg, campaign, operationId);
    expect(row?.status).toBe("reserved");
  });

  it("reenvio (`get`) é somente-consulta: NÃO muta o estado", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await reserve(campaign, operationId);
    const client = new ProductOneToOneCreditOperationClient(ctx.supabase);

    const first = await client.get(campaign, operationId);
    const second = await client.get(campaign, operationId);
    expect(first).toMatchObject({ status: "reserved" });
    expect(second).toMatchObject({ status: "reserved" });
    const row = await creditOperationRow(ctx.pg, campaign, operationId);
    expect(row?.status).toBe("reserved");
  });

  it("operação terminal recusa continuar; `delivered` não é reembolsável", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const client = new ProductOneToOneCreditOperationClient(ctx.supabase);
    await reserve(campaign, operationId);
    await ctx.pg.query(
      "SELECT public.product_1_1_mark_campaign_credit_art_uploaded($1, $2) AS r",
      [campaign, operationId],
    );
    await client.deliver(campaign, operationId);

    const attempts = new ProductOneToOneAttemptStartClient(ctx.supabase);
    const refused = await attempts.acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 1,
    });
    expect(refused).toMatchObject({ acquired: false, reason: "operation_terminal" });

    let caught: unknown;
    try {
      await client.refund(campaign, operationId, "nope");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CreditOperationError);
    expect((caught as CreditOperationError).code).toBe("delivered_not_refundable");
  });

  it("operação com resultado DESCONHECIDO recusa nova tentativa", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await reserve(campaign, operationId);
    const attempts = new ProductOneToOneAttemptStartClient(ctx.supabase);
    await attempts.recordOperationOutcome({ campaignId: campaign, operationId, outcome: "unknown" });

    const refused = await attempts.acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 1,
    });
    expect(refused).toMatchObject({ acquired: false, reason: "operation_unknown" });

    const state = await attempts.getCampaignOperation(campaign);
    expect(state).toMatchObject({ unknown: true, terminal: false });
  });
});
