// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { VerticalArtifactProbeResult } from "@/lib/product-9-16-two-stage/two-stage-financial-service";
import type {
  RecordOutcomeRequest,
  RecordOutcomeResult,
} from "@/lib/product-9-16-two-stage/types";
import type { TwoFormatReadResult } from "@/lib/product-two-format/delivery-reader";
import type { TwoFormatFormatView } from "@/lib/product-two-format/read-model";
import type { TwoFormatFormat } from "@/lib/product-two-format/types";
import type {
  TwoFormatDeliveryErrorCode,
  TwoFormatRefundInput,
  TwoFormatRefundResult,
} from "@/lib/product-two-format/joint-financial-client";

import type { JointSquareProbeResult } from "../orchestration/square-probe";
import {
  finalizeJointFailure,
  type JointFinalizeDeps,
  type JointFinalizeInput,
} from "../orchestration/finalize-joint-failure";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_ID = "44444444-4444-4444-8444-444444444444";
const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

function formatView(
  format: TwoFormatFormat,
  overrides: Partial<TwoFormatFormatView> = {},
): TwoFormatFormatView {
  return {
    format,
    state: "processing",
    creditRefunded: false,
    deliveryOperationId: format === "1:1" ? SQUARE_ID : OPERATION,
    artifactRole: format === "1:1" ? "square_original" : "vertical",
    artifactPath: null,
    supportReference: null,
    ...overrides,
  };
}

function readFound(overrides: {
  square?: Partial<TwoFormatFormatView>;
  vertical?: Partial<TwoFormatFormatView>;
} = {}): TwoFormatReadResult {
  return {
    kind: "found",
    view: {
      origin: "two_format_two_stage",
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      square: formatView("1:1", overrides.square),
      vertical: formatView("9:16", overrides.vertical),
      preferredThumbnail: null,
    },
  };
}

function squareProbe(): JointSquareProbeResult {
  return {
    kind: "integral",
    storagePath: SQUARE_PATH,
    artifactId: "artifact-square",
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  };
}

function verticalProbe(): VerticalArtifactProbeResult {
  return {
    kind: "integral",
    format: "9:16",
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    storagePath: VERTICAL_PATH,
    evidenceRef: "evidence-vertical",
  };
}

function outcomeOk(
  request: RecordOutcomeRequest,
  overrides: Partial<Extract<RecordOutcomeResult, { success: true }>> = {},
): RecordOutcomeResult {
  return {
    success: true,
    idempotent: false,
    outcome: request.outcome,
    stage: request.stage,
    supportReference: request.supportReference ?? null,
    ...overrides,
  };
}

function refundOk(
  format: TwoFormatFormat,
  overrides: Partial<Extract<TwoFormatRefundResult, { success: true }>> = {},
): TwoFormatRefundResult {
  return {
    success: true,
    idempotent: false,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format,
    deliveryOperationId: format === "1:1" ? SQUARE_ID : OPERATION,
    artifactRole: format === "1:1" ? "square_original" : "vertical",
    creditStatus: "refunded",
    campaignStatus: "error",
    storagePath: null,
    preferredFormat: null,
    projected: true,
    alreadyProjected: false,
    ...overrides,
  };
}

function twoFormatError(code: TwoFormatDeliveryErrorCode): Error {
  return Object.assign(new Error(code), {
    name: "TwoFormatDeliveryError",
    code,
  });
}

function attemptStartError(code: string): Error {
  return Object.assign(new Error(code), { name: "AttemptStartError", code });
}

function input(
  overrides: Partial<JointFinalizeInput> = {},
): JointFinalizeInput {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    stage: "base",
    outcomeKind: "definitive",
    supportReference: "support-1",
    ...overrides,
  };
}

interface DepsConfig {
  readonly read?: TwoFormatReadResult;
  readonly recordOutcome?: (request: RecordOutcomeRequest) => RecordOutcomeResult;
  readonly recordOutcomeThrows?: Error;
  readonly squareOutcomeThrows?: Error;
  readonly squareProbe?: JointSquareProbeResult;
  readonly verticalProbe?: VerticalArtifactProbeResult;
  readonly epoch?: number;
  readonly epochThrows?: Error;
  readonly refund?: (request: TwoFormatRefundInput) => TwoFormatRefundResult;
}

function makeDeps(config: DepsConfig = {}) {
  const order: string[] = [];
  const deps: JointFinalizeDeps = {
    recordOutcome: vi.fn(async (request: RecordOutcomeRequest) => {
      order.push("outcome:control");
      if (config.recordOutcomeThrows !== undefined) {
        throw config.recordOutcomeThrows;
      }
      return config.recordOutcome?.(request) ?? outcomeOk(request);
    }),
    recordFormatOutcome: vi.fn(async () => {
      order.push("outcome:square");
      if (config.squareOutcomeThrows !== undefined) {
        throw config.squareOutcomeThrows;
      }
    }),
    probeSquare: vi.fn(async () => {
      order.push("probe:1:1");
      return config.squareProbe ?? { kind: "absent" as const };
    }),
    probeVertical: vi.fn(async () => {
      order.push("probe:9:16");
      return config.verticalProbe ?? { kind: "absent" as const };
    }),
    getPublicationEpoch: vi.fn(async (_campaign: string, deliveryOperationId: string) => {
      order.push(`epoch:${deliveryOperationId}`);
      if (config.epochThrows !== undefined) throw config.epochThrows;
      return config.epoch ?? 7;
    }),
    refundFormat: vi.fn(async (request: TwoFormatRefundInput) => {
      order.push(`refund:${request.format}`);
      return config.refund?.(request) ?? refundOk(request.format);
    }),
    readFormatStatuses: vi.fn(async () => {
      order.push("read");
      return config.read ?? readFound();
    }),
  };
  return { deps, order };
}

describe("F60.7-06 — finalização D12 (falha, indeterminação, estorno parcial)", () => {
  it("Teste 1: base definitiva com as duas ausências ⇒ outcomes confirmados e depois os dois refunds", async () => {
    const { deps, order } = makeDeps();
    const result = await finalizeJointFailure(input(), deps);

    expect(result).toEqual({
      kind: "refunded",
      formats: ["1:1", "9:16"],
      idempotent: false,
      campaignStatus: "error",
    });
    expect(order).toEqual([
      "read",
      `epoch:${OPERATION}`,
      "probe:9:16",
      `epoch:${SQUARE_ID}`,
      "probe:1:1",
      "outcome:control",
      "outcome:square",
      "refund:9:16",
      "refund:1:1",
    ]);
    expect(deps.refundFormat).toHaveBeenCalledTimes(2);
  });

  it("Teste 1b: base definitiva + quadrado íntegro ⇒ delivery_required sem outcome/refund", async () => {
    const { deps } = makeDeps({ squareProbe: squareProbe() });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "delivery_required",
      format: "1:1",
      storagePath: SQUARE_PATH,
    });
    expect(deps.recordOutcome).not.toHaveBeenCalled();
    expect(deps.recordFormatOutcome).not.toHaveBeenCalled();
    expect(deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 1c: base definitiva + quadrado ausente + vertical presente ⇒ blocked sem refund", async () => {
    const { deps } = makeDeps({ verticalProbe: verticalProbe() });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "artifact_present",
      formats: ["9:16"],
      outcomeRecorded: false,
    });
    expect(deps.recordOutcome).not.toHaveBeenCalled();
    expect(deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 2: base desconhecida ⇒ unknown confirmado, sem refund", async () => {
    const { deps, order } = makeDeps();
    expect(
      await finalizeJointFailure(input({ outcomeKind: "unknown" }), deps),
    ).toEqual({ kind: "unknown", reason: "outcome_unknown" });
    expect(order).toEqual(["read", "outcome:control"]);
    expect(deps.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unknown", stage: "base" }),
    );
    expect(deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 3: sonda invalid/indeterminate ⇒ unknown confirmado, sem refund", async () => {
    const invalid = makeDeps({
      squareProbe: { kind: "invalid", reason: "checksum_mismatch" },
    });
    expect(await finalizeJointFailure(input(), invalid.deps)).toEqual({
      kind: "unknown",
      reason: "probe_invalid",
    });
    expect(invalid.deps.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unknown", stage: "base" }),
    );
    expect(invalid.deps.refundFormat).not.toHaveBeenCalled();

    const indeterminate = makeDeps({
      squareProbe: { kind: "indeterminate" },
    });
    expect(await finalizeJointFailure(input(), indeterminate.deps)).toEqual({
      kind: "unknown",
      reason: "probe_indeterminate",
    });
    expect(indeterminate.deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 4: falha de expansão com vertical ausente ⇒ só o vertical é estornado", async () => {
    const { deps, order } = makeDeps();
    const result = await finalizeJointFailure(
      input({ stage: "expansion" }),
      deps,
    );
    expect(result).toEqual({
      kind: "refunded",
      formats: ["9:16"],
      idempotent: false,
      campaignStatus: "error",
    });
    expect(order).toEqual([
      "read",
      `epoch:${OPERATION}`,
      "probe:9:16",
      "outcome:control",
      "refund:9:16",
    ]);
    expect(deps.recordFormatOutcome).not.toHaveBeenCalled();
    expect(deps.probeSquare).not.toHaveBeenCalled();
    expect(deps.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "expansion" }),
    );
  });

  it("Teste 5: falha de expansão com vertical íntegro ⇒ delivery_required sem outcome/refund", async () => {
    const { deps } = makeDeps({ verticalProbe: verticalProbe() });
    expect(
      await finalizeJointFailure(input({ stage: "expansion" }), deps),
    ).toEqual({
      kind: "delivery_required",
      format: "9:16",
      storagePath: VERTICAL_PATH,
    });
    expect(deps.recordOutcome).not.toHaveBeenCalled();
    expect(deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 6: falha de expansão desconhecida ⇒ unknown sem refund", async () => {
    const { deps } = makeDeps();
    expect(
      await finalizeJointFailure(
        input({ stage: "expansion", outcomeKind: "unknown" }),
        deps,
      ),
    ).toEqual({ kind: "unknown", reason: "outcome_unknown" });
    expect(deps.refundFormat).not.toHaveBeenCalled();
    expect(deps.probeVertical).not.toHaveBeenCalled();
  });

  it("Teste 7: epoch na identidade do formato, antes da sonda, e refund com identidade de controle", async () => {
    const { deps, order } = makeDeps();
    await finalizeJointFailure(input(), deps);

    expect(deps.getPublicationEpoch).toHaveBeenCalledWith(CAMPAIGN, OPERATION);
    expect(deps.getPublicationEpoch).toHaveBeenCalledWith(CAMPAIGN, SQUARE_ID);
    const verticalEpoch = order.indexOf(`epoch:${OPERATION}`);
    const verticalProbe = order.indexOf("probe:9:16");
    const squareEpoch = order.indexOf(`epoch:${SQUARE_ID}`);
    const squareProbeIndex = order.indexOf("probe:1:1");
    expect(verticalEpoch).toBeLessThan(verticalProbe);
    expect(squareEpoch).toBeLessThan(squareProbeIndex);

    expect(deps.refundFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: OPERATION,
        format: "9:16",
        artKind: "absent",
        observedEpoch: 7,
      }),
    );
    expect(deps.refundFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: OPERATION,
        format: "1:1",
        artKind: "absent",
        observedEpoch: 7,
      }),
    );
  });

  it("Teste 8: `delivered_not_refundable` no quadrado após o vertical ⇒ blocked sem segundo refund", async () => {
    const { deps } = makeDeps({
      refund: (request) =>
        request.format === "1:1"
          ? { success: false, reason: "delivered_not_refundable" }
          : refundOk(request.format),
    });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "delivered_not_refundable",
      formats: ["1:1"],
      outcomeRecorded: true,
    });
    expect(deps.refundFormat).toHaveBeenCalledTimes(2);
  });

  it("Teste 9: `artifact_present` ⇒ blocked sem presunção de estorno", async () => {
    const { deps } = makeDeps({
      refund: () => ({ success: false, reason: "artifact_present" }),
    });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "artifact_present",
      formats: ["9:16", "1:1"],
      outcomeRecorded: true,
    });
    expect(deps.refundFormat).toHaveBeenCalledTimes(1);
  });

  it("Teste 10: `publication_in_progress`/`evidence_stale` lançados ⇒ blocked", async () => {
    for (const code of ["publication_in_progress", "evidence_stale"] as const) {
      const run = makeDeps({ refund: () => { throw twoFormatError(code); } });
      expect(await finalizeJointFailure(input(), run.deps)).toEqual({
        kind: "blocked",
        code,
        formats: ["9:16", "1:1"],
        outcomeRecorded: true,
      });
      expect(run.deps.refundFormat).toHaveBeenCalledTimes(1);
    }
  });

  it("Teste 11: `shared_operation_not_final`/`operation_in_progress` ⇒ blocked", async () => {
    for (const code of [
      "shared_operation_not_final",
      "operation_in_progress",
    ] as const) {
      const run = makeDeps({ refund: () => { throw twoFormatError(code); } });
      expect(await finalizeJointFailure(input(), run.deps)).toEqual({
        kind: "blocked",
        code,
        formats: ["9:16", "1:1"],
        outcomeRecorded: true,
      });
    }
  });

  it("Teste 12: idempotência — leitura já estornada e refund idempotente", async () => {
    const already = makeDeps({
      read: readFound({
        square: { state: "absent", creditRefunded: true },
        vertical: { state: "absent", creditRefunded: true },
      }),
    });
    expect(await finalizeJointFailure(input(), already.deps)).toEqual({
      kind: "refunded",
      formats: ["1:1", "9:16"],
      idempotent: true,
      campaignStatus: null,
    });
    expect(already.deps.refundFormat).not.toHaveBeenCalled();
    expect(already.deps.recordOutcome).not.toHaveBeenCalled();

    const replay = makeDeps({
      refund: (request) => refundOk(request.format, { idempotent: true }),
    });
    expect(
      await finalizeJointFailure(input({ stage: "expansion" }), replay.deps),
    ).toEqual({
      kind: "refunded",
      formats: ["9:16"],
      idempotent: true,
      campaignStatus: "error",
    });
  });

  it("Teste 13: `campaignStatus` vem do último refund; partial é null", async () => {
    const { deps } = makeDeps({
      refund: (request) =>
        refundOk(request.format, { campaignStatus: "error" }),
    });
    const result = await finalizeJointFailure(input(), deps);
    expect(result.kind).toBe("refunded");
    if (result.kind !== "refunded") throw new Error("esperava refunded");
    expect(result.campaignStatus).toBe("error");
  });

  it("Teste 14: formato entregue/indeterminado nunca é estornado; link ausente bloqueia", async () => {
    const delivered = makeDeps({
      read: readFound({ square: { state: "delivered" } }),
    });
    expect(await finalizeJointFailure(input(), delivered.deps)).toEqual({
      kind: "blocked",
      code: "delivered_not_refundable",
      formats: ["1:1"],
      outcomeRecorded: false,
    });
    expect(delivered.deps.refundFormat).not.toHaveBeenCalled();

    const unknown = makeDeps({
      read: readFound({ square: { state: "unknown" } }),
    });
    expect(await finalizeJointFailure(input(), unknown.deps)).toEqual({
      kind: "unknown",
      reason: "format_unknown",
    });
    expect(unknown.deps.refundFormat).not.toHaveBeenCalled();

    const noLink = makeDeps({
      read: readFound({ square: { deliveryOperationId: null } }),
    });
    expect(await finalizeJointFailure(input(), noLink.deps)).toEqual({
      kind: "blocked",
      code: "delivery_link_missing",
      formats: ["1:1"],
      outcomeRecorded: false,
    });
    expect(noLink.deps.recordOutcome).not.toHaveBeenCalled();
  });

  it("Teste 15: falha entre outcome e refund ⇒ blocked, sem refund do quadrado", async () => {
    const { deps } = makeDeps({
      refund: () => { throw twoFormatError("publication_in_progress"); },
    });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "publication_in_progress",
      formats: ["9:16", "1:1"],
      outcomeRecorded: true,
    });
    expect(deps.recordOutcome).toHaveBeenCalledTimes(1);
    expect(deps.recordFormatOutcome).toHaveBeenCalledTimes(1);
    expect(deps.refundFormat).toHaveBeenCalledTimes(1);
  });

  it("Teste 16: falha entre os dois estornos e retomada com estado persistido (duas invocações)", async () => {
    let sharedRefunded = false;
    let failSquare = true;

    const deps: JointFinalizeDeps = {
      recordOutcome: vi.fn(
        async (request: RecordOutcomeRequest): Promise<RecordOutcomeResult> => {
          // Reproduz o SQL real: terminal ANTES da idempotência.
          if (sharedRefunded) {
            return { success: false, reason: "operation_terminal" };
          }
          return outcomeOk(request);
        },
      ),
      recordFormatOutcome: vi.fn(async () => undefined),
      probeSquare: vi.fn(async () => ({ kind: "absent" as const })),
      probeVertical: vi.fn(async () => ({ kind: "absent" as const })),
      getPublicationEpoch: vi.fn(async () => 7),
      refundFormat: vi.fn(async (request) => {
        if (request.format === "9:16") {
          sharedRefunded = true;
          return refundOk("9:16");
        }
        if (failSquare) {
          failSquare = false;
          throw twoFormatError("evidence_stale");
        }
        return refundOk("1:1");
      }),
      readFormatStatuses: vi.fn(async () =>
        readFound({
          vertical: sharedRefunded
            ? { state: "absent", creditRefunded: true }
            : {},
        }),
      ),
    };

    const first = await finalizeJointFailure(input(), deps);
    expect(first).toEqual({
      kind: "partial",
      refunded: ["9:16"],
      pending: ["1:1"],
      code: "evidence_stale",
      campaignStatus: null,
    });

    const second = await finalizeJointFailure(input(), deps);
    expect(second).toEqual({
      kind: "refunded",
      formats: ["1:1", "9:16"],
      idempotent: false,
      campaignStatus: "error",
    });

    // O outcome do controle NÃO é regravado na retomada (o fake recusaria).
    expect(deps.recordOutcome).toHaveBeenCalledTimes(1);
    expect(deps.recordFormatOutcome).toHaveBeenCalledTimes(2);
    const refundCalls = vi.mocked(deps.refundFormat).mock.calls;
    expect(refundCalls.filter(([request]) => request.format === "9:16")).toHaveLength(1);
    expect(refundCalls.filter(([request]) => request.format === "1:1")).toHaveLength(2);
    expect(deps.probeVertical).toHaveBeenCalledTimes(1);
    expect(deps.probeSquare).toHaveBeenCalledTimes(2);
  });

  it("Teste 17: corrida de entrega no quadrado ⇒ blocked, terminal prevalece", async () => {
    const { deps } = makeDeps({
      refund: (request) =>
        request.format === "1:1"
          ? { success: false, reason: "delivered_not_refundable" }
          : refundOk(request.format),
    });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "delivered_not_refundable",
      formats: ["1:1"],
      outcomeRecorded: true,
    });
    expect(deps.recordFormatOutcome).toHaveBeenCalledTimes(1);
  });

  it("Teste 18: outcome do CONTROLE não confirmado ⇒ blocked sem refund", async () => {
    const { deps } = makeDeps({
      recordOutcome: () => ({
        success: false,
        reason: "operation_identity_conflict",
      }),
    });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "operation_identity_conflict",
      formats: ["9:16", "1:1"],
      outcomeRecorded: false,
    });
    expect(deps.recordFormatOutcome).not.toHaveBeenCalled();
    expect(deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 19: outcome do QUADRADO não confirmado ⇒ blocked sem refund", async () => {
    const { deps } = makeDeps({
      squareOutcomeThrows: attemptStartError("operation_terminal"),
    });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "unknown",
      formats: ["9:16", "1:1"],
      outcomeRecorded: false,
    });
    expect(deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 20: `unknown` persistido recusa `failed` e não é sobrescrito", async () => {
    const { deps } = makeDeps({
      recordOutcome: () => ({
        success: false,
        reason: "operation_identity_conflict",
      }),
    });
    expect(await finalizeJointFailure(input(), deps)).toEqual({
      kind: "blocked",
      code: "operation_identity_conflict",
      formats: ["9:16", "1:1"],
      outcomeRecorded: false,
    });
    expect(deps.recordOutcome).toHaveBeenCalledTimes(1);
    expect(deps.refundFormat).not.toHaveBeenCalled();
  });

  it("Teste 21: bloqueio de leitura é `unavailable`, separado dos códigos financeiros", async () => {
    for (const reason of [
      "not_found",
      "not_two_format",
      "inconsistent",
      "read_failed",
    ] as const) {
      const read: TwoFormatReadResult =
        reason === "inconsistent" || reason === "read_failed"
          ? { kind: reason, reason: "detail" }
          : { kind: reason };
      const run = makeDeps({ read });
      expect(await finalizeJointFailure(input(), run.deps)).toEqual({
        kind: "unavailable",
        reason,
      });
      expect(run.deps.recordOutcome).not.toHaveBeenCalled();
      expect(run.deps.refundFormat).not.toHaveBeenCalled();
    }
  });
});
