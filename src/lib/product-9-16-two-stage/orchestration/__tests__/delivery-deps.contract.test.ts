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
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { projectClosedCampaign } from "@/lib/product-1-1/orchestration/project-closed-campaign";
import { runSquareBase } from "@/lib/campaign/square-base/run-square-base";
import { prepareSquareForExpansion } from "@/lib/campaign/square-preparation/prepare";
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import { generateCampaignThumbnailSafely } from "@/lib/campaign/thumbnail/thumbnail-safe";

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

  it("binds the injected client to every delegated path", async () => {
    const client = { marker: "injected" } as never;
    const deps = createNineSixteenDeps({ client });

    await deps.base({} as never);
    expect(runSquareBase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    await deps.prepare({} as never);
    expect(prepareSquareForExpansion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    await deps.expand({} as never);
    expect(expandVerticalToNineSixteen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    await deps.readFrozenState({} as never);
    expect(readSquareBaseFrozenState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    await deps.projectClosed({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    expect(projectClosedCampaign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    expect(deps.reconstruction).toEqual({ client });
  });

  it("builds the thumbnail uploader from the injected client, not the global env", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const upload = vi.fn(async () => ({ error: null }));
    const client = {
      storage: { from: () => ({ upload }) },
    } as never;
    vi.mocked(retrieveCompositionArtifact).mockResolvedValue({
      kind: "integral",
      artifact: { storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg` },
      bytes: Buffer.from("bytes"),
    } as never);

    const deps = createNineSixteenDeps({ client });
    await deps.generateThumbnail({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
    });

    const input = vi.mocked(generateCampaignThumbnailSafely).mock.calls.at(-1)?.[0];
    expect(input?.context?.endpoint).toBe("https://example.supabase.co");
    await input?.context?.uploader.upload({
      path: "thumb.webp",
      buffer: Buffer.from("thumb"),
      contentType: "image/webp",
    });
    expect(upload).toHaveBeenCalledWith(
      "thumb.webp",
      Buffer.from("thumb"),
      expect.objectContaining({ contentType: "image/webp" }),
    );
  });
});
