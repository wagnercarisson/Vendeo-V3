// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("global_supabase_used");
      },
    },
  ),
}));
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
  hashImageDataUrl: (dataUrl: string) =>
    createHash("sha256").update(dataUrl).digest("hex"),
}));

import { createNineSixteenDeps } from "../delivery-deps";
import { runNineSixteenTwoStageGeneration } from "../run-nine-sixteen";
import {
  DURABLE_BYTES,
  DURABLE_DATA_URL,
  durableRow,
} from "./fixtures";
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

    expect(deps.reconstruction).toMatchObject({ client });
    expect(typeof deps.reconstruction?.readInputBytes).toBe("function");
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

  it("authorizes and reconstructs exclusively through the injected client", async () => {
    const injected = {
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () =>
            table === "campaigns"
              ? {
                  data: { store_id: STORE, ...durableRow() },
                  error: null,
                }
              : { data: null, error: null },
        };
        return builder;
      },
      storage: {
        from() {
          return {
            download: async () => ({
              data: new Blob([DURABLE_BYTES]),
              error: null,
            }),
          };
        },
      },
      rpc: async () => ({ data: null, error: null }),
    } as never;

    const deps = createNineSixteenDeps({
      client: injected,
      clock: () => 0,
      callIdFactory: () => "call",
    });
    expect(deps.client).toBe(injected);

    const control = {
      getOperationView: vi.fn(async () => ({
        kind: "found",
        view: {
          campaignId: "c",
          operationId: "o",
          origin: "9_16_two_stage",
          credit: {
            status: "reserved",
            terminal: false,
            delivered: false,
            refunded: false,
            reserved: true,
          },
          base: {
            stage: "base",
            status: "pending",
            attemptsUsed: 0,
            failureClass: null,
            attemptNumber: null,
            claimedAt: null,
          },
          expansion: {
            stage: "expansion",
            status: "pending",
            attemptsUsed: 0,
            failureClass: null,
            attemptNumber: null,
            claimedAt: null,
          },
          unknown: false,
          failedOutcome: false,
          supportReference: null,
          nextAction: "acquire_base",
          canContinue: true,
          processingPhase: null,
        },
      })),
      resume: vi.fn(async () => ({
        success: true,
        action: "acquire_base",
        nextTarget: "primary",
        origin: "9_16_two_stage",
        creditStatus: "reserved",
        baseStatus: "pending",
        baseAttempts: 0,
        expansionStatus: "pending",
        expansionAttempts: 0,
        unknown: false,
        failedOutcome: false,
      })),
      acquire: vi.fn(async () => ({
        acquired: true,
        authorization: "execute",
        reason: null,
        attemptToken: "t",
        attemptNumber: 1,
        stage: "base",
        target: "primary",
      })),
      finish: vi.fn(async () => ({
        success: true,
        idempotent: false,
        status: "failed",
        stage: "base",
        attemptNumber: 1,
      })),
      recordOutcome: vi.fn(async () => ({
        success: true,
        idempotent: false,
        outcome: "unknown",
        stage: "base",
        supportReference: null,
      })),
    } as never;

    const base = vi.fn(async () => ({ kind: "unknown_result" }) as never);
    const response = await runNineSixteenTwoStageGeneration(
      {
        mode: "continue",
        storeId: STORE,
        campaignId: "c",
        operationId: "o",
        authorization: { kind: "system" },
        requestStartedAtMs: 0,
        acquisitionIds: {
          base: "11111111-1111-4111-8111-111111111111",
          expansion: "22222222-2222-4222-8222-222222222222",
        },
      },
      {
        ...deps,
        control,
        base,
        readFrozenState: (async () => ({ kind: "complete" })) as never,
      },
    );
    const text = await response.text();
    const terminal = JSON.parse(text.trim().split("\n").at(-1) ?? "{}");
    expect(terminal).toMatchObject({ type: "unknown" });

    const baseCalls = base.mock.calls as unknown as Array<
      [{ productImagesDataUrls: readonly string[] }]
    >;
    expect(baseCalls).toHaveLength(1);
    expect(baseCalls[0][0].productImagesDataUrls).toEqual([DURABLE_DATA_URL]);
  });
});
