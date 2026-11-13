// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("../two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {
    marker = "control";
  },
}));
vi.mock("@/lib/product-1-1/credit-operation/credit-operation-client", () => ({
  ProductOneToOneCreditOperationClient: class {
    marker = "credit";
  },
}));
vi.mock("../two-stage-financial-service", () => ({
  TwoStageFinancialService: class {
    marker = "financial";
  },
}));
vi.mock("./vertical-probe", () => ({
  CompositionVerticalProbe: class {
    marker = "probe";
  },
}));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: vi.fn(async () => ({
    projected: true,
    reason: "projected",
  })),
}));
vi.mock("@/lib/product-1-1/orchestration/project-closed-campaign", () => ({
  projectClosedCampaign: vi.fn(async () => ({
    projected: true,
    reason: "projected",
  })),
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-safe", () => ({
  generateCampaignThumbnailSafely: vi.fn(async () => ({ status: "created" })),
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-generator", () => ({
  createDefaultThumbnailContext: vi.fn(() => null),
}));
vi.mock("@/lib/ai/image-generation-support-reference", () => ({
  generateSupportReference: vi.fn(() => "support-ref"),
}));
vi.mock("@/lib/campaign/composition-artifacts/repository", () => ({
  getArtifactByIdentity: vi.fn(),
}));
vi.mock("@/lib/campaign/composition-artifacts/retrieve", () => ({
  retrieveCompositionArtifact: vi.fn(),
}));
vi.mock("@/lib/campaign/square-base/run-square-base", () => ({
  runSquareBase: vi.fn(async () => ({ kind: "completed" })),
}));
vi.mock("@/lib/campaign/square-preparation/prepare", () => ({
  prepareSquareForExpansion: vi.fn(),
}));
vi.mock("@/lib/campaign/vertical-expansion/expand", () => ({
  expandVerticalToNineSixteen: vi.fn(),
}));
vi.mock("@/lib/campaign/square-base/frozen-state", () => ({
  readSquareBaseFrozenState: vi.fn(),
}));

import { createNineSixteenDeps } from "../delivery-deps";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { runSquareBase } from "@/lib/campaign/square-base/run-square-base";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

describe("createNineSixteenDeps", () => {
  it("composes every required dependency with real implementations", () => {
    const deps = createNineSixteenDeps({ client: {} as never });
    for (const key of [
      "control",
      "financial",
      "credit",
      "clock",
      "callIdFactory",
      "newSupportReference",
      "base",
      "prepare",
      "expand",
      "readFrozenState",
      "projectDelivered",
      "projectClosed",
      "probeVertical",
      "generateThumbnail",
    ] as const) {
      expect(deps[key]).toBeDefined();
    }
    expect(Object.isFrozen(deps)).toBe(true);
    expect(deps.newSupportReference()).toBe("support-ref");
  });

  it("projects the composition source with the persisted vertical path", async () => {
    vi.mocked(getArtifactByIdentity).mockResolvedValue({
      kind: "found",
      record: { storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg` },
    } as never);
    const deps = createNineSixteenDeps({ client: {} as never });
    await deps.projectDelivered({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    expect(projectDeliveredCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          kind: "composition",
          role: "vertical",
          expectedPath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
        },
      }),
      expect.anything(),
    );
  });

  it("does not update the campaign when the vertical row is absent", async () => {
    vi.mocked(getArtifactByIdentity).mockResolvedValue({ kind: "absent" } as never);
    vi.mocked(projectDeliveredCampaign).mockClear();
    const deps = createNineSixteenDeps({ client: {} as never });
    await expect(
      deps.projectDelivered({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
      }),
    ).resolves.toEqual({ projected: false, reason: "artifact_missing" });
    expect(projectDeliveredCampaign).not.toHaveBeenCalled();
  });

  it("forwards copy seams to the square base", async () => {
    const copyOps = { marker: "ops" } as never;
    const copyInvoker = vi.fn() as never;
    const deps = createNineSixteenDeps({
      client: {} as never,
      copyOps,
      copyInvoker,
      copyDirectorEnabled: true,
    });
    await deps.base({} as never);
    expect(runSquareBase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        copyOps,
        copyInvoker,
        copyDirectorEnabled: true,
      }),
    );
  });
});
