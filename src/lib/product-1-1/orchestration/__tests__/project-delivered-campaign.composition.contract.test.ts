// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { projectDeliveredCampaign } from "../project-delivered-campaign";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const CREDIT_OPS = "product_1_1_campaign_credit_operations";
const ARTIFACT = "product_1_1_campaign_artifacts";
const COMPOSITION = "campaign_composition_artifacts";
const VERTICAL_PATH = `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`;
const LEGACY_PATH = `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`;

interface UpdateRecord {
  table: string;
  values: Record<string, unknown>;
}

function makeClient(state: {
  op?: unknown;
  campaign?: unknown;
  artifact?: unknown;
  composition?: unknown;
  updateError?: { message: string } | null;
}) {
  const updates: UpdateRecord[] = [];
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          return builder;
        },
        maybeSingle: () => {
          if (table === CREDIT_OPS) {
            return Promise.resolve({ data: state.op ?? null, error: null });
          }
          if (table === "campaigns") {
            return Promise.resolve({ data: state.campaign ?? null, error: null });
          }
          if (table === ARTIFACT) {
            return Promise.resolve({ data: state.artifact ?? null, error: null });
          }
          if (table === COMPOSITION) {
            return Promise.resolve({
              data: state.composition ?? null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: unknown) => void) {
          resolve({ error: state.updateError ?? null });
        },
      };
      return builder;
    },
  };
  return { client, updates, tables };
}

const deliveredOp = {
  status: "delivered",
  campaign_id: CAMPAIGN_ID,
  operation_id: OPERATION_ID,
};

const generatingCampaign = {
  store_id: STORE_ID,
  status: "generating",
  storage_path: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
  error_message: null,
};

const compositionRow = (over: Record<string, unknown> = {}) => ({
  store_id: STORE_ID,
  campaign_id: CAMPAIGN_ID,
  operation_id: OPERATION_ID,
  role: "vertical",
  storage_path: VERTICAL_PATH,
  width: 1080,
  height: 1920,
  mime_type: "image/jpeg",
  ...over,
});

const input = {
  storeId: STORE_ID,
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  source: {
    kind: "composition" as const,
    role: "vertical" as const,
    expectedPath: VERTICAL_PATH,
  },
};

describe("projectDeliveredCampaign composition source", () => {
  it("projects the vertical path and never reads the 1:1 artifact table", async () => {
    const { client, updates, tables } = makeClient({
      op: deliveredOp,
      campaign: generatingCampaign,
      composition: compositionRow(),
    });
    await expect(projectDeliveredCampaign(input, { client: client as never })).resolves.toEqual({
      projected: true,
      reason: "projected",
    });
    expect(tables).not.toContain(ARTIFACT);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: "campaigns",
      values: {
        status: "ready",
        error_message: null,
        storage_path: VERTICAL_PATH,
      },
    });
  });

  it("is idempotent when already projected", async () => {
    const { client, updates } = makeClient({
      op: deliveredOp,
      campaign: {
        ...generatingCampaign,
        status: "ready",
        storage_path: VERTICAL_PATH,
      },
      composition: compositionRow(),
    });
    await expect(projectDeliveredCampaign(input, { client: client as never })).resolves.toEqual({
      projected: true,
      reason: "already_projected",
    });
    expect(updates).toHaveLength(0);
  });

  it("refuses a missing row, a divergent path and divergent dimensions", async () => {
    const missing = makeClient({
      op: deliveredOp,
      campaign: generatingCampaign,
      composition: null,
    });
    await expect(
      projectDeliveredCampaign(input, { client: missing.client as never }),
    ).resolves.toEqual({ projected: false, reason: "artifact_missing" });
    expect(missing.updates).toHaveLength(0);

    const wrongPath = makeClient({
      op: deliveredOp,
      campaign: generatingCampaign,
      composition: compositionRow({ storage_path: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/other.jpg` }),
    });
    await expect(
      projectDeliveredCampaign(input, { client: wrongPath.client as never }),
    ).resolves.toEqual({ projected: false, reason: "artifact_incompatible" });

    const wrongDimension = makeClient({
      op: deliveredOp,
      campaign: generatingCampaign,
      composition: compositionRow({ width: 1024, height: 1024 }),
    });
    await expect(
      projectDeliveredCampaign(input, { client: wrongDimension.client as never }),
    ).resolves.toEqual({ projected: false, reason: "artifact_incompatible" });

    const nonCanonical = makeClient({
      op: deliveredOp,
      campaign: generatingCampaign,
      composition: compositionRow(),
    });
    await expect(
      projectDeliveredCampaign(
        { ...input, source: { ...input.source, expectedPath: "caller/path.jpg" } },
        { client: nonCanonical.client as never },
      ),
    ).resolves.toEqual({ projected: false, reason: "artifact_incompatible" });
  });

  it("requires the operation to be delivered", async () => {
    const { client, updates } = makeClient({
      op: { ...deliveredOp, status: "reserved" },
      campaign: generatingCampaign,
      composition: compositionRow(),
    });
    await expect(projectDeliveredCampaign(input, { client: client as never })).resolves.toEqual({
      projected: false,
      reason: "operation_not_delivered",
    });
    expect(updates).toHaveLength(0);
  });

  it("keeps the default product_1_1 behavior byte-equivalent", async () => {
    const { client, updates, tables } = makeClient({
      op: deliveredOp,
      campaign: generatingCampaign,
      artifact: {
        storage_path: LEGACY_PATH,
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
      },
    });
    await expect(
      projectDeliveredCampaign(
        { storeId: STORE_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
        { client: client as never },
      ),
    ).resolves.toEqual({ projected: true, reason: "projected" });
    expect(tables).toContain(ARTIFACT);
    expect(tables).not.toContain(COMPOSITION);
    expect(updates[0].values.storage_path).toBe(LEGACY_PATH);
  });
});
