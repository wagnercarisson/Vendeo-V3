import { describe, expect, it, vi } from "vitest";

import type { AttemptTarget, OperationViewLookup } from "@/lib/product-9-16-two-stage/types";
import type {
  TwoFormatRunDeps,
  TwoFormatRunInput,
} from "../run-two-format";
import { runTwoFormatGeneration } from "../run-two-format";
import type { TwoFormatEvent } from "../two-format-events";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE = "44444444-4444-4444-8444-444444444444";
const INITIAL = "55555555-5555-4555-8555-555555555555";
const REQUEST = "66666666-6666-4666-8666-666666666666";

function status(overrides: Partial<Record<"terminal" | "next", unknown>> = {}) {
  return {
    campaignStatus: "generating",
    formats: {
      "1:1": { state: "processing" as const, deliveryOperationId: null },
      "9:16": { state: "processing" as const, deliveryOperationId: null },
    },
    preferredFormat: null,
    nextStep: (overrides.next ?? "expansion") as "base" | "expansion" | null,
    canContinue: true,
    operationTerminal: overrides.terminal === true,
  };
}

function foundView(): OperationViewLookup {
  return {
    kind: "found",
    view: {
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      origin: "9_16_two_stage",
      contractVersion: 2,
      frozenSelection: null,
      credit: {
        status: "reserved",
        terminal: false,
        delivered: false,
        refunded: false,
        reserved: true,
      },
      base: {
        stage: "base",
        status: "completed",
        attemptsUsed: 1,
        failureClass: null,
        attemptNumber: 1,
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
      nextAction: "acquire_expansion",
      canContinue: true,
      processingPhase: "between_steps",
    },
  } as unknown as OperationViewLookup;
}

function input(overrides: Partial<TwoFormatRunInput> = {}): TwoFormatRunInput {
  return {
    mode: "new",
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    authorization: { kind: "owner", userId: STORE },
    allowNewPaidStep: true,
    requestStartedAtMs: Date.now(),
    deadlineAtMs: Date.now() + 120_000,
    inputSnapshot: { campaignFormat: "1:1+9:16" },
    squareDeliveryId: SQUARE,
    initialRequestId: INITIAL,
    content: {
      briefing: { product: { name: "Produto" } },
      briefingText: "{}",
      campaignIntent: "offer",
      backgroundDirection: "studio",
      productImagesDataUrls: ["data:image/jpeg;base64,AAAA"],
      referenceSelections: [],
      usdBrlRateAtGeneration: null,
      creditValueBrlAtGeneration: null,
    } as never,
    ...overrides,
  };
}

function deps(overrides: Partial<TwoFormatRunDeps> = {}): TwoFormatRunDeps {
  return {
    readOperationView: vi.fn(async (): Promise<OperationViewLookup> => ({ kind: "absent" })),
    readStatus: vi.fn(async () => status()),
    preflightJointSelection: vi.fn(async () => ({
      ok: true as const,
      selection: {
        model: "gpt-image-2.5-flare",
        quality: "low",
        configVersionId: "77777777-7777-4777-8777-777777777777",
      },
    })),
    openJointOperation: vi.fn(async () => ({
      kind: "opened" as const,
      idempotent: false,
      squareDeliveryId: SQUARE,
      verticalDeliveryOperationId: OPERATION,
      frozenSelection: {
        model: "gpt-image-2.5-flare",
        quality: "low",
        configVersionId: "77777777-7777-4777-8777-777777777777",
        origin: "configured" as const,
      },
      steps: [],
      creditStatus: "reserved" as const,
      squareCreditStatus: "reserved" as const,
    })),
    resumeJointOperation: vi.fn(async () => ({
      kind: "executed" as const,
      action: "run_base" as const,
      outcome: { kind: "completed" as const },
    })),
    runInitialBase: vi.fn(async () => ({ kind: "completed" as const })),
    resolveAttemptTarget: vi.fn(async () => "primary" as AttemptTarget),
    clock: () => Date.now(),
    callIdFactory: () => "88888888-8888-4888-8888-888888888888",
    ...overrides,
  };
}

async function events(response: Response): Promise<TwoFormatEvent[]> {
  return (await response.text())
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TwoFormatEvent);
}

describe("F60.7 C1 — runtime conjunto", () => {
  it("abertura nova executa no máximo uma ação e usa a identidade inicial", async () => {
    const d = deps();
    const response = await runTwoFormatGeneration(input(), d);
    const result = await events(response);
    expect(d.openJointOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        squareDeliveryId: SQUARE,
        campaignId: CAMPAIGN,
      }),
    );
    expect(d.resumeJointOperation).not.toHaveBeenCalled();
    expect(d.runInitialBase).toHaveBeenCalledTimes(1);
    expect(d.runInitialBase).toHaveBeenCalledWith(
      expect.objectContaining({ acquisitionId: INITIAL }),
    );
    expect(result.filter((event) => event.type !== "phase")).toHaveLength(1);
    expect(result.at(-1)).toMatchObject({
      type: "processing",
      responseTerminal: true,
      operationTerminal: false,
    });
  });

  it("POST inicial com operação existente é read-only", async () => {
    const d = deps({
      readOperationView: vi.fn(async () => foundView()),
    });
    const response = await runTwoFormatGeneration(input(), d);
    const result = await events(response);
    expect(d.preflightJointSelection).not.toHaveBeenCalled();
    expect(d.openJointOperation).not.toHaveBeenCalled();
    expect(d.resumeJointOperation).not.toHaveBeenCalled();
    expect(result.filter((event) => event.type !== "phase")).toHaveLength(1);
    expect(result.at(-1)).toMatchObject({ type: "processing" });
  });

  it("continue/retry usa o requestId novo da continuação", async () => {
    const d = deps({
      readOperationView: vi.fn(async () => foundView()),
    });
    const response = await runTwoFormatGeneration(
      input({ mode: "continue", initialRequestId: undefined, requestId: REQUEST }),
      d,
    );
    await events(response);
    expect(d.resumeJointOperation).toHaveBeenCalledWith(
      expect.objectContaining({ acquisitionId: REQUEST }),
    );
    expect(d.resumeJointOperation).toHaveBeenCalledTimes(1);
  });

  it("flag OFF sem operação retorna erro, sem abrir/reservar", async () => {
    const d = deps();
    const response = await runTwoFormatGeneration(
      input({ allowNewPaidStep: false }),
      d,
    );
    const result = await events(response);
    expect(d.preflightJointSelection).not.toHaveBeenCalled();
    expect(d.openJointOperation).not.toHaveBeenCalled();
    expect(d.resumeJointOperation).not.toHaveBeenCalled();
    expect(result.at(-1)).toMatchObject({
      type: "error",
      code: "generation_unavailable",
      operationTerminal: false,
    });
  });
});
