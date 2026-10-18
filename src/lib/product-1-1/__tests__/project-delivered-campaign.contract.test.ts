// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  projectDeliveredCampaign,
  type ProjectDeliveredCampaignReason,
} from "../orchestration/project-delivered-campaign";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_STORE_ID = "99999999-9999-4999-8999-999999999999";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const CREDIT_OPS = "product_1_1_campaign_credit_operations";
const ARTIFACT = "product_1_1_campaign_artifacts";
const EXPECTED_PATH = `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`;

interface FakeState {
  op?: unknown;
  campaign?: unknown;
  artifact?: unknown;
  updateError?: { message: string } | null;
  throwOn?: string | null;
}

interface UpdateRecord {
  table: string;
  values: Record<string, unknown>;
  filters: Record<string, unknown>;
}

function makeClient(state: FakeState) {
  const updates: UpdateRecord[] = [];
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
        update(values: Record<string, unknown>) {
          isUpdate = true;
          updateValues = values;
          return builder;
        },
        maybeSingle: () => {
          if (table === CREDIT_OPS) return Promise.resolve({ data: state.op ?? null, error: null });
          if (table === "campaigns") return Promise.resolve({ data: state.campaign ?? null, error: null });
          if (table === ARTIFACT) return Promise.resolve({ data: state.artifact ?? null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: unknown) => void) {
          if (isUpdate) {
            updates.push({ table, values: updateValues ?? {}, filters: { ...filters } });
            resolve({ error: state.updateError ?? null });
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

const deliveredOp = (over: Record<string, unknown> = {}) => ({
  status: "delivered",
  campaign_id: CAMPAIGN_ID,
  operation_id: OPERATION_ID,
  ...over,
});

const generatingCampaign = (over: Record<string, unknown> = {}) => ({
  store_id: STORE_ID,
  status: "generating",
  storage_path: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
  error_message: null,
  ...over,
});

const artifactRow = (over: Record<string, unknown> = {}) => ({
  storage_path: EXPECTED_PATH,
  campaign_id: CAMPAIGN_ID,
  operation_id: OPERATION_ID,
  ...over,
});

function run(state: FakeState) {
  const { client, updates } = makeClient(state);
  return {
    updates,
    promise: projectDeliveredCampaign(
      { storeId: STORE_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: client as never, log: () => {} },
    ),
  };
}

describe("projectDeliveredCampaign (quick 261017-cdi)", () => {
  it("entrega normal: projeta status='ready' + caminho real da arte (sem tocar approval_status)", async () => {
    const { promise, updates } = run({
      op: deliveredOp(),
      campaign: generatingCampaign(),
      artifact: artifactRow(),
    });
    const result = await promise;

    expect(result).toEqual({ projected: true, reason: "projected" });
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("campaigns");
    expect(updates[0].values).toEqual({
      status: "ready",
      error_message: null,
      storage_path: EXPECTED_PATH,
    });
    expect(updates[0].values).not.toHaveProperty("approval_status");
    expect(updates[0].filters).toEqual({ id: CAMPAIGN_ID, store_id: STORE_ID });
  });

  it("repetição idempotente: já projetada ⇒ no-op", async () => {
    const { promise, updates } = run({
      op: deliveredOp(),
      campaign: generatingCampaign({ status: "ready", storage_path: EXPECTED_PATH }),
      artifact: artifactRow(),
    });
    expect(await promise).toEqual({ projected: true, reason: "already_projected" });
    expect(updates).toHaveLength(0);
  });

  it.each(["reserved", "art_uploaded", "refunded"])(
    "operação %s (inconclusiva/upload/estorno) NUNCA marca pronto",
    async (status) => {
      const { promise, updates } = run({
        op: deliveredOp({ status }),
        campaign: generatingCampaign(),
        artifact: artifactRow(),
      });
      expect(await promise).toEqual({
        projected: false,
        reason: "operation_not_delivered" satisfies ProjectDeliveredCampaignReason,
      });
      expect(updates).toHaveLength(0);
    },
  );

  it("operação ausente ⇒ não marca pronto", async () => {
    const { promise, updates } = run({ op: null, campaign: generatingCampaign(), artifact: artifactRow() });
    expect((await promise).reason).toBe("operation_not_delivered");
    expect(updates).toHaveLength(0);
  });

  it("campanha inexistente ⇒ campaign_not_found (sem update)", async () => {
    const { promise, updates } = run({ op: deliveredOp(), campaign: null, artifact: artifactRow() });
    expect((await promise).reason).toBe("campaign_not_found");
    expect(updates).toHaveLength(0);
  });

  it("loja divergente ⇒ store_mismatch (sem update)", async () => {
    const { promise, updates } = run({
      op: deliveredOp(),
      campaign: generatingCampaign({ store_id: OTHER_STORE_ID }),
      artifact: artifactRow(),
    });
    expect((await promise).reason).toBe("store_mismatch");
    expect(updates).toHaveLength(0);
  });

  it("arte ausente/divergente ⇒ artifact_missing (sem update)", async () => {
    const missing = run({ op: deliveredOp(), campaign: generatingCampaign(), artifact: null });
    expect((await missing.promise).reason).toBe("artifact_missing");

    const divergent = run({
      op: deliveredOp(),
      campaign: generatingCampaign(),
      artifact: artifactRow({ storage_path: "other/path.jpg" }),
    });
    expect((await divergent.promise).reason).toBe("artifact_missing");
    expect(divergent.updates).toHaveLength(0);
  });

  it("falha da atualização ⇒ projection_update_failed, sem lançar (reparo idempotente)", async () => {
    const { promise } = run({
      op: deliveredOp(),
      campaign: generatingCampaign(),
      artifact: artifactRow(),
      updateError: { message: "db down" },
    });
    await expect(promise).resolves.toEqual({
      projected: false,
      reason: "projection_update_failed",
    });
  });

  it("exceção inesperada ⇒ projection_update_failed, sem lançar", async () => {
    const { promise } = run({
      op: deliveredOp(),
      campaign: generatingCampaign(),
      artifact: artifactRow(),
      throwOn: CREDIT_OPS,
    });
    await expect(promise).resolves.toEqual({
      projected: false,
      reason: "projection_update_failed",
    });
  });
});
