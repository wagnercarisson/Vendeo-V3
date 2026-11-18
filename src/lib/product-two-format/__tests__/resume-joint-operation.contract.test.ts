// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  LEGACY_SUNBURST_LOW,
  type ExpansionSelection,
} from "@/lib/ai/nine-sixteen-expansion-model-config";
import type { ReconstructedContent } from "@/lib/product-9-16-two-stage/orchestration/reconstruction";
import type {
  StepView,
  TwoStageOperationView,
  TwoStageStepStatus,
} from "@/lib/product-9-16-two-stage/types";

import type { TwoFormatReadResult } from "../delivery-reader";
import type { TwoFormatFormatView } from "../read-model";
import type { JointSquareProbeResult } from "../orchestration/square-probe";
import {
  resumeJointOperation,
  type JointResumeDeps,
  type JointResumeOperationInput,
} from "../orchestration/resume-joint-operation";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_ID = "44444444-4444-4444-8444-444444444444";
const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

function integralSquare(): JointSquareProbeResult {
  return {
    kind: "integral",
    storagePath: SQUARE_PATH,
    artifactId: "artifact-square",
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  };
}

const CONFIGURED_SELECTION: ExpansionSelection = {
  model: "gpt-image-2.5-flare",
  quality: "medium",
  configVersionId: "cfg-2",
  origin: "configured",
};

const CONTENT: ReconstructedContent = {
  briefing: {
    backgroundDirection: "studio",
    product: { name: "Produto", description: null },
    commercial: {
      intent: "offer",
      originalPriceText: null,
      discountedPriceText: null,
      badge: null,
      validity: null,
    },
    constraints: { mandatoryArtworkText: null },
  },
  briefingText: "{}",
  campaignIntent: "offer",
  backgroundDirection: "studio",
  productImagesDataUrls: ["data:image/png;base64,AAA"],
  referenceSelections: [],
  usdBrlRateAtGeneration: null,
  creditValueBrlAtGeneration: null,
};

function formatView(
  format: "1:1" | "9:16",
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

function stepView(
  stage: "base" | "expansion",
  status: TwoStageStepStatus = "done",
): StepView {
  return {
    stage,
    status,
    attemptsUsed: 1,
    failureClass: null,
    attemptNumber: null,
    claimedAt: null,
  };
}

function operationView(
  overrides: Partial<TwoStageOperationView> = {},
): TwoStageOperationView {
  return {
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    origin: "9_16_two_stage",
    contractVersion: 2,
    frozenSelection: CONFIGURED_SELECTION,
    credit: {
      status: "reserved",
      terminal: false,
      delivered: false,
      refunded: false,
      reserved: true,
    },
    base: stepView("base"),
    expansion: stepView("expansion"),
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "deliver",
    canContinue: true,
    processingPhase: null,
    ...overrides,
  };
}

function input(
  overrides: Partial<JointResumeOperationInput> = {},
): JointResumeOperationInput {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    authorization: { kind: "system" },
    acquisitionId: "55555555-5555-4555-8555-555555555555",
    attemptReference: "ref-1",
    deadlineAtMs: Date.now() + 60_000,
    allowNewPaidStep: true,
    ...overrides,
  };
}

interface DepsConfig {
  readonly read?: TwoFormatReadResult;
  readonly operation?: TwoStageOperationView;
  readonly operationLookup?: { kind: "absent" } | { kind: "read_failed"; reason: string };
  readonly probe?: JointSquareProbeResult;
  readonly probeThrows?: Error;
  readonly reconstructThrows?: Error;
  readonly reconstruct?: { ok: false; reason: string };
}

function makeDeps(config: DepsConfig = {}) {
  const order: string[] = [];
  const deps: JointResumeDeps = {
    readDelivery: vi.fn(async () => {
      order.push("read");
      return config.read ?? readFound();
    }),
    readOperationView: vi.fn(async () => {
      order.push("operation");
      if (config.operationLookup !== undefined) return config.operationLookup;
      return { kind: "found" as const, view: config.operation ?? operationView() };
    }),
    probeSquare: vi.fn(async () => {
      order.push("probe");
      if (config.probeThrows !== undefined) throw config.probeThrows;
      return config.probe ?? integralSquare();
    }),
    reconstruct: vi.fn(async () => {
      order.push("reconstruct");
      if (config.reconstructThrows !== undefined) throw config.reconstructThrows;
      return (
        config.reconstruct ?? {
          ok: true as const,
          content: CONTENT,
          frozenState: { kind: "absent" as const },
        }
      );
    }),
    runBase: vi.fn(async () => {
      order.push("base");
      return { kind: "completed" as const };
    }),
    deliverSquare: vi.fn(async () => {
      order.push("square");
      return {
        kind: "delivered" as const,
        idempotent: false,
        campaignStatus: "ready",
        storagePath: SQUARE_PATH,
      };
    }),
    deliverVertical: vi.fn(async () => {
      order.push("vertical");
      return {
        kind: "delivered" as const,
        idempotent: false,
        campaignStatus: "ready",
        storagePath: VERTICAL_PATH,
      };
    }),
    repairProjection: vi.fn(async () => {
      order.push("repair");
      return {
        kind: "repaired" as const,
        projected: true,
        alreadyProjected: false,
        thumbnails: [],
      };
    }),
  };
  return { deps, order };
}

describe("F60.7-07 — executor da continuação", () => {
  it("Teste 1: leitura não `found` bloqueia com o motivo, sem efeitos", async () => {
    for (const [read, reason] of [
      [{ kind: "not_found" }, "not_found"],
      [{ kind: "not_two_format" }, "not_two_format"],
      [{ kind: "inconsistent", reason: "x" }, "inconsistent"],
      [{ kind: "read_failed", reason: "x" }, "read_failed"],
    ] as const) {
      const run = makeDeps({ read });
      expect(await resumeJointOperation(input(), run.deps)).toEqual({
        kind: "blocked",
        reason,
      });
      expect(run.deps.runBase).not.toHaveBeenCalled();
      expect(run.deps.deliverSquare).not.toHaveBeenCalled();
      expect(run.deps.deliverVertical).not.toHaveBeenCalled();
    }
  });

  it("Teste 2: quadrado entregue + vertical reservado ⇒ só o vertical", async () => {
    const { deps } = makeDeps({
      read: readFound({ square: { state: "delivered" } }),
    });
    const outcome = await resumeJointOperation(input(), deps);
    expect(outcome).toMatchObject({
      kind: "executed",
      action: "run_vertical_only",
    });
    expect(deps.deliverVertical).toHaveBeenCalledTimes(1);
    expect(deps.runBase).not.toHaveBeenCalled();
    expect(deps.deliverSquare).not.toHaveBeenCalled();
  });

  it("Teste 3: settle_square ⇒ uma sonda do planejador e uma delegação, sem base", async () => {
    const { deps, order } = makeDeps();
    const outcome = await resumeJointOperation(input(), deps);
    expect(outcome).toMatchObject({ kind: "settle_square" });
    expect(order).toEqual(["read", "probe", "operation", "square"]);
    expect(deps.deliverSquare).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      deliveryOperationId: SQUARE_ID,
    });
    expect(deps.runBase).not.toHaveBeenCalled();
    expect(deps.deliverVertical).not.toHaveBeenCalled();
  });

  it("Teste 4: run_base ⇒ uma chamada, sem vertical/quadrado", async () => {
    const { deps } = makeDeps({ probe: { kind: "absent" } });
    const outcome = await resumeJointOperation(
      input({ attemptTarget: "primary" }),
      deps,
    );
    expect(outcome).toMatchObject({ kind: "executed", action: "run_base" });
    expect(deps.runBase).toHaveBeenCalledTimes(1);
    expect(deps.deliverVertical).not.toHaveBeenCalled();
    expect(deps.deliverSquare).not.toHaveBeenCalled();
  });

  it("Teste 5: repair_only ⇒ somente reparo", async () => {
    const { deps } = makeDeps({
      read: readFound({
        square: { state: "delivered", artifactPath: SQUARE_PATH },
        vertical: { state: "delivered", artifactPath: VERTICAL_PATH },
      }),
    });
    const outcome = await resumeJointOperation(input(), deps);
    expect(outcome).toMatchObject({
      kind: "executed",
      action: "repair_only",
    });
    expect(deps.repairProjection).toHaveBeenCalledTimes(1);
    expect(deps.runBase).not.toHaveBeenCalled();
    expect(deps.deliverSquare).not.toHaveBeenCalled();
    expect(deps.deliverVertical).not.toHaveBeenCalled();
  });

  it("Teste 6: terminal parcial e pendência de estorno, sem efeitos", async () => {
    const partial = makeDeps({
      read: readFound({
        square: { state: "delivered" },
        vertical: { state: "absent", creditRefunded: true },
      }),
    });
    expect(await resumeJointOperation(input(), partial.deps)).toEqual({
      kind: "partial_terminal",
      creditRefundedFormats: ["9:16"],
    });

    const pending = makeDeps({
      read: readFound({ vertical: { state: "absent", creditRefunded: true } }),
    });
    expect(await resumeJointOperation(input(), pending.deps)).toEqual({
      kind: "pending_finalization",
      refundedFormats: ["9:16"],
    });
    for (const run of [partial, pending]) {
      expect(run.deps.runBase).not.toHaveBeenCalled();
      expect(run.deps.deliverSquare).not.toHaveBeenCalled();
      expect(run.deps.deliverVertical).not.toHaveBeenCalled();
    }
  });

  it("Teste 7: `unknown` bloqueia sem retry", async () => {
    const { deps } = makeDeps({
      read: readFound({ square: { state: "unknown" } }),
    });
    expect(await resumeJointOperation(input(), deps)).toEqual({
      kind: "blocked",
      reason: "unknown",
    });
    expect(deps.runBase).not.toHaveBeenCalled();
  });

  it("Teste 8: leitura parcial bloqueia e preserva o irmão entregue", async () => {
    const { deps } = makeDeps({
      read: readFound({
        square: { state: "delivered" },
        vertical: { state: "unavailable" },
      }),
    });
    expect(await resumeJointOperation(input(), deps)).toEqual({
      kind: "blocked",
      reason: "partial_read",
    });
    expect(deps.deliverVertical).not.toHaveBeenCalled();
  });

  it("Teste 9: fail_closed bloqueia sem geração", async () => {
    const absentVertical = makeDeps({
      read: readFound({ vertical: { state: "delivered" } }),
      probe: { kind: "absent" },
    });
    expect(await resumeJointOperation(input(), absentVertical.deps)).toEqual({
      kind: "blocked",
      reason: "base_missing",
    });

    const invalid = makeDeps({ probe: { kind: "invalid", reason: "x" } });
    expect(await resumeJointOperation(input(), invalid.deps)).toEqual({
      kind: "blocked",
      reason: "artifact_invalid",
    });

    const indeterminate = makeDeps({ probe: { kind: "indeterminate" } });
    expect(await resumeJointOperation(input(), indeterminate.deps)).toEqual({
      kind: "blocked",
      reason: "artifact_indeterminate",
    });
    for (const run of [absentVertical, invalid, indeterminate]) {
      expect(run.deps.runBase).not.toHaveBeenCalled();
      expect(run.deps.deliverSquare).not.toHaveBeenCalled();
    }
  });

  it("Teste 10: o executor não abre operação, não reserva, não estorna e não projeta", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/resume-joint-operation.ts",
      ),
      "utf8",
    );
    for (const forbidden of [
      "openJointOperation(",
      "finalizeJointFailure(",
      "projectCampaign(",
      "generateThumbnail(",
      "readNineSixteenExpansionConfig(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("Teste 11: o leitor é chamado uma vez com a identidade da entrada", async () => {
    const { deps } = makeDeps();
    await resumeJointOperation(input(), deps);
    expect(deps.readDelivery).toHaveBeenCalledTimes(1);
    expect(deps.readDelivery).toHaveBeenCalledWith({
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      storeId: STORE,
    });
  });

  it("Teste 12: seleção congelada, expansionStatus e attemptTarget derivados de uma leitura", async () => {
    const configured = makeDeps({
      read: readFound({ square: { state: "delivered" } }),
      operation: operationView({ nextAction: "retry_expansion" }),
    });
    await resumeJointOperation(input({ attemptReference: "ref-9" }), configured.deps);
    expect(configured.deps.readOperationView).toHaveBeenCalledTimes(1);
    expect(configured.deps.deliverVertical).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: CONFIGURED_SELECTION,
        expansionStatus: "done",
        attemptTarget: "retry",
        attemptReference: "ref-9",
      }),
    );

    const legacy = makeDeps({
      read: readFound({ square: { state: "delivered" } }),
      operation: operationView({
        contractVersion: 1,
        frozenSelection: null,
      }),
    });
    await resumeJointOperation(input(), legacy.deps);
    expect(legacy.deps.deliverVertical).toHaveBeenCalledWith(
      expect.objectContaining({ selection: LEGACY_SUNBURST_LOW }),
    );

    const frozenMissing = makeDeps({
      read: readFound({ square: { state: "delivered" } }),
      operation: operationView({ contractVersion: 2, frozenSelection: null }),
    });
    expect(await resumeJointOperation(input(), frozenMissing.deps)).toEqual({
      kind: "blocked",
      reason: "frozen_selection_missing",
    });
    expect(frozenMissing.deps.deliverVertical).not.toHaveBeenCalled();
  });

  it("Teste 13: run_base reconstrói antes e recebe content/frozenState reais", async () => {
    const failing = makeDeps({
      probe: { kind: "absent" },
      reconstruct: { ok: false, reason: "inputs_missing" },
    });
    expect(
      await resumeJointOperation(input({ attemptTarget: "primary" }), failing.deps),
    ).toEqual({ kind: "blocked", reason: "reconstruction_failed" });
    expect(failing.deps.runBase).not.toHaveBeenCalled();

    const success = makeDeps({ probe: { kind: "absent" } });
    await resumeJointOperation(
      input({ attemptTarget: "primary", attemptReference: "ref-2" }),
      success.deps,
    );
    expect(success.deps.runBase).toHaveBeenCalledWith(
      expect.objectContaining({
        content: CONTENT,
        frozenState: { kind: "absent" },
        baseStatus: "done",
        attemptTarget: "primary",
        attemptReference: "ref-2",
      }),
    );
  });

  it("Teste 14: autoridade durável bloqueia run_base", async () => {
    const cases = [
      {
        config: { operationLookup: { kind: "absent" as const } },
        reason: "operation_absent",
      },
      {
        config: {
          operationLookup: { kind: "read_failed" as const, reason: "x" },
        },
        reason: "operation_read_failed",
      },
      {
        config: { operation: operationView({ unknown: true }) },
        reason: "unknown",
      },
      {
        config: { operation: operationView({ failedOutcome: true }) },
        reason: "failed_outcome",
      },
      {
        config: {
          operation: operationView({
            base: stepView("base", "in_progress"),
          }),
        },
        reason: "operation_in_progress",
      },
      {
        config: {
          operation: operationView({ processingPhase: "step_in_progress" }),
        },
        reason: "operation_in_progress",
      },
      {
        config: { operation: operationView({ nextAction: "wait" }) },
        reason: "operation_in_progress",
      },
      {
        config: {
          operation: operationView({
            credit: {
              status: "delivered",
              terminal: true,
              delivered: true,
              refunded: false,
              reserved: false,
            },
          }),
        },
        reason: "operation_terminal",
      },
    ] as const;

    for (const item of cases) {
      const run = makeDeps({ probe: { kind: "absent" }, ...item.config });
      expect(
        await resumeJointOperation(
          input({ attemptTarget: "primary" }),
          run.deps,
        ),
      ).toEqual({ kind: "blocked", reason: item.reason });
      expect(run.deps.runBase).not.toHaveBeenCalled();
    }
  });

  it("Teste 15: autoridade durável bloqueia settle_square (delivered não bloqueia)", async () => {
    const blockedCases = [
      {
        config: { operationLookup: { kind: "absent" as const } },
        reason: "operation_absent",
      },
      {
        config: {
          operationLookup: { kind: "read_failed" as const, reason: "x" },
        },
        reason: "operation_read_failed",
      },
      {
        config: { operation: operationView({ unknown: true }) },
        reason: "unknown",
      },
      {
        config: { operation: operationView({ failedOutcome: true }) },
        reason: "failed_outcome",
      },
      {
        config: {
          operation: operationView({
            expansion: stepView("expansion", "in_progress"),
          }),
        },
        reason: "operation_in_progress",
      },
      {
        config: {
          operation: operationView({
            credit: {
              status: "refunded",
              terminal: true,
              delivered: false,
              refunded: true,
              reserved: false,
            },
          }),
        },
        reason: "operation_terminal",
      },
    ] as const;

    for (const item of blockedCases) {
      const run = makeDeps(item.config);
      expect(await resumeJointOperation(input(), run.deps)).toEqual({
        kind: "blocked",
        reason: item.reason,
      });
      expect(run.deps.deliverSquare).not.toHaveBeenCalled();
    }
  });

  it("Teste 16: exceção da sonda bloqueia com probe_failed", async () => {
    const { deps } = makeDeps({ probeThrows: new Error("storage") });
    expect(await resumeJointOperation(input(), deps)).toEqual({
      kind: "blocked",
      reason: "probe_failed",
    });
    expect(deps.runBase).not.toHaveBeenCalled();
    expect(deps.deliverSquare).not.toHaveBeenCalled();
    expect(deps.deliverVertical).not.toHaveBeenCalled();
  });

  it("Teste 17: vertical entregue + quadrado reservado + artefato íntegro ⇒ liquida só o quadrado", async () => {
    const { deps, order } = makeDeps({
      read: readFound({ vertical: { state: "delivered" } }),
      operation: operationView({
        credit: {
          status: "delivered",
          terminal: true,
          delivered: true,
          refunded: false,
          reserved: false,
        },
      }),
    });
    const outcome = await resumeJointOperation(input(), deps);
    expect(outcome).toMatchObject({ kind: "settle_square" });
    expect(order).toEqual(["read", "probe", "operation", "square"]);
    expect(deps.deliverSquare).toHaveBeenCalledTimes(1);
    expect(deps.deliverSquare).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryOperationId: SQUARE_ID }),
    );
    expect(deps.runBase).not.toHaveBeenCalled();
    expect(deps.deliverVertical).not.toHaveBeenCalled();
  });
});
