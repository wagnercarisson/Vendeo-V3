import { describe, expect, it, vi } from "vitest";

import type { AttemptTarget, OperationViewLookup } from "@/lib/product-9-16-two-stage/types";
import type {
  TwoFormatRunDeps,
  TwoFormatRunInput,
} from "../run-two-format";
import { runTwoFormatGeneration, terminalForStatus } from "../run-two-format";
import type { TwoFormatEvent, TwoFormatStatusSnapshot } from "../two-format-events";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE = "44444444-4444-4444-8444-444444444444";
const INITIAL = "55555555-5555-4555-8555-555555555555";
const REQUEST = "66666666-6666-4666-8666-666666666666";

function snapshot(
  overrides: {
    square?: "delivered" | "processing" | "absent" | "unknown" | "unavailable";
    vertical?: "delivered" | "processing" | "absent" | "unknown" | "unavailable";
    terminal?: boolean;
    next?: "base" | "expansion" | "square_delivery" | "delivery" | null;
    canContinue?: boolean;
  } = {},
): TwoFormatStatusSnapshot {
  return {
    campaignStatus: "generating",
    formats: {
      "1:1": {
        state: overrides.square ?? "processing",
        deliveryOperationId: SQUARE,
      },
      "9:16": {
        state: overrides.vertical ?? "processing",
        deliveryOperationId: OPERATION,
      },
    },
    preferredFormat: null,
    nextStep: overrides.next ?? "expansion",
    canContinue: overrides.canContinue ?? true,
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
    ...overrides,
  };
}

function deps(overrides: Partial<TwoFormatRunDeps> = {}): TwoFormatRunDeps {
  return {
    readOperationView: vi.fn(async (): Promise<OperationViewLookup> => ({ kind: "absent" })),
    readStatus: vi.fn(async () => snapshot()),
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
    resolveAttemptTarget: vi.fn(async () => "primary" as AttemptTarget),
    finalizeJointFailure: vi.fn(async () => ({
      kind: "refunded" as const,
      formats: ["1:1", "9:16"] as const,
      idempotent: false,
      campaignStatus: null,
    })),
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
  it("abertura nova usa a identidade inicial e executa via autoridade (sem inventar alvo)", async () => {
    const d = deps();
    const response = await runTwoFormatGeneration(input(), d);
    const result = await events(response);
    expect(d.openJointOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        squareDeliveryId: SQUARE,
        campaignId: CAMPAIGN,
      }),
    );
    expect(d.resolveAttemptTarget).toHaveBeenCalledTimes(1);
    expect(d.resumeJointOperation).toHaveBeenCalledTimes(1);
    expect(d.resumeJointOperation).toHaveBeenCalledWith(
      expect.objectContaining({ acquisitionId: INITIAL, attemptTarget: "primary" }),
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
    expect(d.resolveAttemptTarget).not.toHaveBeenCalled();
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

  it("autoridade sem alvo NÃO é substituída por 'primary'", async () => {
    const d = deps({
      resolveAttemptTarget: vi.fn(async () => null),
    });
    const response = await runTwoFormatGeneration(input(), d);
    await events(response);
    const call = vi.mocked(d.resumeJointOperation).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call).not.toHaveProperty("attemptTarget");
    expect(d.resumeJointOperation).toHaveBeenCalledTimes(1);
  });

  it("cancelamento é revalidado antes da abertura financeira", async () => {
    const controller = new AbortController();
    controller.abort();
    const d = deps();
    const response = await runTwoFormatGeneration(
      input({ signal: controller.signal }),
      d,
    );
    const result = await events(response);
    expect(d.openJointOperation).not.toHaveBeenCalled();
    expect(d.resumeJointOperation).not.toHaveBeenCalled();
    expect(result.at(-1)).toMatchObject({
      type: "error",
      code: "request_aborted",
    });
  });

  it("prazo esgotado impede a abertura e não reserva", async () => {
    const d = deps({ clock: () => 10_000_000 });
    const response = await runTwoFormatGeneration(
      input({ requestStartedAtMs: 0, deadlineAtMs: 1_000 }),
      d,
    );
    const result = await events(response);
    expect(d.openJointOperation).not.toHaveBeenCalled();
    expect(result.at(-1)).toMatchObject({
      type: "error",
      code: "deadline_exceeded",
    });
  });

  it("desfecho definitive da base conecta finalizeJointFailure", async () => {
    const d = deps({
      resumeJointOperation: vi.fn(async () => ({
        kind: "executed" as const,
        action: "run_base" as const,
        outcome: { kind: "definitive" as const, reason: "invalid_input" },
      })),
      readStatus: vi.fn(async () =>
        snapshot({ square: "absent", vertical: "absent", terminal: true, next: null }),
      ),
    });
    const response = await runTwoFormatGeneration(input(), d);
    const result = await events(response);
    expect(d.finalizeJointFailure).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "base", outcomeKind: "definitive" }),
    );
    expect(result.at(-1)).toMatchObject({
      type: "error",
      code: "joint_refunded",
      operationTerminal: true,
      refunded: true,
    });
  });

  it("ambos estornados NÃO viram resultado de sucesso", () => {
    const event = terminalForStatus(
      input(),
      snapshot({ square: "absent", vertical: "absent", terminal: true, next: null }),
    );
    expect(event.type).toBe("error");
    expect(event).toMatchObject({ code: "joint_refunded", refunded: true });
  });

  it("entregue + estornado é parcial terminal; entregue + desconhecido não é terminal", () => {
    const partial = terminalForStatus(
      input(),
      snapshot({ square: "delivered", vertical: "absent", terminal: true }),
    );
    expect(partial).toMatchObject({
      type: "result",
      partial: true,
      operationTerminal: true,
    });

    const pending = terminalForStatus(
      input(),
      snapshot({ square: "delivered", vertical: "unknown", terminal: false }),
    );
    expect(pending).toMatchObject({
      type: "result",
      partial: true,
      operationTerminal: false,
    });
  });
});
