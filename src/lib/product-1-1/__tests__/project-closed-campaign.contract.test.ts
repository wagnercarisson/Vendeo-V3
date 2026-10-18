// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  projectClosedCampaign,
  CLOSED_CAMPAIGN_MESSAGES,
  type ProjectClosedCampaignReason,
} from "../orchestration/project-closed-campaign";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_STORE_ID = "99999999-9999-4999-8999-999999999999";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const CREDIT_OPS = "product_1_1_campaign_credit_operations";

interface FakeState {
  op?: unknown;
  campaign?: unknown;
  /** Releitura após update sem linhas (corrida). Ausente ⇒ repete `campaign`. */
  afterCampaign?: unknown;
  updateResult?: { data: unknown[] | null; error: { message: string } | null };
  throwOn?: string | null;
}

interface UpdateRecord {
  table: string;
  values: Record<string, unknown>;
  filters: Record<string, unknown>;
}

function makeClient(state: FakeState) {
  const updates: UpdateRecord[] = [];
  let campaignReads = 0;

  const client = {
    from(table: string) {
      if (state.throwOn === table) throw new Error("boom");
      const filters: Record<string, unknown> = {};
      let updateValues: Record<string, unknown> | null = null;
      let isUpdate = false;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq(col: string, val: unknown) {
          filters[col] = val;
          return builder;
        },
        neq(col: string, val: unknown) {
          filters[`${col}<>`] = val;
          return builder;
        },
        update(values: Record<string, unknown>) {
          isUpdate = true;
          updateValues = values;
          return builder;
        },
        maybeSingle: () => {
          if (table === CREDIT_OPS) {
            return Promise.resolve({ data: state.op ?? null, error: null });
          }
          if (table === "campaigns") {
            campaignReads += 1;
            if (campaignReads === 1) {
              return Promise.resolve({ data: state.campaign ?? null, error: null });
            }
            return Promise.resolve({
              data: state.afterCampaign ?? state.campaign ?? null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: unknown) => void) {
          if (isUpdate) {
            updates.push({ table, values: updateValues ?? {}, filters: { ...filters } });
            resolve(
              state.updateResult ?? { data: [{ id: CAMPAIGN_ID }], error: null },
            );
            return;
          }
          resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };
  return { client, updates };
}

const refundedOp = (over: Record<string, unknown> = {}) => ({
  status: "refunded",
  campaign_id: CAMPAIGN_ID,
  operation_id: OPERATION_ID,
  ...over,
});

const campaign = (over: Record<string, unknown> = {}) => ({
  store_id: STORE_ID,
  status: "generating",
  ...over,
});

function run(state: FakeState, input: Record<string, unknown> = {}) {
  const { client, updates } = makeClient(state);
  return {
    updates,
    promise: projectClosedCampaign(
      {
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        ...input,
      },
      { client: client as never, log: () => {} },
    ),
  };
}

describe("projectClosedCampaign (quick 261018-enc)", () => {
  it("encerramento automático: projeta status='error' + mensagem de falha confirmada", async () => {
    const { promise, updates } = run(
      { op: refundedOp(), campaign: campaign() },
      { reason: "confirmed_failure" },
    );
    const result = await promise;

    expect(result).toEqual({ projected: true, reason: "projected" });
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("campaigns");
    expect(updates[0].values).toEqual({
      status: "error",
      error_message: CLOSED_CAMPAIGN_MESSAGES.confirmed_failure,
    });
    // Condição atômica: projeta SOMENTE a partir de `generating` (preserva ready/error).
    expect(updates[0].filters).toEqual({
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      status: "generating",
    });
    expect(updates[0].values).not.toHaveProperty("approval_status");
  });

  it("encerramento administrativo: mensagem neutra (não 'falha técnica')", async () => {
    const { promise, updates } = run(
      { op: refundedOp(), campaign: campaign() },
      { reason: "authorized_abandon" },
    );
    expect(await promise).toEqual({ projected: true, reason: "projected" });
    expect(updates[0].values.error_message).toBe(
      CLOSED_CAMPAIGN_MESSAGES.authorized_abandon,
    );
  });

  it("encerramento de publicação inconclusiva autorizado: mensagem própria", async () => {
    const { updates, promise } = run(
      { op: refundedOp(), campaign: campaign() },
      { reason: "publication_closure" },
    );
    expect(await promise).toEqual({ projected: true, reason: "projected" });
    expect(updates[0].values.error_message).toBe(
      CLOSED_CAMPAIGN_MESSAGES.publication_closure,
    );
  });

  it("motivo ausente/não comprovável ⇒ mensagem NEUTRA", async () => {
    const { promise, updates } = run({ op: refundedOp(), campaign: campaign() });
    expect(await promise).toEqual({ projected: true, reason: "projected" });
    expect(updates[0].values.error_message).toBe(
      CLOSED_CAMPAIGN_MESSAGES.closed_neutral,
    );
  });

  it("replay idempotente: já `error` ⇒ already_projected, SEM trocar a mensagem", async () => {
    const { promise, updates } = run(
      {
        op: refundedOp(),
        campaign: campaign({
          status: "error",
          error_message: CLOSED_CAMPAIGN_MESSAGES.authorized_abandon,
        }),
      },
      { reason: "confirmed_failure" },
    );
    expect(await promise).toEqual({ projected: true, reason: "already_projected" });
    expect(updates).toHaveLength(0);
  });

  it("entrega confirmada (`ready`) NUNCA é sobrescrita ⇒ delivery_preserved", async () => {
    const { promise, updates } = run({
      op: refundedOp(),
      campaign: campaign({ status: "ready" }),
    });
    expect(await promise).toEqual({ projected: false, reason: "delivery_preserved" });
    expect(updates).toHaveLength(0);
  });

  it("CORRIDA NA ESCRITA: campanha vira `ready` entre a consulta e o UPDATE ⇒ delivery_preserved (0 linhas, releitura ready)", async () => {
    const { promise, updates } = run({
      op: refundedOp(),
      campaign: campaign({ status: "generating" }),
      afterCampaign: { store_id: STORE_ID, status: "ready" },
      updateResult: { data: [], error: null },
    });
    expect(await promise).toEqual({ projected: false, reason: "delivery_preserved" });
    // O UPDATE condicional foi tentado (e não casou nenhuma linha).
    expect(updates).toHaveLength(1);
    expect(updates[0].filters.status).toBe("generating");
  });

  it("CORRIDA NA ESCRITA: outra chamada grava `error` (motivo DIFERENTE) entre a leitura e o UPDATE ⇒ already_projected e mensagem preservada", async () => {
    const otherMessage = CLOSED_CAMPAIGN_MESSAGES.authorized_abandon;
    const afterRow = {
      store_id: STORE_ID,
      status: "error",
      error_message: otherMessage,
    };
    const { promise, updates } = run({
      op: refundedOp(),
      campaign: campaign({ status: "generating" }),
      afterCampaign: afterRow,
      updateResult: { data: [], error: null },
    });

    // A condição `status='generating'` não casa (a outra chamada já gravou `error`).
    expect(await promise).toEqual({ projected: true, reason: "already_projected" });
    // Tentou UMA vez (0 linhas) e NÃO fez uma segunda escrita.
    expect(updates).toHaveLength(1);
    expect(updates[0].filters.status).toBe("generating");
    // A mensagem gravada pela outra chamada permanece INTACTA.
    expect(afterRow.error_message).toBe(otherMessage);
    expect(afterRow.error_message).not.toBe(CLOSED_CAMPAIGN_MESSAGES.closed_neutral);
  });

  it("0 linhas atualizadas sem `ready` ⇒ projection_not_applied (distinto de delivery_preserved)", async () => {
    const { promise } = run({
      op: refundedOp(),
      campaign: campaign({ status: "generating" }),
      afterCampaign: { store_id: STORE_ID, status: "generating" },
      updateResult: { data: [], error: null },
    });
    expect(await promise).toEqual({
      projected: false,
      reason: "projection_not_applied" satisfies ProjectClosedCampaignReason,
    });
  });

  it.each(["reserved", "art_uploaded", "delivered", "unknown"])(
    "operação %s (não `refunded`) ⇒ operation_not_closed (sem update)",
    async (status) => {
      const { promise, updates } = run({
        op: refundedOp({ status }),
        campaign: campaign(),
      });
      expect(await promise).toEqual({
        projected: false,
        reason: "operation_not_closed" satisfies ProjectClosedCampaignReason,
      });
      expect(updates).toHaveLength(0);
    },
  );

  it("operação ausente ⇒ operation_not_closed (sem update)", async () => {
    const { promise, updates } = run({ op: null, campaign: campaign() });
    expect((await promise).reason).toBe("operation_not_closed");
    expect(updates).toHaveLength(0);
  });

  it("campanha inexistente ⇒ campaign_not_found (sem update)", async () => {
    const { promise, updates } = run({ op: refundedOp(), campaign: null });
    expect((await promise).reason).toBe("campaign_not_found");
    expect(updates).toHaveLength(0);
  });

  it("loja divergente ⇒ store_mismatch (sem update)", async () => {
    const { promise, updates } = run({
      op: refundedOp(),
      campaign: campaign({ store_id: OTHER_STORE_ID }),
    });
    expect((await promise).reason).toBe("store_mismatch");
    expect(updates).toHaveLength(0);
  });

  it("falha do UPDATE ⇒ projection_update_failed, sem lançar", async () => {
    const { promise } = run({
      op: refundedOp(),
      campaign: campaign(),
      updateResult: { data: null, error: { message: "db down" } },
    });
    await expect(promise).resolves.toEqual({
      projected: false,
      reason: "projection_update_failed",
    });
  });

  it("exceção inesperada ⇒ projection_update_failed, sem lançar", async () => {
    const { promise } = run({
      op: refundedOp(),
      campaign: campaign(),
      throwOn: CREDIT_OPS,
    });
    await expect(promise).resolves.toEqual({
      projected: false,
      reason: "projection_update_failed",
    });
  });
});
