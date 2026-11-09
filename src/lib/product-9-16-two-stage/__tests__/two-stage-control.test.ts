import { describe, expect, it, vi } from "vitest";
import {
  parseAcquireStep,
  parseFinishStep,
  parseOpenOperation,
  parseRecordOutcome,
  parseResumeOperation,
} from "../two-stage-operation-client";
import {
  assertExecuteAuthorized,
  classifyProviderFailure,
  decideNextAction,
  decideNextAttempt,
  deriveFinancialView,
} from "../two-stage-operation-service";
import type {
  AttemptHistoryEntry,
  ProviderFailure,
} from "../types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const failure = (
  reason: ProviderFailure["reason"],
  sendEvidence: ProviderFailure["sendEvidence"] = "not_sent",
): ProviderFailure => ({
  class: classifyProviderFailure({ reason, sendEvidence }),
  reason,
  sendEvidence,
});

const entry = (
  target: AttemptHistoryEntry["target"],
  status: AttemptHistoryEntry["status"],
  failureValue: ProviderFailure | null = null,
  attemptNumber = 1,
): AttemptHistoryEntry => ({ attemptNumber, target, status, failure: failureValue });

describe("decisão da primeira tentativa x repetição", () => {
  it("permite a primeira tentativa da base pendente mesmo sem lastFailure", () => {
    const result = decideNextAttempt({
      stage: "base",
      targetHistory: [],
      lastFailure: null,
      requestedTarget: "primary",
    });
    expect(result).toEqual({ allowed: true, target: "primary", reason: null });
  });

  it("permite a primeira tentativa da expansão mesmo sem lastFailure", () => {
    const result = decideNextAttempt({
      stage: "expansion",
      targetHistory: [],
      lastFailure: null,
      requestedTarget: "initial",
    });
    expect(result).toEqual({ allowed: true, target: "initial", reason: null });
  });

  it("bloqueia repetição da base sem motivo, mas não a primeira tentativa", () => {
    const history = [entry("primary", "failed", null)];
    const result = decideNextAttempt({
      stage: "base",
      targetHistory: history,
      lastFailure: null,
      requestedTarget: "primary",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("insufficient_failure_evidence");
  });

  it("bloqueia retry da expansão sem motivo", () => {
    const history = [entry("initial", "failed", null)];
    const result = decideNextAttempt({
      stage: "expansion",
      targetHistory: history,
      lastFailure: null,
      requestedTarget: "retry",
    });
    expect(result.reason).toBe("insufficient_failure_evidence");
  });
});

describe("política por alvo e motivo", () => {
  it("rate_limit repete no principal", () => {
    const result = decideNextAttempt({
      stage: "base",
      targetHistory: [entry("primary", "failed", failure("rate_limit"))],
      lastFailure: failure("rate_limit"),
      requestedTarget: "primary",
    });
    expect(result).toEqual({ allowed: true, target: "primary", reason: null });
  });

  it("indisponibilidade explícita pode ir direto ao fallback", () => {
    const result = decideNextAttempt({
      stage: "base",
      targetHistory: [entry("primary", "failed", failure("capacity_unavailable"))],
      lastFailure: failure("capacity_unavailable"),
      requestedTarget: "fallback",
    });
    expect(result).toEqual({ allowed: true, target: "fallback", reason: null });
  });

  it("não autoriza primary depois de fallback", () => {
    const result = decideNextAttempt({
      stage: "base",
      targetHistory: [
        entry("primary", "failed", failure("rate_limit"), 1),
        entry("fallback", "failed", failure("rate_limit"), 2),
      ],
      lastFailure: failure("rate_limit"),
      requestedTarget: "primary",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("attempt_limit_reached");
  });

  it("limita a expansão a inicial + um retry", () => {
    const result = decideNextAttempt({
      stage: "expansion",
      targetHistory: [
        entry("initial", "failed", failure("rate_limit"), 1),
        entry("retry", "failed", failure("rate_limit"), 2),
      ],
      lastFailure: failure("rate_limit"),
      requestedTarget: "retry",
    });
    expect(result.reason).toBe("attempt_limit_reached");
  });

  it("timeout após possível envio é unknown e não repete", () => {
    const result = decideNextAttempt({
      stage: "base",
      targetHistory: [entry("primary", "failed", failure("timeout", "possibly_sent"))],
      lastFailure: failure("timeout", "possibly_sent"),
      requestedTarget: "primary",
    });
    expect(result.reason).toBe("operation_unknown");
  });

  it("rate_limit não é confundido com capacity_unavailable", () => {
    expect(classifyProviderFailure({ reason: "rate_limit", sendEvidence: "not_sent" })).toBe(
      "transient",
    );
    expect(
      classifyProviderFailure({ reason: "capacity_unavailable", sendEvidence: "not_sent" }),
    ).toBe("transient");
    expect(classifyProviderFailure({ reason: "timeout", sendEvidence: "possibly_sent" })).toBe(
      "unknown",
    );
    expect(classifyProviderFailure({ reason: "invalid_output", sendEvidence: "confirmed_sent" })).toBe(
      "definitive",
    );
  });

  it("rejeita classe inconsistente com timeout/possibly_sent", () => {
    const inconsistent: ProviderFailure = {
      class: "transient",
      reason: "timeout",
      sendEvidence: "possibly_sent",
    };
    const result = decideNextAttempt({
      stage: "expansion",
      targetHistory: [entry("initial", "failed", inconsistent)],
      lastFailure: inconsistent,
      requestedTarget: "retry",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("insufficient_failure_evidence");
  });

  it("não reabre base abandonada mesmo com falha transitória fornecida", () => {
    const result = decideNextAttempt({
      stage: "base",
      targetHistory: [entry("primary", "abandoned", null)],
      lastFailure: failure("rate_limit"),
      requestedTarget: "primary",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("decisão de próxima ação", () => {
  const baseState = {
    creditStatus: "reserved",
    terminal: false,
    unknown: false,
    failedOutcome: false,
    base: { status: "pending" as const, attemptsUsed: 0, failure: null },
    expansion: { status: "pending" as const, attemptsUsed: 0, failure: null },
  };

  it("traduz as ações reais", () => {
    expect(decideNextAction(baseState)).toEqual({
      action: "acquire_base",
      nextTarget: "primary",
    });
    expect(
      decideNextAction({
        ...baseState,
        base: { status: "done", attemptsUsed: 1, failure: null },
      }),
    ).toEqual({ action: "acquire_expansion", nextTarget: "initial" });
    expect(
      decideNextAction({
        ...baseState,
        base: { status: "done", attemptsUsed: 1, failure: null },
        expansion: { status: "done", attemptsUsed: 1, failure: null },
      }),
    ).toEqual({ action: "deliver", nextTarget: null });
    expect(
      decideNextAction({
        ...baseState,
        base: { status: "in_progress", attemptsUsed: 1, failure: null },
      }),
    ).toEqual({ action: "wait", nextTarget: null });
    expect(
      decideNextAction({
        ...baseState,
        base: { status: "failed", attemptsUsed: 1, failure: failure("rate_limit") },
        baseHistory: [entry("primary", "failed", failure("rate_limit"))],
      }),
    ).toEqual({ action: "retry_base", nextTarget: "primary" });
    expect(
      decideNextAction({
        ...baseState,
        unknown: true,
      }),
    ).toEqual({ action: "blocked", nextTarget: null });
  });

  it("base failed sem motivo não inventa retry", () => {
    expect(
      decideNextAction({
        ...baseState,
        base: { status: "failed", attemptsUsed: 1, failure: null },
        baseHistory: [entry("primary", "failed", null)],
      }),
    ).toEqual({ action: "blocked", nextTarget: null });
  });

  it("retomada não recomenda repetição que a aquisição recusaria", () => {
    const inconsistent: ProviderFailure = {
      class: "transient",
      reason: "other",
      sendEvidence: "possibly_sent",
    };
    expect(
      decideNextAction({
        ...baseState,
        base: { status: "done", attemptsUsed: 1, failure: null },
        expansion: { status: "failed", attemptsUsed: 1, failure: inconsistent },
        expansionHistory: [entry("initial", "failed", inconsistent)],
      }),
    ).toEqual({ action: "blocked", nextTarget: null });
  });
});

describe("parsers de envelope real", () => {
  const openInput = { storeId: "s", campaignId: "c", operationId: "o" };
  const acquireInput = {
    campaignId: "c",
    operationId: "o",
    stage: "base" as const,
    requestId: "r",
    target: "primary" as const,
  };

  it("open aceita envelope real", () => {
    const result = parseOpenOperation(
      {
        success: true,
        idempotent: false,
        status: "reserved",
        campaign_id: "c",
        operation_id: "o",
        origin: "9_16_two_stage",
        steps: [
          { stage: "base", status: "pending", attempts_used: 0, failure_class: null },
          { stage: "expansion", status: "pending", attempts_used: 0, failure_class: null },
        ],
      },
      openInput,
    );
    expect(result.success).toBe(true);
  });

  it("acquire aceita execução sem campaign_id/operation_id na resposta", () => {
    const result = parseAcquireStep(
      {
        acquired: true,
        authorization: "execute",
        reason: null,
        attempt_token: "t",
        attempt_number: 1,
        stage: "base",
        target: "primary",
      },
      acquireInput,
    );
    expect(result).toMatchObject({ acquired: true, authorization: "execute" });
  });

  it("acquire replay é query_only e não executa", () => {
    const result = parseAcquireStep(
      {
        acquired: false,
        authorization: "query_only",
        reason: null,
        attempt_token: "t",
        attempt_number: 1,
        stage: "base",
        target: "primary",
      },
      acquireInput,
    );
    expect(result.acquired).toBe(false);
    expect(() => assertExecuteAuthorized(result)).toThrow();
  });

  it("acquire recusa com invalid_target", () => {
    const result = parseAcquireStep(
      { acquired: false, authorization: "query_only", reason: "invalid_target" },
      acquireInput,
    );
    expect(result).toMatchObject({ acquired: false, reason: "invalid_target" });
  });

  it("finish e outcome validam campos reais", () => {
    expect(
      parseFinishStep(
        {
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attempt_number: 1,
        },
        {
          campaignId: "c",
          operationId: "o",
          attemptToken: "t",
          expectedStatus: "in_progress",
          status: "completed",
        },
      ),
    ).toMatchObject({ success: true, status: "completed" });
    expect(
      parseRecordOutcome(
        {
          success: true,
          idempotent: false,
          outcome: "failed",
          stage: "expansion",
          support_reference: "ref",
        },
        {
          campaignId: "c",
          operationId: "o",
          stage: "expansion",
          outcome: "failed",
          supportReference: "ref",
        },
      ),
    ).toMatchObject({ success: true, outcome: "failed" });
  });

  it("resume valida ações reais", () => {
    const result = parseResumeOperation({
      success: true,
      action: "retry_base",
      next_target: "fallback",
      origin: "9_16_two_stage",
      credit_status: "reserved",
      base_status: "failed",
      base_attempts: 1,
      expansion_status: "pending",
      expansion_attempts: 0,
      unknown: false,
      failed_outcome: false,
    });
    expect(result).toMatchObject({ action: "retry_base", nextTarget: "fallback" });
  });

  it("open rejeita etapas duplicadas", () => {
    expect(() =>
      parseOpenOperation(
        {
          success: true,
          idempotent: false,
          status: "reserved",
          campaign_id: "c",
          operation_id: "o",
          origin: "9_16_two_stage",
          steps: [
            { stage: "base", status: "pending", attempts_used: 0, failure_class: null },
            { stage: "base", status: "pending", attempts_used: 0, failure_class: null },
          ],
        },
        openInput,
      ),
    ).toThrow();
  });

  it("acquire rejeita token vazio e número como texto", () => {
    expect(() =>
      parseAcquireStep(
        {
          acquired: true,
          authorization: "execute",
          reason: null,
          attempt_token: "",
          attempt_number: 1,
          stage: "base",
          target: "primary",
        },
        acquireInput,
      ),
    ).toThrow();
    expect(() =>
      parseAcquireStep(
        {
          acquired: true,
          authorization: "execute",
          reason: null,
          attempt_token: "t",
          attempt_number: "1",
          stage: "base",
          target: "primary",
        },
        acquireInput,
      ),
    ).toThrow();
  });

  it("resume rejeita campos ausentes e incoerência de target", () => {
    expect(() =>
      parseResumeOperation({
        success: true,
        action: "acquire_base",
        next_target: "primary",
        credit_status: "reserved",
        base_status: "pending",
        base_attempts: 0,
        expansion_status: "pending",
        expansion_attempts: 0,
        unknown: false,
        failed_outcome: false,
      }),
    ).toThrow();
    expect(() =>
      parseResumeOperation({
        success: true,
        action: "wait",
        next_target: "primary",
        origin: "9_16_two_stage",
        credit_status: "reserved",
        base_status: "in_progress",
        base_attempts: 1,
        expansion_status: "pending",
        expansion_attempts: 0,
        unknown: false,
        failed_outcome: false,
      }),
    ).toThrow();
  });
});

describe("derivação financeira", () => {
  it("deriva somente da linha de crédito", () => {
    expect(deriveFinancialView({ status: "delivered" })).toMatchObject({
      delivered: true,
      terminal: true,
      reserved: false,
    });
    expect(deriveFinancialView({ status: "reserved" })).toMatchObject({
      delivered: false,
      terminal: false,
      reserved: true,
    });
  });
});
