import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { assertF60Target } from "../../../../scripts/testing/f60-window.mjs";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import {
  SupabasePendingOperationsRepository,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import { TwoStageFinancialService } from "../two-stage-financial-service";
import type { VerticalArtifactProbe } from "../two-stage-financial-service";
import { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import { asSupabaseClient, createPgSupabase } from "./pg-supabase";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => {
  const proxy = new Proxy({}, { get: () => undefined });
  return { supabaseAdmin: proxy, createServerClient: vi.fn(async () => proxy) };
});

const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) throw new Error("TEST_DATABASE_URL obrigatório (perfil f60)");

// Preflight compartilhado ANTES de qualquer conexão/pool: recusa remoto,
// protocolo não-Postgres, homolog sem autorização/janela e falta de writes.
const pool = new Pool({ connectionString: assertF60Target(rawUrl, process.env)!.toString(), ssl: false });

async function withRollback<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

async function fixture(client: PoolClient) {
  const userId = randomUUID();
  const storeId = randomUUID();
  const campaignId = randomUUID();
  const operationId = randomUUID();
  const suffix = randomUUID();
  await client.query(
    `insert into auth.users (id, aud, role, email, created_at, updated_at)
     values ($1,'authenticated','authenticated',$2,now(),now())`,
    [userId, `p916fin-${suffix}@f60.test`],
  );
  await client.query(
    `insert into public.stores (id,user_id,name,segment) values ($1,$2,$3,'variedades-utilidades')`,
    [storeId, userId, `p916fin-${suffix}`.slice(0, 60)],
  );
  await client.query(
    `insert into public.campaigns (id,store_id,status,product_name,storage_path)
     values ($1,$2,'generating',$3,$4)`,
    [campaignId, storeId, `p916fin-${suffix}`, `f60/${campaignId}`],
  );
  await client.query("select public.grant_credits($1,5,'f60-pg-test',$2,'{}'::jsonb)", [
    storeId,
    `f60-fin-grant-${suffix}`,
  ]);
  return { userId, storeId, campaignId, operationId };
}

function integralProbe(): VerticalArtifactProbe {
  return {
    probeVerticalArtifact: vi.fn(async () => ({
      kind: "integral" as const,
      format: "9:16" as const,
      width: 1080 as const,
      height: 1920 as const,
      mimeType: "image/jpeg" as const,
      storagePath: "vertical/art.jpg",
      evidenceRef: "vertical:1",
    })),
  };
}

function probeOf(kind: "absent" | "invalid" | "indeterminate"): VerticalArtifactProbe {
  return { probeVerticalArtifact: vi.fn(async () => ({ kind })) };
}

function artifactProberOf(vertical: VerticalArtifactProbe) {
  return {
    probeArtifact: async (input: {
      storeId: string;
      campaignId: string;
      operationId: string;
    }) => {
      const result = await vertical.probeVerticalArtifact(input);
      if (result.kind !== "integral") return result;
      return {
        kind: "integral" as const,
        ref: {
          storagePath: result.storagePath,
          width: result.width,
          height: result.height,
          mimeType: result.mimeType,
        },
        width: result.width,
        height: result.height,
        mimeType: result.mimeType,
        storagePath: result.storagePath,
      };
    },
  };
}

function build(client: PoolClient, vertical: VerticalArtifactProbe) {
  const supabase = asSupabaseClient(createPgSupabase(client));
  const repository = new SupabasePendingOperationsRepository(supabase, undefined, {
    resolveFormat: async () => ({ kind: "9:16" }),
    verticalArtifacts: artifactProberOf(vertical),
  });
  const service = new TwoStageFinancialService({
    client: supabase,
    credit: new ProductOneToOneCreditOperationClient(supabase),
    control: new ProductTwoStageOperationClient(supabase),
    repository,
  });
  return { service, repository, control: new ProductTwoStageOperationClient(supabase) };
}

async function counts(client: PoolClient, storeId: string) {
  const { rows } = await client.query<{ deductions: number; refunds: number; rows: number }>(
    `select count(*) filter (where type='deduction')::int as deductions,
            count(*) filter (where type='refund')::int as refunds,
            count(*)::int as rows
       from public.credit_transactions where store_id=$1`,
    [storeId],
  );
  return rows[0];
}

async function creditRow(client: PoolClient, campaignId: string, operationId: string) {
  const { rows } = await client.query<{ status: string; amount: number }>(
    `select status, amount from public.product_1_1_campaign_credit_operations
      where campaign_id=$1 and operation_id=$2`,
    [campaignId, operationId],
  );
  return rows[0];
}

async function openAndCompleteBase(control: ProductTwoStageOperationClient, f: Awaited<ReturnType<typeof fixture>>) {
  await control.open({ storeId: f.storeId, campaignId: f.campaignId, operationId: f.operationId });
  const base = await control.acquire({
    campaignId: f.campaignId,
    operationId: f.operationId,
    stage: "base",
    requestId: randomUUID(),
    target: "primary",
  });
  await control.finish({
    campaignId: f.campaignId,
    operationId: f.operationId,
    attemptToken: base.attemptToken as string,
    expectedStatus: "in_progress",
    status: "completed",
  });
}

async function finishExpansion(
  control: ProductTwoStageOperationClient,
  f: Awaited<ReturnType<typeof fixture>>,
  status: "completed" | "failed",
) {
  const expansion = await control.acquire({
    campaignId: f.campaignId,
    operationId: f.operationId,
    stage: "expansion",
    requestId: randomUUID(),
    target: "initial",
  });
  await control.finish({
    campaignId: f.campaignId,
    operationId: f.operationId,
    attemptToken: expansion.attemptToken as string,
    expectedStatus: "in_progress",
    status,
    failureClass: status === "failed" ? "definitive" : undefined,
  });
}

describe("F60 integração financeira pelo serviço real (Postgres)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("duas aberturas reservam UM crédito e uma transação", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const { service } = build(client, integralProbe());

      const first = await service.reserveOperationOnce(f);
      const second = await service.reserveOperationOnce(f);

      expect(first.authority.amount).toBe(1);
      expect(second.authority.amount).toBe(1);
      const row = await client.query<{ n: number }>(
        "select count(*)::int as n from public.product_1_1_campaign_credit_operations where campaign_id=$1",
        [f.campaignId],
      );
      expect(row.rows[0].n).toBe(1);
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });
    });
  });

  it("base done permanece reserved e não grava arte/entrega", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const { service, control } = build(client, integralProbe());
      await service.reserveOperationOnce(f);
      const base = await control.acquire({
        campaignId: f.campaignId,
        operationId: f.operationId,
        stage: "base",
        requestId: randomUUID(),
        target: "primary",
      });
      await control.finish({
        campaignId: f.campaignId,
        operationId: f.operationId,
        attemptToken: base.attemptToken as string,
        expectedStatus: "in_progress",
        status: "completed",
      });

      expect(await creditRow(client, f.campaignId, f.operationId)).toMatchObject({
        status: "reserved",
        amount: 1,
      });
      const { rows } = await client.query<{ publication_state: string }>(
        "select publication_state from public.product_1_1_campaign_credit_operations where campaign_id=$1",
        [f.campaignId],
      );
      expect(rows[0].publication_state).toBe("none");
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });
    });
  });

  it("expansão iniciada não reserva crédito adicional", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const { service, control } = build(client, integralProbe());
      await service.reserveOperationOnce(f);
      await openAndCompleteBase(control, f);
      await control.acquire({
        campaignId: f.campaignId,
        operationId: f.operationId,
        stage: "expansion",
        requestId: randomUUID(),
        target: "initial",
      });
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });
    });
  });

  it("entrega vertical confirma uma vez e replay não muta", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const vertical = integralProbe();
      const { service, control } = build(client, vertical);
      await openAndCompleteBase(control, f);
      await finishExpansion(control, f, "completed");

      const credit = new ProductOneToOneCreditOperationClient(asSupabaseClient(createPgSupabase(client)));
      const begin = await credit.beginPublication(f.campaignId, f.operationId);
      expect(begin.token).toBeTruthy();

      await expect(
        service.confirmOnVerticalDelivery({
          ...f,
          publicationToken: "",
          verticalArtifactProbe: vertical,
        }),
      ).rejects.toMatchObject({ code: "invalid_transition" });

      await expect(
        service.confirmOnVerticalDelivery({
          ...f,
          publicationToken: begin.token as string,
          verticalArtifactProbe: probeOf("absent"),
        }),
      ).rejects.toMatchObject({ code: "insufficient_evidence" });

      const delivered = await service.confirmOnVerticalDelivery({
        ...f,
        publicationToken: begin.token as string,
        verticalArtifactProbe: vertical,
      });
      expect(delivered.status).toBe("delivered");
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });

      const replay = await service.confirmOnVerticalDelivery({
        ...f,
        publicationToken: begin.token as string,
        verticalArtifactProbe: vertical,
      });
      expect(replay).toMatchObject({ status: "delivered", idempotent: true });
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });
    });
  });

  it("falha definitiva sem arte estorna uma vez; integral exige entrega", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const { service, control } = build(client, integralProbe());
      await openAndCompleteBase(control, f);
      await finishExpansion(control, f, "failed");
      await control.recordOutcome({
        campaignId: f.campaignId,
        operationId: f.operationId,
        stage: "expansion",
        outcome: "failed",
        supportReference: "f60-financial",
      });

      const integral = await service.refundOnDefinitiveFailure({
        ...f,
        verticalArtifactProbe: integralProbe(),
      });
      expect(integral.kind).toBe("delivery_required");
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });

      const invalid = await service.refundOnDefinitiveFailure({
        ...f,
        verticalArtifactProbe: probeOf("invalid"),
      });
      expect(invalid.kind).toBe("insufficient_evidence");

      const refunded = await service.refundOnDefinitiveFailure({
        ...f,
        verticalArtifactProbe: probeOf("absent"),
      });
      expect(refunded.kind).toBe("refunded");

      const replay = await service.refundOnDefinitiveFailure({
        ...f,
        verticalArtifactProbe: probeOf("absent"),
      });
      expect(replay.kind).toBe("refunded");
      expect(replay).toMatchObject({ state: { idempotent: true } });
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 1 });
    });
  });

  it("operação delivered recusa estorno", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const vertical = integralProbe();
      const { service, control } = build(client, vertical);
      await openAndCompleteBase(control, f);
      await finishExpansion(control, f, "completed");
      const credit = new ProductOneToOneCreditOperationClient(asSupabaseClient(createPgSupabase(client)));
      const begin = await credit.beginPublication(f.campaignId, f.operationId);
      await service.confirmOnVerticalDelivery({
        ...f,
        publicationToken: begin.token as string,
        verticalArtifactProbe: vertical,
      });

      // A RPC de encerramento recusa `delivered` levantando erro; em uma única
      // transação de teste isso aborta o bloco. O SAVEPOINT preserva o harness e
      // permite conferir que nada mudou após a recusa.
      await client.query("savepoint before_refund");
      try {
        await expect(
          service.refundOnDefinitiveFailure({
            ...f,
            verticalArtifactProbe: probeOf("absent"),
          }),
        ).rejects.toMatchObject({ code: "delivered_not_refundable" });
      } finally {
        await client.query("rollback to savepoint before_refund");
      }
      expect(await creditRow(client, f.campaignId, f.operationId)).toMatchObject({
        status: "delivered",
      });
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });
    });
  });

  it("unknown não estorna sozinho; resolução administrativa usa cliente/identidade e projeta", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const vertical = probeOf("absent");
      const { service, control } = build(client, vertical);
      await openAndCompleteBase(control, f);
      await finishExpansion(control, f, "failed");
      await control.recordOutcome({
        campaignId: f.campaignId,
        operationId: f.operationId,
        stage: "expansion",
        outcome: "unknown",
        supportReference: "f60-unknown",
      });

      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });
      const resolutionOperationId = randomUUID();
      const resolution = await service.resolveUnknown({
        actorId: f.userId,
        campaignId: f.campaignId,
        operationId: f.operationId,
        decision: "refund",
        reason: "desconhecido confirmado",
        resolutionOperationId,
      });
      expect(resolution).toMatchObject({ status: "refunded", action: "refund_once" });
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 1 });

      const replay = await service.resolveUnknown({
        actorId: f.userId,
        campaignId: f.campaignId,
        operationId: f.operationId,
        decision: "refund",
        reason: "desconhecido confirmado",
        resolutionOperationId,
      });
      expect(replay).toMatchObject({ status: "refunded", idempotent: true });
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 1 });
    });
  }, 60_000);

  it("origem nova SEM sonda vertical não entrega nem estorna pela via administrativa", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const supabase = asSupabaseClient(createPgSupabase(client));
      const squareCalls = vi.fn(async () => ({
        kind: "integral" as const,
        ref: { storagePath: "square", width: 1024, height: 1024, mimeType: "image/jpeg" },
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
        storagePath: "square",
      }));
      const repository = new SupabasePendingOperationsRepository(
        supabase,
        { probeArtifact: squareCalls },
        { resolveFormat: async () => ({ kind: "1:1" }) },
      );
      const service = new TwoStageFinancialService({
        client: supabase,
        credit: new ProductOneToOneCreditOperationClient(supabase),
        control: new ProductTwoStageOperationClient(supabase),
        repository,
      });
      await service.reserveOperationOnce(f);

      await expect(
        service.resolveUnknown({
          actorId: f.userId,
          campaignId: f.campaignId,
          operationId: f.operationId,
          decision: "deliver",
          reason: "arte quadrada existente",
          resolutionOperationId: randomUUID(),
          verticalArtifactProbe: integralProbe(),
        }),
      ).rejects.toMatchObject({ code: "format_unavailable" });
      expect(squareCalls).not.toHaveBeenCalled();
      expect(await creditRow(client, f.campaignId, f.operationId)).toMatchObject({
        status: "reserved",
      });
      expect(await counts(client, f.storeId)).toMatchObject({ deductions: 1, refunds: 0 });
    });
  }, 60_000);
});
