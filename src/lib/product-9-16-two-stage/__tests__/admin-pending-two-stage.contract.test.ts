// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: vi.fn(async () => ({
    projected: true,
    reason: "projected",
  })),
}));

import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import {
  buildAdminPendingRepository,
  createPendingFormatAdapter,
} from "@/lib/product-vertical-9-16/recovery/pending-adapter";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const VERTICAL = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

function twoStageSnapshot() {
  return {
    campaignFormat: "9:16",
    formatContractVersion: "f59-vertical-9-16-v1",
    generationOrigin: "9_16_two_stage",
    generationContractVersion: "f60.5-two-stage-9-16-v1",
  };
}

function makeClient(options: {
  snapshot?: unknown;
  verticalRow?: unknown;
} = {}) {
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === "campaigns") {
            return {
              data: {
                store_id: STORE,
                input_snapshot: options.snapshot ?? twoStageSnapshot(),
              },
              error: null,
            };
          }
          if (table === "campaign_composition_artifacts") {
            return {
              data:
                options.verticalRow === undefined
                  ? {
                      id: "44444444-4444-4444-8444-444444444444",
                      store_id: STORE,
                      campaign_id: CAMPAIGN,
                      operation_id: OPERATION,
                      role: "vertical",
                      format: "9:16",
                      origin: "ai_expansion",
                      derived_from_artifact_id: null,
                      source_campaign_id: null,
                      storage_bucket: "campaign-internal-artifacts",
                      storage_path: VERTICAL,
                      width: 1080,
                      height: 1920,
                      mime_type: "image/jpeg",
                      byte_size: 100,
                      checksum_sha256: "a".repeat(64),
                      provenance: {},
                      created_at: "2026-11-13T00:00:00.000Z",
                    }
                  : options.verticalRow,
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
  return client as never;
}

describe("administração por origem de duas etapas", () => {
  it("resolves the persisted 9:16 format for a valid two-stage campaign", async () => {
    const adapter = createPendingFormatAdapter({ client: makeClient() });
    await expect(adapter.resolveFormat(CAMPAIGN)).resolves.toEqual({ kind: "9:16" });
  });

  it("projects a two-stage delivery with the composition source", async () => {
    const adapter = createPendingFormatAdapter({ client: makeClient() });
    const projection = adapter.projectionFor(STORE, CAMPAIGN, OPERATION);
    await projection({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION });
    expect(projectDeliveredCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { kind: "composition", role: "vertical", expectedPath: VERTICAL },
      }),
      expect.anything(),
    );
  });

  it("fails closed when the vertical row is absent", async () => {
    const adapter = createPendingFormatAdapter({
      client: makeClient({ verticalRow: null }),
    });
    const projection = adapter.projectionFor(STORE, CAMPAIGN, OPERATION);
    await expect(
      projection({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).resolves.toEqual({ projected: false, reason: "artifact_missing" });
  });

  it("builds the repository with the composition prober for two-stage", async () => {
    const twoStageArtifacts = {
      probeArtifact: vi.fn(async () => ({
        kind: "integral" as const,
        ref: { storagePath: VERTICAL, width: 1080, height: 1920, mimeType: "image/jpeg" },
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
        storagePath: VERTICAL,
      })),
    };
    const verticalArtifacts = {
      probeArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    };
    const client = {
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => {
            if (table === "product_9_16_two_stage_operations") {
              return { data: { campaign_id: CAMPAIGN, operation_id: OPERATION }, error: null };
            }
            if (table === "product_9_16_two_stage_steps") {
              return {
                data: [
                  {
                    stage: "base",
                    status: "in_progress",
                    attempts_used: 1,
                    updated_at: "2026-01-01T00:00:00Z",
                  },
                ],
                error: null,
              };
            }
            return { data: null, error: null };
          },
          in: () => builder,
          order: () => builder,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        };
        return builder;
      },
    } as never;

    const repository = buildAdminPendingRepository(
      {
        resolveFormat: async () => ({ kind: "9:16" as const }),
        verticalArtifacts,
        twoStageArtifacts,
        projectionFor: () => projectDeliveredCampaign,
      },
      client,
    );

    await expect(repository.probeArtifact(STORE, CAMPAIGN, OPERATION)).resolves.toMatchObject({
      kind: "integral",
    });
    expect(twoStageArtifacts.probeArtifact).toHaveBeenCalledTimes(1);
    expect(verticalArtifacts.probeArtifact).not.toHaveBeenCalled();
  });
});
