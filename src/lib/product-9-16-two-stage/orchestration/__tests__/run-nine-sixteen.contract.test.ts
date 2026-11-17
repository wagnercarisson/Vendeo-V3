// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/access", () => ({
  verifyCampaignAccess: async () => ({ ok: true, authorization: { kind: "system" } }),
}));
const logged = vi.hoisted(() => ({ events: [] as Record<string, unknown>[] }));
vi.mock("@/lib/logging/pipeline-logger", () => ({
  logPipelineEvent: (event: Record<string, unknown>) => {
    logged.events.push(event);
  },
}));
import { runNineSixteenTwoStageGeneration } from "../run-nine-sixteen";
import type { RunNineSixteenDeps, RunNineSixteenInput } from "../types";
import type { TwoStageOperationView } from "../../types";
import {
  DURABLE_BRIEFING,
  DURABLE_DATA_URL,
  durableReconstruction,
} from "./fixtures";

const BASE_ID = "11111111-1111-4111-8111-111111111111";
const EXPANSION_ID = "22222222-2222-4222-8222-222222222222";

/** Seleção congelada devolvida pelo preflight dos fakes. */
const CONFIGURED_SELECTION = {
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

const integralProbe = {
  kind: "integral" as const,
  format: "9:16" as const,
  width: 1080 as const,
  height: 1920 as const,
  mimeType: "image/jpeg" as const,
  storagePath: "store/c/vertical.jpg",
  evidenceRef: "e",
};

function step(stage: "base" | "expansion", status: TwoStageOperationView["base"]["status"], overrides: Record<string, unknown> = {}) {
  return {
    stage,
    status,
    attemptsUsed: status === "pending" ? 0 : 1,
    failureClass: null,
    attemptNumber: status === "pending" ? null : 1,
    claimedAt: null,
    ...overrides,
  };
}

function makeView(overrides: Partial<TwoStageOperationView> = {}): TwoStageOperationView {
  return {
    campaignId: "c",
    operationId: "o",
    origin: "9_16_two_stage",
    contractVersion: 1,
    frozenSelection: null,
    credit: { status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true },
    base: step("base", "done"),
    expansion: step("expansion", "done"),
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "deliver",
    canContinue: true,
    processingPhase: null,
    ...overrides,
  };
}

function resumeResult(action: string, overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    action,
    nextTarget: action === "acquire_base" || action === "retry_base" ? "primary" : "initial",
    origin: "9_16_two_stage",
    creditStatus: "reserved",
    baseStatus: "done",
    baseAttempts: 1,
    expansionStatus: "pending",
    expansionAttempts: 0,
    unknown: false,
    failedOutcome: false,
    ...overrides,
  };
}

function deliveryResume() {
  return resumeResult("deliver", {
    baseStatus: "done",
    expansionStatus: "done",
    expansionAttempts: 1,
  });
}

const completedBase = {
  kind: "completed",
  copy: { kind: "not_requested" },
  art: { kind: "created", artifact: {}, snapshotOriginalId: "s" },
  call: null,
};

function deps(overrides: Record<string, unknown> = {}): RunNineSixteenDeps {
  return {
    control: {
      getOperationView: vi.fn(async () => ({ kind: "found", view: makeView() })),
      resume: vi.fn(async () => resumeResult("deliver")),
      acquire: vi.fn(async (request: { stage: string }) => ({
        acquired: true,
        authorization: "execute",
        reason: null,
        attemptToken: "t",
        attemptNumber: 1,
        stage: request.stage,
        target: request.stage === "base" ? "primary" : "initial",
      })),
      finish: vi.fn(async (request: { stage?: string }) => ({
        success: true,
        idempotent: false,
        status: "completed",
        stage: request.stage ?? "base",
        attemptNumber: 1,
      })),
      recordOutcome: vi.fn(async (request: { outcome: string }) => ({
        success: true,
        idempotent: false,
        outcome: request.outcome,
        stage: "base",
        supportReference: null,
      })),
    },
    financial: {
      reserveOperationOnce: vi.fn(async () => ({ status: "reserved" })),
      confirmOnVerticalDelivery: vi.fn(async () => ({ status: "delivered" })),
      refundOnDefinitiveFailure: vi.fn(async () => ({
        kind: "refunded",
        state: { status: "refunded" },
      })),
      readFinancialAuthority: vi.fn(async () => ({
        status: "reserved",
        terminal: false,
        delivered: false,
        refunded: false,
        reserved: true,
        storeId: "s",
      })),
    },
    credit: {
      beginPublication: vi.fn(async () => ({ acquired: true, token: "t" })),
      getPublicationEpoch: vi.fn(async () => 1),
      markArtUploaded: vi.fn(),
      deliver: vi.fn(),
    },
    clock: () => 0,
    callIdFactory: () => "call",
    newSupportReference: () => "ref",
    base: vi.fn(async () => completedBase),
    prepare: vi.fn(async () => ({
      kind: "prepared",
      artifact: {},
      bytes: Buffer.alloc(0),
      persistence: "created",
    })),
    expand: vi.fn(async () => ({
      kind: "expanded",
      artifact: {},
      bytes: Buffer.alloc(0),
      persistence: "created",
      call: {},
    })),
    readFrozenState: vi.fn(async () => ({ kind: "complete" })),
    retrieveCompositionArtifact: vi.fn(async () => ({
      kind: "integral",
      artifact: { id: "prepared" },
      bytes: Buffer.alloc(0),
    })),
    probeExpansion: vi.fn(async () => ({ kind: "proceed" })),
    projectDelivered: vi.fn(async () => ({ projected: true, reason: "projected" })),
    projectClosed: vi.fn(async () => ({ projected: true, reason: "projected" })),
    probeVertical: { probeVerticalArtifact: vi.fn(async () => integralProbe) },
    preflightExpansion: vi.fn(async () => ({
      ok: true,
      selection: CONFIGURED_SELECTION,
    })),
    generateThumbnail: vi.fn(async () => ({ status: "created" })),
    reconstruction: durableReconstruction(),
    ...overrides,
  } as never;
}

function initialInput(overrides: Partial<RunNineSixteenInput> = {}): RunNineSixteenInput {
  return {
    mode: "initial",
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    requestStartedAtMs: 0,
    ...overrides,
  };
}

function continueInput(overrides: Partial<RunNineSixteenInput> = {}): RunNineSixteenInput {
  return {
    mode: "continue",
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    requestStartedAtMs: 0,
    acquisitionIds: { base: BASE_ID, expansion: EXPANSION_ID },
    ...overrides,
  };
}

async function run(
  input: RunNineSixteenInput,
  d: RunNineSixteenDeps,
): Promise<Array<Record<string, unknown>>> {
  const response = await runNineSixteenTwoStageGeneration(input, d);
  const text = await response.text();
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function terminal(events: Array<Record<string, unknown>>): Record<string, unknown> {
  return events.at(-1) ?? {};
}

function terminals(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return events.filter((event) =>
    ["result", "error", "unknown", "processing"].includes(String(event.type)),
  );
}

function calls(d: unknown, path: string): unknown[] {
  const value = path.split(".").reduce<Record<string, unknown>>(
    (current, key) => current[key] as Record<string, unknown>,
    d as Record<string, unknown>,
  );
  return (value as { mock: { calls: unknown[] } }).mock.calls;
}

describe("runNineSixteenTwoStageGeneration", () => {
  beforeEach(() => {
    logged.events.length = 0;
  });

  it("initial with an existing operation is query-only (no reserve/resume/provider/preflight)", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            credit: { status: "delivered", terminal: true, delivered: true, refunded: false, reserved: false },
            nextAction: "deliver",
          }),
        })),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(initialInput(), d);
    expect(terminal(events)).toMatchObject({ type: "result", campaignId: "c" });
    expect(calls(d, "financial.reserveOperationOnce")).toHaveLength(0);
    expect(calls(d, "control.resume")).toHaveLength(0);
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
    expect(calls(d, "preflightExpansion")).toHaveLength(0);
  });

  it("preflight de pricing falho bloqueia ANTES da reserva e de qualquer chamada paga", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "pricing_unavailable",
        reason: "incomplete_coverage",
        missing: ["imageTokenUsdPer1M"],
      })),
    });

    const events = await run(initialInput(), d);

    expect(terminal(events)).toMatchObject({
      type: "error",
      code: "configuration_unavailable",
      reason: "pricing_unavailable:incomplete_coverage",
    });
    expect(calls(d, "financial.reserveOperationOnce")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
    expect(calls(d, "prepare")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    expect(logged.events).toEqual([
      expect.objectContaining({
        event: "expansion_preflight_failed",
        errorCode: "pricing_unavailable:incomplete_coverage",
        metadata: expect.objectContaining({
          stage: "base",
          missing: ["imageTokenUsdPer1M"],
        }),
      }),
    ]);
  });

  it("preflight de modelo falho distingue modelo de pricing e não reserva", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "model_unavailable",
        reason: "catalog_row_missing",
        missing: [],
      })),
    });

    const events = await run(initialInput(), d);

    expect(terminal(events)).toMatchObject({
      type: "error",
      code: "configuration_unavailable",
      reason: "model_unavailable:catalog_row_missing",
    });
    expect(calls(d, "financial.reserveOperationOnce")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
    expect(logged.events[0]).toMatchObject({
      event: "expansion_preflight_failed",
      errorCode: "model_unavailable:catalog_row_missing",
    });
  });

  it("preflight de leitura indeterminada bloqueia a geração nova sem reserva e sem inventar causa", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "configuration_read_failed",
        reason: "catalog_read_failed",
        missing: [],
      })),
    });

    const events = await run(initialInput(), d);

    expect(terminal(events)).toMatchObject({
      type: "error",
      code: "configuration_unavailable",
      reason: "configuration_read_failed:catalog_read_failed",
    });
    expect(calls(d, "financial.reserveOperationOnce")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
    expect(logged.events[0]).toMatchObject({
      event: "expansion_preflight_indeterminate",
      errorCode: "configuration_read_failed:catalog_read_failed",
    });
  });

  it("continuação com leitura indeterminada permanece recuperável, sem estorno nem desfecho", async () => {
    const d = deps({
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "configuration_read_failed",
        reason: "pricing_read_failed",
        missing: [],
      })),
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("acquire_base", {
            baseStatus: "pending",
            baseAttempts: 0,
          }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });

    const events = await run(continueInput(), d);

    expect(terminal(events)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    expect(calls(d, "control.recordOutcome")).toHaveLength(0);
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(logged.events[0]).toMatchObject({
      event: "expansion_preflight_indeterminate",
      errorCode: "configuration_read_failed:pricing_read_failed",
      metadata: expect.objectContaining({ stage: "base" }),
    });
  });

  it("continuação que ainda geraria a base também é bloqueada e estornada sem chamadas", async () => {
    const d = deps({
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "pricing_unavailable",
        reason: "incomplete_coverage",
        missing: ["imageInputTokenUsdPer1M"],
      })),
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("acquire_base", {
            baseStatus: "pending",
            baseAttempts: 0,
          }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(async (request: { outcome: string }) => ({
          success: true,
          idempotent: false,
          outcome: request.outcome,
          stage: "base",
          supportReference: "ref",
        })),
      },
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
    });

    const events = await run(continueInput(), d);

    expect(terminal(events)).toMatchObject({
      type: "error",
      code: "generation_failed",
      refunded: true,
      reason: "pricing_unavailable:incomplete_coverage",
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(1);
    const recorded = calls(d, "control.recordOutcome")[0] as [
      { supportReference?: string; outcome?: string },
    ];
    expect(recorded[0]).toMatchObject({
      outcome: "failed",
      supportReference: "ref",
    });
    expect(logged.events[0]).toMatchObject({
      event: "generation_failed",
      errorCode: "pricing_unavailable:incomplete_coverage",
      metadata: expect.objectContaining({ supportReference: "ref", stage: "base" }),
    });
  });

  it("replay entregue e entrega comprovada não dependem do pricing atual", async () => {
    const deliverDeps = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "found", view: makeView() })),
        resume: vi.fn(async () => deliveryResume()),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "pricing_unavailable",
        reason: "row_missing",
        missing: ["pricing_row"],
      })),
    });

    const events = await run(continueInput(), deliverDeps);

    expect(terminal(events)).toMatchObject({ type: "result" });
    expect(calls(deliverDeps, "preflightExpansion")).toHaveLength(0);
    expect(calls(deliverDeps, "control.acquire")).toHaveLength(0);
    expect(calls(deliverDeps, "expand")).toHaveLength(0);
  });

  it("falha do provider preserva a causa própria no diagnóstico", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "done"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_expansion",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("acquire_expansion", {
            baseStatus: "done",
            expansionStatus: "pending",
          }),
        ),
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "expansion",
          target: "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "failed",
          stage: "expansion",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(async (request: { outcome: string }) => ({
          success: true,
          idempotent: false,
          outcome: request.outcome,
          stage: "expansion",
          supportReference: "ref",
        })),
      },
      expand: vi.fn(async () => ({
        kind: "provider_failure",
        failure: { class: "transient", reason: "upstream_5xx" },
      })),
    });

    const events = await run(continueInput(), d);

    expect(terminal(events)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
    });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(logged.events[0]).toMatchObject({
      event: "generation_failed",
      errorCode: "transient",
    });
    expect(String(logged.events[0].errorCode)).not.toMatch(/pricing|model/);
  });

  it("emite campaign_copy running/complete conectado ao ciclo real da base", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(async () => deliveryResume()),
        acquire: vi.fn(async (request: { stage: string }) => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: request.stage,
          target: request.stage === "base" ? "primary" : "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
      base: vi.fn(async (_input: unknown, baseDeps?: {
        onCopyPhase?: (event: {
          status: "running" | "complete";
          origin?: "generated" | "reused";
        }) => void;
      }) => {
        baseDeps?.onCopyPhase?.({ status: "running" });
        baseDeps?.onCopyPhase?.({ status: "complete", origin: "reused" });
        return completedBase;
      }) as never,
    });

    const events = await run(initialInput(), d);
    const copyPhases = events.filter(
      (event) => event.type === "phase" && event.phase === "campaign_copy",
    );
    expect(copyPhases).toEqual([
      expect.objectContaining({ status: "running", message: "Gerando texto da campanha..." }),
      expect.objectContaining({
        status: "complete",
        message: "Texto da campanha reaproveitado.",
      }),
    ]);
    expect(terminal(events)).toMatchObject({ type: "result" });
  });

  it("falha da copy aparece como failed e nao bloqueia a entrega da arte", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(async () => deliveryResume()),
        acquire: vi.fn(async (request: { stage: string }) => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: request.stage,
          target: request.stage === "base" ? "primary" : "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
      base: vi.fn(async (_input: unknown, baseDeps?: {
        onCopyPhase?: (event: { status: "failed"; reason: string }) => void;
      }) => {
        baseDeps?.onCopyPhase?.({ status: "failed", reason: "copy_failed" });
        return completedBase;
      }) as never,
    });

    const events = await run(initialInput(), d);
    expect(
      events.find(
        (event) => event.type === "phase" && event.phase === "campaign_copy",
      ),
    ).toMatchObject({
      status: "failed",
      message: "Não foi possível gerar o texto; a arte continua.",
    });
    expect(terminal(events)).toMatchObject({ type: "result" });
  });

  it("initial reserves once and runs base -> preparation -> expansion -> delivery with phases", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(async () => deliveryResume()),
        acquire: vi.fn(async (request: { stage: string }) => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: request.stage,
          target: request.stage === "base" ? "primary" : "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(initialInput(), d);
    expect(terminal(events)).toMatchObject({ type: "result" });
    expect(calls(d, "financial.reserveOperationOnce")).toHaveLength(1);
    expect(calls(d, "base")).toHaveLength(1);
    expect(calls(d, "prepare")).toHaveLength(1);
    expect(calls(d, "expand")).toHaveLength(1);
    expect(calls(d, "projectDelivered")).toHaveLength(1);
    expect(calls(d, "control.resume")).toHaveLength(1);

    const phaseNames = events
      .filter((event) => event.type === "phase")
      .map((event) => `${String(event.phase)}:${String(event.status)}`);
    expect(phaseNames[0]).toBe("campaign_validation:running");
    expect(phaseNames).toContain("campaign_validation:complete");
    expect(phaseNames).toContain("campaign_base:complete");
    expect(phaseNames).toContain("campaign_preparation:complete");
    expect(phaseNames).toContain("campaign_expansion:complete");
    expect(phaseNames).toContain("campaign_delivery:complete");
    expect(terminals(events)).toHaveLength(1);
  });

  it("continue after base does not prepare/expand yet; the next continuation prepares before expanding", async () => {
    const first = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
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
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
    });
    const firstEvents = await run(continueInput(), first);
    expect(terminal(firstEvents)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(calls(first, "base")).toHaveLength(1);
    expect(calls(first, "prepare")).toHaveLength(0);
    expect(calls(first, "expand")).toHaveLength(0);
    expect(calls(first, "financial.reserveOperationOnce")).toHaveLength(0);

    const order: string[] = [];
    const second = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "done"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_expansion",
          }),
        })),
        resume: vi
          .fn()
          .mockResolvedValueOnce(resumeResult("acquire_expansion"))
          .mockResolvedValueOnce(deliveryResume()),
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "expansion",
          target: "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "expansion",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
      prepare: vi.fn(async () => {
        order.push("prepare");
        return {
          kind: "prepared",
          artifact: {},
          bytes: Buffer.alloc(0),
          persistence: "reused",
        };
      }),
      expand: vi.fn(async () => {
        order.push("expand");
        return {
          kind: "expanded",
          artifact: {},
          bytes: Buffer.alloc(0),
          persistence: "created",
          call: {},
        };
      }),
    });
    const secondEvents = await run(continueInput(), second);
    expect(terminal(secondEvents)).toMatchObject({ type: "result" });
    expect(order).toEqual(["prepare", "expand"]);
    expect(calls(second, "prepare")).toHaveLength(1);
    expect(calls(second, "expand")).toHaveLength(1);
    expect(calls(second, "base")).toHaveLength(0);
  });

  it("continue retry base with frozen complete rebuilds durable content (no browser content)", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "failed", { failureClass: "transient" }),
            expansion: step("expansion", "pending"),
            nextAction: "retry_base",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("retry_base", {
            baseStatus: "failed",
            expansionStatus: "pending",
          }),
        ),
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 2,
          stage: "base",
          target: "primary",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 2,
        })),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "processing", nextStep: "expansion" });
    const baseCalls = calls(d, "base") as Array<
      [{ briefing: unknown; productImagesDataUrls: readonly string[] }]
    >;
    expect(baseCalls).toHaveLength(1);
    expect(baseCalls[0][0].briefing).toEqual(DURABLE_BRIEFING);
    expect(baseCalls[0][0].productImagesDataUrls).toEqual([DURABLE_DATA_URL]);
  });

  it("does not advance when finish is refused", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "base",
          target: "primary",
        })),
        finish: vi.fn(async () => ({ success: false, reason: "operation_terminal" })),
        recordOutcome: vi.fn(async () => ({
          success: true,
          idempotent: false,
          outcome: "unknown",
          stage: "base",
          supportReference: null,
        })),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "unknown" });
    expect(calls(d, "prepare")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
  });

  it("repairs the projection when delivery is replayed after credit delivered", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            credit: {
              status: "delivered",
              terminal: true,
              delivered: true,
              refunded: false,
              reserved: false,
            },
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        // Envelope REAL da RPC: credito entregue tambem devolve `blocked`.
        resume: vi.fn(async () =>
          resumeResult("blocked", { creditStatus: "delivered" }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "result" });
    expect(calls(d, "projectDelivered")).toHaveLength(1);
    expect(calls(d, "credit.beginPublication")).toHaveLength(0);
    expect(calls(d, "financial.confirmOnVerticalDelivery")).toHaveLength(0);
  });

  it("exhausted limit with absent vertical refunds once and never retries", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            expansion: step("expansion", "failed", {
              attemptsUsed: 2,
              failureClass: "transient",
            }),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", {
            expansionStatus: "failed",
            expansionAttempts: 2,
          }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(async () => ({
          success: true,
          idempotent: false,
          outcome: "failed",
          stage: "expansion",
          supportReference: null,
        })),
      },
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "error", refunded: true });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(1);
    expect(calls(d, "control.recordOutcome")).toHaveLength(1);
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });

  it("exhausted limit with an integral vertical routes to administrative resolution without refund or auto-continuation", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            expansion: step("expansion", "failed", {
              attemptsUsed: 2,
              failureClass: "transient",
            }),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", { expansionStatus: "failed", expansionAttempts: 2 }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({
      type: "processing",
      state: "delivery_pending",
      nextStep: "delivery",
      canContinue: false,
    });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(calls(d, "projectDelivered")).toHaveLength(0);
    expect(calls(d, "credit.beginPublication")).toHaveLength(0);
  });

  it("exhausted limit with indeterminate evidence records unknown without refund", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            expansion: step("expansion", "failed", {
              attemptsUsed: 2,
              failureClass: "transient",
            }),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", { expansionStatus: "failed", expansionAttempts: 2 }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(async () => ({
          success: true,
          idempotent: false,
          outcome: "unknown",
          stage: "expansion",
          supportReference: null,
        })),
      },
      probeVertical: {
        probeVerticalArtifact: vi.fn(async () => ({ kind: "indeterminate" })),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "unknown" });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(
      (calls(d, "control.recordOutcome")[0] as [{ outcome?: string }])[0],
    ).toMatchObject({ outcome: "unknown" });
  });

  it("blocked for another reason never refunds or records an outcome", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "failed", { failureClass: null }),
            expansion: step("expansion", "pending"),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", { baseStatus: "failed", expansionStatus: "pending" }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "processing", canContinue: false });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(calls(d, "control.recordOutcome")).toHaveLength(0);
  });

  it("persists unknown on an unknown provider result with no retry or refund", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
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
      },
      base: vi.fn(async () => ({ kind: "unknown_result" })),
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "unknown" });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(calls(d, "control.acquire")).toHaveLength(1);
  });

  it("returns processing with no acquire when the budget cannot afford the step", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput({ timeoutMs: 1 }), d);
    expect(terminal(events)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });

  it("streams progress before the work completes", async () => {
    let releaseBase: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseBase = resolve;
    });
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(async () => deliveryResume()),
        acquire: vi.fn(async (request: { stage: string }) => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: request.stage,
          target: request.stage === "base" ? "primary" : "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
      base: vi.fn(async () => {
        await gate;
        return completedBase;
      }),
    });

    const response = await runNineSixteenTwoStageGeneration(initialInput(), d);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("missing body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (!buffer.includes('"phase":"campaign_base"')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value);
    }
    expect(buffer).toContain('"phase":"campaign_base"');
    expect(buffer).not.toContain('"type":"result"');

    releaseBase();
    let rest = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += decoder.decode(chunk.value);
    }
    expect(rest).toContain('"type":"result"');
  });

  it("blocked with refunded credit returns a terminal closure", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            credit: {
              status: "refunded",
              terminal: true,
              delivered: false,
              refunded: true,
              reserved: false,
            },
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", { creditStatus: "refunded" }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({
      type: "error",
      code: "operation_refunded",
      refunded: true,
    });
    expect(calls(d, "control.recordOutcome")).toHaveLength(0);
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
  });

  it("blocked with a persisted unknown outcome returns unknown with its support reference", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            unknown: true,
            supportReference: "sup-1",
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () => resumeResult("blocked")),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "unknown", reference: "sup-1" });
    expect(calls(d, "control.recordOutcome")).toHaveLength(0);
  });

  it("pre-call read failure is recoverable: no acquire/provider/outcome, next read continues", async () => {
    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    } as never;
    const first = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
      reconstruction: { client: failingClient },
    });
    const firstEvents = await run(continueInput(), first);
    expect(terminal(firstEvents)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    });
    expect(calls(first, "control.acquire")).toHaveLength(0);
    expect(calls(first, "base")).toHaveLength(0);
    expect(calls(first, "control.recordOutcome")).toHaveLength(0);
    expect(calls(first, "financial.refundOnDefinitiveFailure")).toHaveLength(0);

    const second = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
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
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
      reconstruction: durableReconstruction(),
    });
    const secondEvents = await run(continueInput(), second);
    expect(terminal(secondEvents)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
    });
    expect(calls(second, "base")).toHaveLength(1);
    expect(calls(second, "control.acquire")).toHaveLength(1);
  });

  it("propagates cancellation to the base before any paid call", async () => {
    const controller = new AbortController();
    controller.abort();
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput({ signal: controller.signal }), d);
    expect(terminal(events)).toMatchObject({
      type: "processing",
      nextStep: "base",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
  });

  it("propagates cancellation to the expansion before any paid call", async () => {
    const controller = new AbortController();
    controller.abort();
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "done"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_expansion",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_expansion")),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput({ signal: controller.signal }), d);
    expect(terminal(events)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    // A preparacao gratuita pode rodar; a expansao paga nao.
    expect(calls(d, "prepare")).toHaveLength(1);
  });

  it("turns an unhandled exception into exactly one safe terminal", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => {
          throw new Error("db down");
        }),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(initialInput(), d);
    expect(terminals(events)).toHaveLength(1);
    expect(terminal(events)).toMatchObject({ type: "unknown", operationId: "o" });
  });
});

describe("runNineSixteenTwoStageGeneration — seleção congelada", () => {
  it("propaga a seleção do preflight até deps.expand na geração nova", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(),
        acquire: vi.fn(async (request: { stage: string }) => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: request.stage,
          target: request.stage === "base" ? "primary" : "initial",
        })),
        finish: vi.fn(async (request: { stage?: string }) => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: request.stage ?? "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
    });

    const events = await run(initialInput(), d);
    // A entrega não é o objeto deste teste: o que importa é a expansão paga
    // receber a seleção do preflight exatamente uma vez.
    expect(terminals(events)).toHaveLength(1);

    const expandCalls = calls(d, "expand") as Array<
      [unknown, { selection: unknown }]
    >;
    expect(expandCalls).toHaveLength(1);
    expect(expandCalls[0][0]).toMatchObject({
      source: { role: "square_prepared" },
      operationId: "o",
    });
    expect(expandCalls[0][1]).toEqual({ selection: CONFIGURED_SELECTION });
  });

  it("allowNewPaidStep false suspende sem preflight e sem chamada paga", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });

    const events = await run(initialInput({ allowNewPaidStep: false }), d);
    expect(terminal(events)).toMatchObject({
      type: "processing",
      state: "suspended",
      canContinue: false,
    });
    expect(calls(d, "preflightExpansion")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    // A reserva não é o objeto desde teste; o gate é a etapa paga.
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });

  it("continuação usa a seleção do preflight (estado interino) e não lê config própria", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "done"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_expansion",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("acquire_expansion", {
            baseStatus: "done",
            expansionStatus: "pending",
          }),
        ),
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "expansion",
          target: "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "expansion",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
    });

    const events = await run(continueInput(), d);
    expect(terminals(events)).toHaveLength(1);
    expect(calls(d, "preflightExpansion")).toHaveLength(1);

    const expandCalls = calls(d, "expand") as Array<
      [unknown, { selection: unknown }]
    >;
    expect(expandCalls).toHaveLength(1);
    expect(expandCalls[0][1]).toEqual({ selection: CONFIGURED_SELECTION });
  });

  it("continuação com leitura indeterminada não adquire, não gasta e não estorna", async () => {
    const d = deps({
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "configuration_read_failed",
        reason: "nine_sixteen_expansion_config_read_failed:down",
        missing: [],
      })),
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "done"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_expansion",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("acquire_expansion", {
            baseStatus: "done",
            expansionStatus: "pending",
          }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });

    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    expect(calls(d, "control.recordOutcome")).toHaveLength(0);
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(logged.events[0]).toMatchObject({
      event: "expansion_preflight_indeterminate",
    });
  });

  it("continuação com configuração comprovadamente ausente encerra com estorno único", async () => {
    const d = deps({
      preflightExpansion: vi.fn(async () => ({
        ok: false,
        failure: "configuration_missing",
        reason: "expansion_config_absent",
        missing: [],
      })),
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "done"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_expansion",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("acquire_expansion", {
            baseStatus: "done",
            expansionStatus: "pending",
          }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(async (request: { outcome: string }) => ({
          success: true,
          idempotent: false,
          outcome: request.outcome,
          stage: "expansion",
          supportReference: "ref",
        })),
      },
      // Sem vertical íntegro: o caminho definitivo estorna a reserva.
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
    });

    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({
      type: "error",
      code: "generation_failed",
      refunded: true,
      reason: "configuration_missing:expansion_config_absent",
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(1);
    expect(calls(d, "control.recordOutcome")).toHaveLength(1);
  });
});
