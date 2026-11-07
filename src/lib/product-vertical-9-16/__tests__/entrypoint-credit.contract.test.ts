// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const m = vi.hoisted(() => ({
  project: vi.fn(),
}));

vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/product-1-1/orchestration/project-delivered-campaign")
    >();
  return { ...actual, projectDeliveredCampaign: m.project };
});

import type { AiInvocationRequest, AiInvocationResult } from "@/lib/ai/types";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type { ImagePairCostResolution } from "@/lib/ai-cost/image-pair-pricing";
import { runProductVertical9x16Generation } from "../orchestration/entrypoint";
import { createProofBudget } from "../cost/vertical-estimate";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT_ID = "44444444-4444-4444-8444-444444444444";
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`;

const CONFIG = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "low" },
  origin: "human_decision" as const,
  configVersionId: "55555555-5555-4555-8555-555555555555",
};

const SNAPSHOT = Object.freeze({
  campaignId: CAMPAIGN,
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "low",
  configVersionId: CONFIG.configVersionId,
  origin: "human_decision" as const,
  createdAt: "2026-11-04T00:00:00.000Z",
});

const INPUT = {
  campaignId: CAMPAIGN,
  operationId: OPERATION,
  storeId: STORE,
  briefing: {
    backgroundDirection: "studio" as const,
    product: { name: "Produto", description: null },
    commercial: {
      intent: "offer" as const,
      originalPriceText: null,
      discountedPriceText: "R$ 10",
      badge: null,
      validity: null,
    },
    constraints: { mandatoryArtworkText: null },
  },
  briefingText: "briefing",
  campaignIntent: "offer" as const,
  backgroundDirection: "studio" as const,
  productImagesDataUrls: ["data:image/png;base64,primary"],
};

function resolution(): ImagePairCostResolution {
  return {
    primary: {
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      costUsd: 0.044,
      versionId: "pricing-primary",
      costSource: "pricing_table",
      pricing: { imageTokenUsdPer1M: 30 },
    },
    fallback: {
      model: "gpt-image-2",
      quality: "low",
      costUsd: 0.042,
      versionId: "pricing-fallback",
      costSource: "pricing_table",
      pricing: { imageTokenUsdPer1M: 30 },
    },
  };
}

interface HarnessOptions {
  readonly providerResult?: AiInvocationResult | Error;
  readonly artifactFails?: boolean;
  readonly probeKind?: "integral" | "absent" | "invalid" | "indeterminate";
  readonly copy?: boolean;
  readonly pilotSpend?: boolean;
  readonly budgetCapUsd?: number;
  readonly estimateMissing?: boolean;
  readonly acquireSequence?: boolean[];
}

function makeHarness(options: HarnessOptions = {}) {
  m.project.mockReset();
  const events: string[] = [];
  const calls = {
    reserve: vi.fn(),
    beginPublication: vi.fn(),
    markArtUploaded: vi.fn(),
    deliver: vi.fn(),
    refund: vi.fn(),
    closeFailedOperation: vi.fn(),
    acquire: vi.fn(),
    finish: vi.fn(),
    recordOutcome: vi.fn(),
    storeArtifact: vi.fn(),
    probeArtifact: vi.fn(),
    project: m.project,
    projectClosed: vi.fn(),
    beginPaidCall: vi.fn(),
    gateway: vi.fn(),
  };
  const requests: AiInvocationRequest[] = [];
  let operation: Record<string, unknown> | null = null;
  let acquireIndex = 0;
  const acquireSequence = options.acquireSequence ?? [];

  const state = (status: string, extra: Record<string, unknown> = {}) => ({
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    status,
    amount: 1,
    creditTxId: "tx",
    refundTxId: null,
    consumedDefinitive: status === "delivered",
    terminal: status === "delivered" || status === "refunded",
    unknown: false,
    outcome: null,
    supportReference: null,
    ...extra,
  });

  calls.reserve.mockImplementation(async () => {
    events.push("reserve");
    operation = state("reserved");
    return operation;
  });
  calls.beginPublication.mockImplementation(async () => {
    events.push("beginPublication");
    return { acquired: true, token: "pub", publicationState: "in_flight" };
  });
  calls.markArtUploaded.mockImplementation(async () => {
    events.push("markArtUploaded");
    operation = state("art_uploaded");
    return operation;
  });
  calls.deliver.mockImplementation(async () => {
    events.push("deliver");
    operation = state("delivered");
    return operation;
  });
  calls.refund.mockImplementation(async () => {
    events.push("refund");
    operation = state("refunded");
    return operation;
  });
  calls.closeFailedOperation.mockImplementation(async () => {
    events.push("closeFailedOperation");
    operation = state("refunded");
    return operation;
  });
  calls.acquire.mockImplementation(async () => {
    events.push("attempt:acquired");
    const acquired = acquireSequence.length
      ? (acquireSequence[acquireIndex++] ?? false)
      : true;
    return {
      acquired,
      reason: acquired ? null : "in_progress",
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      attemptNumber: acquired ? 1 : null,
      target: acquired ? "primary" : null,
    };
  });
  calls.finish.mockImplementation(async () => {
    events.push("attempt:finish");
    return {};
  });
  calls.recordOutcome.mockImplementation(async () => {
    events.push("recordOutcome");
    return {};
  });
  calls.storeArtifact.mockImplementation(async () => {
    events.push("storeArtifact");
    if (options.artifactFails) throw new Error("artifact_upload_failed");
    return {
      storagePath: VERTICAL_PATH,
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      sourceWidth: 1152,
      sourceHeight: 2048,
    };
  });
  calls.probeArtifact.mockImplementation(async () => {
    events.push(`probe:${options.probeKind ?? "indeterminate"}`);
    return { kind: options.probeKind ?? "indeterminate" };
  });
  calls.project.mockImplementation(async () => {
    events.push("project");
    return { projected: true, reason: "projected" };
  });  calls.projectClosed.mockImplementation(async () => {
    events.push("projectClosed");
    return { projected: true, reason: "projected" };
  });
  calls.beginPaidCall.mockImplementation(async () => {
    events.push("beginPaidCall");
    return {
      acquired: false,
      outcome: "blocked",
      reason: "should_not_be_called",
    };
  });

  const createGateway = vi.fn((_pair: ImageModelPairConfig) => {
    calls.gateway();
    return {
      async invoke(_capability: string, request: AiInvocationRequest) {
        requests.push(request);
        events.push("image:request");
        const result =
          options.providerResult ?? {
            imageBase64: "AAAA",
            mimeType: "image/png",
            model: "gpt-image-2.5-sunburst",
          };
        events.push("image:response");
        if (result instanceof Error) throw result;
        return result;
      },
      async hasFallback() {
        return true;
      },
    };
  });

  const copy = options.copy
    ? {
        acquireAttempt: async () => {
          events.push("copy:start");
          return {
            acquired: true,
            attemptSeq: 1,
            attemptToken: "copy-token",
            mode: "auto",
          };
        },
        recordCopyState: async () => ({
          applied: true,
          outcome: "applied",
          state: "completed",
        }),
        recordCancellation: async () => ({
          applied: true,
          state: "failed",
          canceled: true,
        }),
        runCopy: async () => {
          events.push("copy:start");
        },
      }
    : undefined;

  const deps = {
    runPreflight: async () => {
      events.push("preflight");
      return {
        config: CONFIG,
        pricing: {
          primary: {} as never,
          fallback: {} as never,
          missingComponents: [],
          pricingCoverage: "complete" as const,
        },
      };
    },
    buildSnapshot: () => SNAPSHOT,
    persistSnapshot: async () => {
      events.push("persist");
      return { snapshotOriginalId: SNAPSHOT_ID, reused: false };
    },
    credit: {
      reserve: calls.reserve,
      beginPublication: calls.beginPublication,
      markArtUploaded: calls.markArtUploaded,
      deliver: calls.deliver,
      refund: calls.refund,
      closeFailedOperation: calls.closeFailedOperation,
      getPublicationEpoch: async () => 0,
      abortPublication: async () => ({ success: true }),
      markResultUnknown: async () => ({ success: true }),
    } as never,
    attempts: {
      acquire: calls.acquire,
      finish: calls.finish,
      recordOperationOutcome: calls.recordOutcome,
      getCampaignOperation: async () => operation,
    } as never,
    artifact: {
      storeArtifact: calls.storeArtifact,
      probeArtifact: calls.probeArtifact,
    } as never,
    createGateway,
    recordAttempt: async () => ({}),
    recordDiagnosis: async () => ({ reference: "diag-ref" }),
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
    projectDeliveredCampaign: calls.project,
    projectClosedCampaign: calls.projectClosed,
    copy: copy as never,
    pilotSpend: options.pilotSpend
      ? ({ beginPaidCall: calls.beginPaidCall } as never)
      : undefined,
    resolvePair: async () =>
      options.estimateMissing
        ? {
            primary: {
              ...resolution().primary,
              costUsd: null,
            },
            fallback: {
              ...resolution().fallback,
              costUsd: null,
            },
          }
        : resolution(),
    ...(options.budgetCapUsd === undefined
      ? {}
      : {
          budget: createProofBudget({
            capUsd: options.budgetCapUsd,
            plannedCalls: 1,
          }),
        }),
  };

  return { deps, events, calls, requests, operation: () => operation };
}

async function run(harness: ReturnType<typeof makeHarness>) {
  const response = await runProductVertical9x16Generation(INPUT, harness.deps as never);
  const text = await response.text();
  const events = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { response, terminal: events.at(-1), events };
}

describe("F59 — crédito, falha e timing no entrypoint vertical", () => {
  it("sucesso: reserva → fence → store → art_uploaded → delivered → projeção", async () => {
    const harness = makeHarness();
    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.events).toEqual([
      "preflight",
      "persist",
      "reserve",
      "attempt:acquired",
      "image:request",
      "image:response",
      "attempt:finish",
      "beginPublication",
      "storeArtifact",
      "markArtUploaded",
      "deliver",
      "project",
    ]);
    expect(harness.calls.reserve).toHaveBeenCalledTimes(1);
    expect(harness.calls.deliver).toHaveBeenCalledTimes(1);
    expect(harness.requests[0].size).toBe("1152x2048");
  });

  it("custo real/estimativa preservam pricing na telemetria", async () => {
    const harness = makeHarness();
    const telemetry: Array<Record<string, unknown>> = [];
    (harness.deps as Record<string, unknown>).createTelemetry = (
      input: Record<string, unknown>,
    ) => {
      telemetry.push(input);
      return {
        operationRunId: "run",
        operationRunType: "campaign_delivery",
        traceId: "trace",
        storeId: STORE,
        campaignId: CAMPAIGN,
        attemptNumber: 1,
        sink: { emit: async () => {} },
      } as never;
    };
    await run(harness);
    const internal = telemetry[0]?.internalCost as Record<string, unknown>;
    expect(internal.settlement).toBe("usage_tokens");
    expect(internal.tokenPricing).toEqual({ imageTokenUsdPer1M: 30 });
    expect(internal.pricingVersion).toBe("pricing-primary");
    expect(internal.source).toBe("pricing_table");
  });

  it("falha confirmada com ausência provada estorna uma vez", async () => {
    const harness = makeHarness({
      providerResult: Object.assign(new Error("content policy"), {
        code: "content_policy",
      }),
      probeKind: "absent",
    });
    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "error" });
    expect(harness.calls.closeFailedOperation).toHaveBeenCalledTimes(1);
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.projectClosed).toHaveBeenCalledTimes(1);
    expect(harness.calls.deliver).not.toHaveBeenCalled();
  });

  it("resultado desconhecido não estorna", async () => {
    const harness = makeHarness({
      providerResult: Object.assign(new Error("timeout"), { name: "AbortError" }),
    });
    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "unknown" });
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.deliver).not.toHaveBeenCalled();
  });

  it("operação delivered existente é curto-circuito query-only", async () => {
    const harness = makeHarness();
    harness.deps.attempts = {
      ...(harness.deps.attempts as object),
      getCampaignOperation: async () => ({
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        status: "delivered",
        amount: 1,
        creditTxId: "tx",
        refundTxId: null,
        consumedDefinitive: true,
        terminal: true,
        unknown: false,
        outcome: null,
        supportReference: null,
      }),
    } as never;
    await run(harness);

    expect(harness.calls.reserve).not.toHaveBeenCalled();
    expect(harness.calls.acquire).not.toHaveBeenCalled();
    expect(harness.calls.gateway).not.toHaveBeenCalled();
  });

  it("concorrência: a segunda submissão observa a operação existente sem reservar/provider", async () => {
    const harness = makeHarness();
    const first = run(harness);
    await vi.waitFor(() => expect(harness.calls.reserve).toHaveBeenCalled());
    const second = run(harness);
    await Promise.all([first, second]);

    expect(harness.calls.reserve).toHaveBeenCalledTimes(1);
    expect(harness.calls.gateway).toHaveBeenCalledTimes(1);
  });

  it("falha de upload não entrega", async () => {
    const harness = makeHarness({
      artifactFails: true,
      probeKind: "indeterminate",
    });
    const { terminal } = await run(harness);

    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(terminal).toMatchObject({ type: "unknown" });
  });

  it("copy inicia depois da aquisição e não bloqueia a arte", async () => {
    const harness = makeHarness({ copy: true });
    const { events } = await run(harness);

    expect(events.some((event) => event.type === "result")).toBe(true);
    const copyIndex = harness.events.indexOf("copy:start");
    expect(copyIndex).toBeGreaterThan(harness.events.indexOf("attempt:acquired"));
    expect(copyIndex).toBeLessThan(harness.events.indexOf("image:request"));
    expect(harness.calls.deliver).toHaveBeenCalledTimes(1);
    expect(harness.calls.refund).not.toHaveBeenCalled();
  });

  it("sem estimativa: 0 reservas/0 provider/0 pilotSpend (sem pilotSpend)", async () => {
    const harness = makeHarness({ estimateMissing: true });
    await run(harness);

    expect(harness.events).toEqual(["preflight"]);
    expect(harness.calls.reserve).not.toHaveBeenCalled();
    expect(harness.calls.acquire).not.toHaveBeenCalled();
    expect(harness.calls.gateway).not.toHaveBeenCalled();
    expect(harness.calls.beginPaidCall).not.toHaveBeenCalled();
  });

  it("sem estimativa: 0 beginPaidCall mesmo com pilotSpend armado", async () => {
    const harness = makeHarness({ estimateMissing: true, pilotSpend: true });
    await run(harness);

    expect(harness.calls.beginPaidCall).not.toHaveBeenCalled();
    expect(harness.calls.reserve).not.toHaveBeenCalled();
    expect(harness.calls.gateway).not.toHaveBeenCalled();
  });

  it("orçamento insuficiente bloqueia antes da reserva/provider", async () => {
    const harness = makeHarness({ budgetCapUsd: 0.01 });
    await run(harness);

    expect(harness.calls.reserve).not.toHaveBeenCalled();
    expect(harness.calls.gateway).not.toHaveBeenCalled();
  });

  it("orçamento suficiente prossegue", async () => {
    const harness = makeHarness({ budgetCapUsd: 3 });
    const { terminal } = await run(harness);
    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.calls.gateway).toHaveBeenCalledTimes(1);
  });
});
