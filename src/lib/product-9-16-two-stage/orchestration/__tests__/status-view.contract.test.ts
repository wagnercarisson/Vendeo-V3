// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  classifyBlockedState,
  deriveDurableNextAction,
  deriveTwoStageStatus,
} from "../status-view";
import type { TwoStageOperationView } from "../../types";

function view(overrides: Partial<TwoStageOperationView> = {}): TwoStageOperationView {
  return {
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
    ...overrides,
  };
}

describe("status view", () => {
  it("suspends only with explicit activation input and a paid next step", () => {
    const status = deriveTwoStageStatus(view(), { allowNewPaidStep: false });
    expect(status.state).toBe("processing");
    expect(status.processingPhase).toBe("suspended");
    expect(status.canContinue).toBe(false);
    expect(deriveTwoStageStatus(view()).processingPhase).toBe("between_steps");
  });

  it("keeps delivery allowed when suspended", () => {
    const status = deriveTwoStageStatus(
      view({
        base: { ...view().base, status: "done" },
        expansion: { ...view().expansion, status: "done" },
        nextAction: "deliver",
      }),
      { allowNewPaidStep: false },
    );
    expect(status.processingPhase).toBe("delivery_pending");
    expect(status.canContinue).toBe(true);
  });

  it("derives retry only for transient below limit", () => {
    const retry = view({
      base: {
        ...view().base,
        status: "failed",
        failureClass: "transient",
        attemptsUsed: 1,
      },
    });
    expect(deriveDurableNextAction(retry)).toBe("retry_base");
    expect(
      deriveDurableNextAction({
        ...retry,
        base: { ...retry.base, attemptsUsed: 3 },
      }),
    ).toBe("blocked");
    expect(classifyBlockedState({ ...retry, base: { ...retry.base, attemptsUsed: 3 } })).toBe(
      "attempt_limit_exhausted",
    );
  });

  it("distinguishes blocked reasons", () => {
    expect(classifyBlockedState(view({ unknown: true }))).toBe("unknown");
    expect(
      classifyBlockedState(
        view({
          credit: {
            status: "refunded",
            terminal: true,
            delivered: false,
            refunded: true,
            reserved: false,
          },
        }),
      ),
    ).toBe("terminal");
    expect(
      classifyBlockedState(
        view({
          base: { ...view().base, status: "in_progress" },
        }),
      ),
    ).toBe("in_progress");
  });
});
