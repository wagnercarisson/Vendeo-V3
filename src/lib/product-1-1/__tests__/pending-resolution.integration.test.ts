// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { ProductOneToOneArtifactStore, artifactStoragePath } from "../artifact/artifact-store";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { SupabasePendingOperationsRepository } from "../pending/pending-operations-repository";
import {
  PendingOperationResolutionError,
  resolvePendingOperation,
} from "../pending/resolve-pending-operation";
import {
  closeIsolatedContext,
  createAuthUser,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  jpeg1024DataUrl,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b1b — Plano 09 / Task 2: resolução administrativa AUDITADA e idempotente
 * (Postgres real) + F2 (identidade GLOBAL), C4 (acquire × resolução), C2
 * (refund só com ausência CONFIRMADA), I2 (precedência terminal) e E1/D13 (claim
 * residual BLOQUEADO fail-closed).
 */

let ctx: IsolatedContext;
let storeId: string;
let actorId: string;

const repo = () => new SupabasePendingOperationsRepository(ctx.supabase);
const resolve = (input: Record<string, unknown>) =>
  resolvePendingOperation(input as never, { client: ctx.supabase, repository: repo() });

async function operationWithArt(campaign: string, operation: string): Promise<void> {
  await reserveCredit(ctx.pg, storeId, campaign, operation);
  await new ProductOneToOneArtifactStore(ctx.supabase).storeArtifact({
    storeId,
    campaignId: campaign,
    operationId: operation,
    imageDataUrl: await jpeg1024DataUrl(),
  });
}

async function auditRows(operationId: string): Promise<Array<{ action: string; metadata: Record<string, unknown> }>> {
  const { rows } = await ctx.pg.query<{ action: string; metadata: Record<string, unknown> }>(
    "SELECT action, metadata FROM public.admin_audit_log WHERE operation_id = $1",
    [operationId],
  );
  return rows;
}

describe("F56.2b1b — pending resolution (Postgres real)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 30);
    actorId = await createAuthUser(ctx.supabase);
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("resolve UMA vez, audita a evidência+transição e é idempotente no replay", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await operationWithArt(campaign, operationId);
    const resolutionOperationId = randomUUID();

    const result = await resolve({
      actorId,
      campaignId: campaign,
      operationId,
      action: "deliver_existing_art",
      reason: "arte encontrada",
      resolutionOperationId,
    });
    expect(result).toMatchObject({ status: "delivered", idempotent: false });
    expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("delivered");
    const audits = await auditRows(resolutionOperationId);
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("product_1_1_pending_resolution");
    expect(audits[0].metadata).toMatchObject({ success: true, status: "delivered" });

    // Replay EQUIVALENTE ⇒ idempotente (um efeito/uma auditoria).
    const replay = await resolve({
      actorId,
      campaignId: campaign,
      operationId,
      action: "deliver_existing_art",
      reason: "arte encontrada",
      resolutionOperationId,
    });
    expect(replay).toMatchObject({ status: "delivered", idempotent: true });
    expect(await auditRows(resolutionOperationId)).toHaveLength(1);
  }, 60_000);

  it("`deliver_existing_art` SEM arte (ausente) é recusado; `refund_once` sem encerramento é recusado", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operationId);

    // Sem arte ⇒ evidência insuficiente para entregar.
    await expect(
      resolve({
        actorId,
        campaignId: campaign,
        operationId,
        action: "deliver_existing_art",
        reason: "sem arte",
        resolutionOperationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(PendingOperationResolutionError);

    // Claim `in_progress` residual ⇒ execução ativa ⇒ resolução BLOQUEADA (E1/D13).
    await new ProductOneToOneAttemptStartClient(ctx.supabase).acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 1,
    });
    let caught: unknown;
    try {
      await resolve({
        actorId,
        campaignId: campaign,
        operationId,
        action: "refund_once",
        reason: "tentativa de estorno",
        resolutionOperationId: randomUUID(),
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PendingOperationResolutionError);
    expect((caught as PendingOperationResolutionError).code).toBe("operation_in_progress");
    // Nada foi estornado nem entregue.
    expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("reserved");
  }, 60_000);

  it("C2 — `refund_once` exige ausência CONFIRMADA (objeto não íntegro recusa)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operationId);

    // Objeto PRESENTE mas NÃO íntegro (PNG no path `.jpg`) ⇒ `invalid` ⇒ recusa.
    const path = artifactStoragePath(storeId, campaign, operationId);
    const png = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 4, g: 4, b: 4 } } })
      .png()
      .toBuffer();
    await ctx.supabase.storage.from("campaign-images").upload(path, png, { contentType: "image/png", upsert: true });

    await expect(
      resolve({
        actorId,
        campaignId: campaign,
        operationId,
        action: "refund_once",
        reason: "estorno indevido",
        resolutionOperationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(PendingOperationResolutionError);
    expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("reserved");

    // Sem objeto (ausência CONFIRMADA) + sem claim ⇒ estorno ÚNICO permitido.
    const campaign2 = await createCampaign(ctx.supabase, storeId);
    const operation2 = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign2, operation2);
    const refunded = await resolve({
      actorId,
      campaignId: campaign2,
      operationId: operation2,
      action: "refund_once",
      reason: "ausência confirmada",
      resolutionOperationId: randomUUID(),
    });
    expect(refunded).toMatchObject({ status: "refunded" });
    expect((await creditOperationRow(ctx.pg, campaign2, operation2))?.status).toBe("refunded");
  }, 60_000);

  it("F2 — identidade GLOBAL: o MESMO `resolution_operation_id` em operações DIFERENTES ⇒ um efeito + conflito", async () => {
    const campaignA = await createCampaign(ctx.supabase, storeId);
    const operationA = randomUUID();
    await operationWithArt(campaignA, operationA);
    const campaignB = await createCampaign(ctx.supabase, storeId);
    const operationB = randomUUID();
    await operationWithArt(campaignB, operationB);
    const shared = randomUUID();

    const settled = await Promise.allSettled([
      resolve({
        actorId,
        campaignId: campaignA,
        operationId: operationA,
        action: "deliver_existing_art",
        reason: "resolução A",
        resolutionOperationId: shared,
      }),
      resolve({
        actorId,
        campaignId: campaignB,
        operationId: operationB,
        action: "deliver_existing_art",
        reason: "resolução B",
        resolutionOperationId: shared,
      }),
    ]);

    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    const rejected = settled.filter((s) => s.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(PendingOperationResolutionError);
    expect((rejectedReason as PendingOperationResolutionError).code).toBe(
      "operation_identity_conflict",
    );

    // Exatamente UMA auditoria para o id compartilhado (nunca unique_violation/500).
    expect(await auditRows(shared)).toHaveLength(1);

    // Um id JÁ USADO por OUTRA ação administrativa ⇒ conflito (independente de `action`).
    const usedByOther = randomUUID();
    await ctx.pg.query(
      `INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, operation_id, metadata)
       VALUES ($1, 'feature_flag_update', 'user', $1, 'outra acao', $2, '{}'::jsonb)`,
      [actorId, usedByOther],
    );
    const campaignC = await createCampaign(ctx.supabase, storeId);
    const operationC = randomUUID();
    await operationWithArt(campaignC, operationC);
    let caught: unknown;
    try {
      await resolve({
        actorId,
        campaignId: campaignC,
        operationId: operationC,
        action: "deliver_existing_art",
        reason: "colisão",
        resolutionOperationId: usedByOther,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PendingOperationResolutionError);
    expect((caught as PendingOperationResolutionError).code).toBe("operation_identity_conflict");
  }, 90_000);

  it("C4 — aquisição de tentativa × resolução serializam na MESMA trava (um único efeito)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await operationWithArt(campaign, operationId);
    const attempts = new ProductOneToOneAttemptStartClient(ctx.supabase);

    await Promise.allSettled([
      attempts.acquire({ campaignId: campaign, operationId, target: "primary", attemptNumber: 1 }),
      resolve({
        actorId,
        campaignId: campaign,
        operationId,
        action: "deliver_existing_art",
        reason: "corrida",
        resolutionOperationId: randomUUID(),
      }),
    ]);

    const credit = await creditOperationRow(ctx.pg, campaign, operationId);
    const { rows: claims } = await ctx.pg.query<{ status: string }>(
      "SELECT status FROM public.product_1_1_generation_attempt_claims WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    const delivered = credit?.status === "delivered";
    const hasActiveClaim = claims.some((claim) => claim.status === "in_progress");
    // Estado consistente: OU entregue, OU com claim ativo — nunca ambos.
    expect(delivered !== hasActiveClaim).toBe(true);
  }, 60_000);

  it("I2 — a leitura exibe o estado TERMINAL mesmo com `outcome='unknown'` histórico", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await operationWithArt(campaign, operationId);
    const attempts = new ProductOneToOneAttemptStartClient(ctx.supabase);
    await attempts.recordOperationOutcome({
      campaignId: campaign,
      operationId,
      outcome: "unknown",
      supportReference: "IMG-001-historico",
    });

    const resolved = await resolve({
      actorId,
      campaignId: campaign,
      operationId,
      action: "deliver_existing_art",
      reason: "entrega após desconhecido",
      resolutionOperationId: randomUUID(),
    });
    expect(resolved).toMatchObject({ status: "delivered" });

    const state = await attempts.getCampaignOperation(campaign);
    expect(state).toMatchObject({ status: "delivered", terminal: true, unknown: false, outcome: null });
  }, 60_000);

  it("E1/D13 — claim `in_progress` residual BLOQUEIA a resolução (fail-closed, sem evidência inventada)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    await operationWithArt(campaign, operationId);
    // Claim ativo (execução considerada NÃO encerrada — idade/timeout NÃO é evidência).
    await new ProductOneToOneAttemptStartClient(ctx.supabase).acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 1,
    });

    let caught: unknown;
    try {
      await resolve({
        actorId,
        campaignId: campaign,
        operationId,
        action: "deliver_existing_art",
        reason: "tentativa de resolução",
        resolutionOperationId: randomUUID(),
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PendingOperationResolutionError);
    expect(["operation_in_progress", "execution_not_ended"]).toContain(
      (caught as PendingOperationResolutionError).code,
    );
    // Nada foi entregue/estornado: a limitação da b1b permanece BLOQUEADA.
    expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("reserved");
  }, 60_000);
});
