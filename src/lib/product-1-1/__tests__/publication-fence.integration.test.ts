// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  pgCallJson,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b2b — Plano 08 (Recorte 1): FENCE de publicação — prova de Camada 2
 * (Postgres/Storage locais; provider SIMULADO). Cobre C1-a..h, incluindo a
 * EXCEÇÃO ADMINISTRATIVA auditada e a barreira pós-upload/pré-`mark`.
 *
 * Executado SOMENTE após a aplicação da migration no isolado (Task 6c), via
 * `run-f56-2b2b-isolated-integration.ps1 -SkipApply`.
 */

let ctx: IsolatedContext;
let storeId: string;

async function begin(campaign: string, operation: string) {
  return pgCallJson<{ acquired: boolean; token: string | null; publication_state: string }>(
    ctx.pg,
    "SELECT public.product_1_1_begin_publication($1::uuid,$2::uuid) AS r",
    [campaign, operation],
  );
}
async function mark(campaign: string, operation: string, token: string) {
  return pgCallJson<{ success: boolean; status: string }>(
    ctx.pg,
    "SELECT public.product_1_1_mark_campaign_credit_art_uploaded($1::uuid,$2::uuid,$3::uuid) AS r",
    [campaign, operation, token],
  );
}
async function deliver(campaign: string, operation: string, token: string) {
  return pgCallJson<{ success: boolean; status: string }>(
    ctx.pg,
    "SELECT public.product_1_1_deliver_campaign_credit_operation($1::uuid,$2::uuid,$3::uuid) AS r",
    [campaign, operation, token],
  );
}
async function abort(campaign: string, operation: string, token: string, phase: string) {
  return pgCallJson<{ success: boolean; reason?: string }>(
    ctx.pg,
    "SELECT public.product_1_1_abort_publication($1::uuid,$2::uuid,$3::uuid,$4::text) AS r",
    [campaign, operation, token, phase],
  );
}
async function markResultUnknown(campaign: string, operation: string, token: string) {
  return pgCallJson<{ success: boolean; reason?: string }>(
    ctx.pg,
    "SELECT public.product_1_1_mark_result_unknown($1::uuid,$2::uuid,$3::uuid) AS r",
    [campaign, operation, token],
  );
}
async function confirmExistingArt(campaign: string, operation: string, artKind: string) {
  return pgCallJson<{ success: boolean; status: string }>(
    ctx.pg,
    "SELECT public.product_1_1_confirm_existing_art($1::uuid,$2::uuid,$3::text) AS r",
    [campaign, operation, artKind],
  );
}
async function refundLedgerCount(): Promise<number> {
  const { rows } = await ctx.pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.credit_transactions WHERE store_id = $1 AND type = 'refund'",
    [storeId],
  );
  return rows[0].n;
}
async function recordFailed(campaign: string, operation: string): Promise<void> {
  await pgCallJson(
    ctx.pg,
    "SELECT public.product_1_1_record_generation_outcome($1::uuid,$2::uuid,'failed',$3::text) AS r",
    [campaign, operation, `IMG-FENCE-${campaign.slice(0, 8)}`],
  );
}
function evidence(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    origin: "server-derived",
    art_kind: "absent",
    execution_ended: true,
    state_epoch: 0,
    publication_state: "none",
    ...over,
  };
}

describe("F56.2b2b — Camada 2: FENCE de publicação (Recorte 1)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 40);
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("(C1-seq) begin → mark → deliver com TOKEN estável (dono)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    const begun = await begin(campaign, op);
    expect(begun.acquired).toBe(true);
    const token = begun.token as string;
    expect((await mark(campaign, op, token)).status).toBe("art_uploaded");
    expect((await deliver(campaign, op, token)).status).toBe("delivered");
    expect((await creditOperationRow(ctx.pg, campaign, op))?.status).toBe("delivered");
  }, 60_000);

  it("(C1-b) ordem inversa: refund primeiro ⇒ begin recusado (terminal)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    await pgCallJson(
      ctx.pg,
      "SELECT public.product_1_1_refund_campaign_credit_operation($1::uuid,$2::uuid,$3::text) AS r",
      [campaign, op, "confirmed_absent"],
    );
    await expect(begin(campaign, op)).rejects.toThrow(/operation_terminal/);
  }, 60_000);

  it("(C1-a) publicação ativa (in_flight) BLOQUEIA o encerramento; exceção admin termina", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    const begun = await begin(campaign, op);
    const token = begun.token as string;

    const refundBefore = await refundLedgerCount();
    // Automático/PF: bloqueado enquanto o fence está ativo.
    await recordFailed(campaign, op);
    await expect(
      pgCallJson(ctx.pg, "SELECT public.product_1_1_close_failed_operation($1::uuid,$2::uuid,'absent',$3::text) AS r", [
        campaign,
        op,
        "generation_failed",
      ]),
    ).rejects.toThrow(/publication_in_progress/);
    // Admin NÃO autorizado: bloqueado.
    await expect(
      pgCallJson(ctx.pg, "SELECT public.admin_resolve_product_1_1_pending($1,$2,$3,$4,$5,$6,$7::jsonb) AS r", [
        randomUUID(),
        campaign,
        op,
        "refund_once",
        "inconclusivo",
        randomUUID(),
        JSON.stringify(evidence({ state_epoch: 0 })),
      ]),
    ).rejects.toThrow(/publication_in_progress|evidence_stale/);
    expect(await refundLedgerCount()).toBe(refundBefore);

    // EXCEÇÃO ADMINISTRATIVA autorizada/auditada ⇒ TERMINAL (não reabre).
    const closed = await pgCallJson<{ success: boolean; status: string }>(
      ctx.pg,
      "SELECT public.admin_resolve_product_1_1_pending($1,$2,$3,$4,$5,$6,$7::jsonb) AS r",
      [
        randomUUID(),
        campaign,
        op,
        "refund_once",
        "inconclusivo autorizado",
        randomUUID(),
        JSON.stringify(evidence({ state_epoch: 0, authorized_abandon: true })),
      ],
    );
    expect(closed).toMatchObject({ success: true, status: "refunded" });
    expect(await refundLedgerCount()).toBe(refundBefore + 1);
    // Resultado tardio NÃO reabre.
    await expect(mark(campaign, op, token)).rejects.toThrow(/publication_not_owner|invalid_transition/);
  }, 90_000);

  it("(C1-c) metadados falham (result_unknown) ⇒ confirm_existing_art entrega SEM novo upload", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    const token = (await begin(campaign, op)).token as string;
    expect((await markResultUnknown(campaign, op, token)).success).toBe(true);
    const confirmed = await confirmExistingArt(campaign, op, "integral");
    expect(confirmed).toMatchObject({ success: true, status: "delivered" });
    expect((await creditOperationRow(ctx.pg, campaign, op))?.status).toBe("delivered");
  }, 60_000);

  it("(C1-d) timeout com upload EM VOO: result_unknown mantém proteção; 2º begin ⇒ acquired:false", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    const token = (await begin(campaign, op)).token as string;
    await markResultUnknown(campaign, op, token);
    const second = await begin(campaign, op);
    expect(second.acquired).toBe(false);
    // `abort` recusado (estado ≠ in_flight).
    expect((await abort(campaign, op, token, "before_upload")).success).toBe(false);
    // sonda ≠ integral ⇒ confirm não confirma.
    await expect(confirmExistingArt(campaign, op, "absent")).rejects.toThrow(/insufficient_evidence/);
  }, 60_000);

  it("(C1-e) aborto/confirmação ATRASADOS: token antigo ⇒ recusado", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    const token = (await begin(campaign, op)).token as string;
    await mark(campaign, op, token);
    await deliver(campaign, op, token);
    expect((await abort(campaign, op, token, "before_upload")).success).toBe(false);
    await expect(mark(campaign, op, token)).rejects.toThrow(/publication_not_owner/);
  }, 60_000);

  it("(C1-f) replays idempotentes: sem 2º ledger e sem reabrir", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    const token = (await begin(campaign, op)).token as string;
    await mark(campaign, op, token);
    // Replay de mark (já art_uploaded) ⇒ idempotente.
    expect((await mark(campaign, op, token)).success).toBe(true);
    await deliver(campaign, op, token);
    const refundBefore = await refundLedgerCount();
    await expect(deliver(campaign, op, token)).resolves.toMatchObject({ status: "delivered" });
    expect(await refundLedgerCount()).toBe(refundBefore);
  }, 60_000);

  it("(C1-h) histórico pré-fence (publication_state=none) ⇒ confirm_existing_art entrega", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const op = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, op);
    // Sem begin (histórico): estado 'none'.
    const confirmed = await confirmExistingArt(campaign, op, "integral");
    expect(confirmed).toMatchObject({ success: true, status: "delivered" });
  }, 60_000);
});
