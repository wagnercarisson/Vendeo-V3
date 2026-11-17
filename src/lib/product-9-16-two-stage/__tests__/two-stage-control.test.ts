import { describe, expect, it, vi } from "vitest";
import {
  parseAcquireStep,
  parseFinishStep,
  parseOpenOperation,
  parseRecordOutcome,
  parseResumeOperation,
  ProductTwoStageOperationClient,
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
    if (!result.success) return;
    // A v1 REAL não devolve `contract_version`: a versão vem do caminho invocado.
    expect(result.contractVersion).toBe(1);
    expect(result.selection).toBeUndefined();
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

const FROZEN_SELECTION = {
  model: "gpt-image-2.5-flare",
  quality: "medium",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

const OPEN_STEPS = [
  { stage: "base", status: "pending", attempts_used: 0, failure_class: null },
  { stage: "expansion", status: "pending", attempts_used: 0, failure_class: null },
];

/** Envelope v1 LITERAL: copiado da forma real da RPC v1 (sem `contract_version`). */
const V1_OPEN_ENVELOPE = {
  success: true,
  idempotent: false,
  status: "reserved",
  campaign_id: "c",
  operation_id: "o",
  origin: "9_16_two_stage",
  steps: OPEN_STEPS,
};

const V2_OPEN_ENVELOPE = {
  ...V1_OPEN_ENVELOPE,
  contract_version: 2,
  expansion_model: FROZEN_SELECTION.model,
  expansion_quality: FROZEN_SELECTION.quality,
  expansion_config_version_id: FROZEN_SELECTION.configVersionId,
  expansion_selection_origin: "configured",
};

function fakeRpcClient(envelope: unknown) {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      rpc: async (name: string, params: Record<string, unknown>) => {
        calls.push({ name, params });
        return { data: envelope, error: null };
      },
    } as never,
  };
}

const OPEN_INPUT = { storeId: "s", campaignId: "c", operationId: "o" };

describe("abertura v1/v2 pelo caminho invocado", () => {
  it("com seleção valida usa a v2 com exatamente os seis parâmetros", async () => {
    const { calls, client } = fakeRpcClient(V2_OPEN_ENVELOPE);
    const operationClient = new ProductTwoStageOperationClient(client);
    const result = await operationClient.open({
      ...OPEN_INPUT,
      selection: FROZEN_SELECTION,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("product_9_16_open_operation_v2");
    expect(Object.keys(calls[0].params).sort()).toEqual(
      [
        "p_campaign_id",
        "p_expansion_config_version_id",
        "p_expansion_model",
        "p_expansion_quality",
        "p_operation_id",
        "p_store_id",
      ].sort(),
    );
    expect(calls[0].params).toEqual({
      p_store_id: "s",
      p_campaign_id: "c",
      p_operation_id: "o",
      p_expansion_model: FROZEN_SELECTION.model,
      p_expansion_quality: FROZEN_SELECTION.quality,
      p_expansion_config_version_id: FROZEN_SELECTION.configVersionId,
    });
    expect(calls[0].params).not.toHaveProperty("p_actor_id");
    expect(calls[0].params).not.toHaveProperty("p_selection");
    expect(result).toMatchObject({
      success: true,
      contractVersion: 2,
      selection: {
        model: FROZEN_SELECTION.model,
        quality: FROZEN_SELECTION.quality,
        configVersionId: FROZEN_SELECTION.configVersionId,
        origin: "configured",
      },
    });
  });

  it("sem seleção usa a v1 e aceita o envelope real sem contract_version", async () => {
    const { calls, client } = fakeRpcClient(V1_OPEN_ENVELOPE);
    const operationClient = new ProductTwoStageOperationClient(client);
    const result = await operationClient.open(OPEN_INPUT);

    expect(calls[0].name).toBe("product_9_16_open_operation");
    expect(Object.keys(calls[0].params).sort()).toEqual(
      ["p_campaign_id", "p_operation_id", "p_store_id"].sort(),
    );
    expect(result).toMatchObject({ success: true, contractVersion: 1 });
    if (!result.success) return;
    expect(result.selection).toBeUndefined();
  });

  it("deriva a versão do caminho: o mesmo envelope v1 falha na v2", () => {
    // Prova que a expectativa vem do caminho invocado (`selection` válida), não
    // de um default do parser: o payload v1 é aceito na v1 e recusado na v2.
    expect(parseOpenOperation(V1_OPEN_ENVELOPE, OPEN_INPUT)).toMatchObject({
      success: true,
      contractVersion: 1,
    });
    expect(() =>
      parseOpenOperation(V1_OPEN_ENVELOPE, {
        ...OPEN_INPUT,
        selection: FROZEN_SELECTION,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_envelope" }));
  });

  it("v1 recusa contract_version 2 e qualquer coluna expansion_*", () => {
    expect(() =>
      parseOpenOperation(
        { ...V1_OPEN_ENVELOPE, contract_version: 2 },
        OPEN_INPUT,
      ),
    ).toThrowError(expect.objectContaining({ code: "invalid_envelope" }));
    for (const key of [
      "expansion_model",
      "expansion_quality",
      "expansion_config_version_id",
      "expansion_selection_origin",
    ]) {
      expect(() =>
        parseOpenOperation(
          { ...V1_OPEN_ENVELOPE, [key]: null },
          OPEN_INPUT,
        ),
      ).toThrowError(expect.objectContaining({ code: "invalid_envelope" }));
    }
  });

  it("v2 é estrita: falta de qualquer chave do envelope falha fechado", () => {
    for (const key of [
      "contract_version",
      "expansion_model",
      "expansion_quality",
      "expansion_config_version_id",
      "expansion_selection_origin",
    ]) {
      const incomplete: Record<string, unknown> = { ...V2_OPEN_ENVELOPE };
      delete incomplete[key];
      expect(() =>
        parseOpenOperation(incomplete, { ...OPEN_INPUT, selection: FROZEN_SELECTION }),
      ).toThrowError(expect.objectContaining({ code: "invalid_envelope" }));
    }
    expect(() =>
      parseOpenOperation(
        {
          ...V2_OPEN_ENVELOPE,
          expansion_selection_origin: ["legacy", "sunburst", "low"].join("_"),
        },
        { ...OPEN_INPUT, selection: FROZEN_SELECTION },
      ),
    ).toThrowError(expect.objectContaining({ code: "invalid_envelope" }));
  });

  it("operation_config_conflict chega tipado, sem virar invalid_envelope", async () => {
    const { client } = fakeRpcClient({
      success: false,
      reason: "operation_config_conflict",
    });
    const operationClient = new ProductTwoStageOperationClient(client);
    await expect(
      operationClient.open({ ...OPEN_INPUT, selection: FROZEN_SELECTION }),
    ).resolves.toEqual({ success: false, reason: "operation_config_conflict" });

    const origin = fakeRpcClient({
      success: false,
      reason: "operation_origin_conflict",
    });
    await expect(
      new ProductTwoStageOperationClient(origin.client).open(OPEN_INPUT),
    ).resolves.toEqual({ success: false, reason: "operation_origin_conflict" });
  });
});
