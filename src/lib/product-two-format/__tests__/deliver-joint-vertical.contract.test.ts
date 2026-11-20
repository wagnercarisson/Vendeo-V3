// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LEGACY_SUNBURST_LOW } from "@/lib/ai/nine-sixteen-expansion-model-config";
import type { VerticalArtifactProbeResult } from "@/lib/product-9-16-two-stage/two-stage-financial-service";
import type {
  ResumeOperationResult,
} from "@/lib/product-9-16-two-stage/types";
import type {
  StepExecutionOutcome,
} from "@/lib/product-9-16-two-stage/orchestration/types";
import type {
  TwoFormatDeliverReason,
  TwoFormatDeliverResult,
  TwoFormatDeliveryErrorCode,
} from "@/lib/product-two-format/joint-financial-client";

import {
  deliverTwoFormatVertical,
  type JointVerticalDeliveryDeps,
  type JointVerticalDeliveryInput,
} from "../orchestration/deliver-joint-vertical";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const TOKEN = "44444444-4444-4444-8444-444444444444";
const PATH_916 = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

type ResumeSuccess = Extract<ResumeOperationResult, { success: true }>;

function envelope(overrides: Partial<ResumeSuccess> = {}): ResumeOperationResult {
  return {
    success: true,
    action: "deliver",
    nextTarget: null,
    origin: "9_16_two_stage",
    creditStatus: "reserved",
    baseStatus: "done",
    baseAttempts: 1,
    expansionStatus: "done",
    expansionAttempts: 1,
    unknown: false,
    failedOutcome: false,
    ...overrides,
  };
}

function input(
  overrides: Partial<JointVerticalDeliveryInput> = {},
): JointVerticalDeliveryInput {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    authorization: { kind: "system" },
    acquisitionId: "55555555-5555-4555-8555-555555555555",
    attemptReference: "initial",
    attemptTarget: "initial",
    deadlineAtMs: Date.now() + 60_000,
    expansionStatus: "pending",
    selection: LEGACY_SUNBURST_LOW,
    allowNewPaidStep: true,
    ...overrides,
  };
}

function integral(): VerticalArtifactProbeResult {
  return {
    kind: "integral",
    format: "9:16",
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    storagePath: PATH_916,
    evidenceRef: "evidence-1",
  };
}

function delivered(
  overrides: Partial<Extract<TwoFormatDeliverResult, { success: true }>> = {},
): TwoFormatDeliverResult {
  return {
    success: true,
    idempotent: false,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "9:16",
    deliveryOperationId: OPERATION,
    artifactRole: "vertical",
    creditStatus: "delivered",
    campaignStatus: "ready",
    storagePath: PATH_916,
    preferredFormat: "9:16",
    projected: true,
    alreadyProjected: false,
    ...overrides,
  };
}

function refused(reason: TwoFormatDeliverReason): TwoFormatDeliverResult {
  return { success: false, reason };
}

function twoFormatError(code: TwoFormatDeliveryErrorCode): Error {
  return Object.assign(new Error(code), {
    name: "TwoFormatDeliveryError",
    code,
  });
}

function creditError(code: string): Error {
  return Object.assign(new Error(code), {
    name: "CreditOperationError",
    code,
  });
}

interface DepsConfig {
  readonly resume?: ResumeOperationResult;
  readonly prepare?: StepExecutionOutcome;
  readonly expand?: StepExecutionOutcome;
  readonly probe?: VerticalArtifactProbeResult;
  readonly begin?: { acquired: boolean; token: string | null; publicationState: string };
  readonly beginThrows?: Error;
  readonly deliver?: TwoFormatDeliverResult;
  readonly deliverThrows?: Error;
}

function makeDeps(config: DepsConfig = {}) {
  const order: string[] = [];
  const deps: JointVerticalDeliveryDeps = {
    resume: vi.fn(async () => config.resume ?? envelope()),
    prepare: vi.fn(async () => {
      order.push("prepare");
      return config.prepare ?? { kind: "completed" as const };
    }),
    expand: vi.fn(async () => {
      order.push("expand");
      return config.expand ?? { kind: "completed" as const };
    }),
    probeVertical: vi.fn(async () => {
      order.push("probe");
      return config.probe ?? integral();
    }),
    beginPublication: vi.fn(async () => {
      order.push("token");
      if (config.beginThrows !== undefined) throw config.beginThrows;
      return (
        config.begin ?? {
          acquired: true,
          token: TOKEN,
          publicationState: "in_flight",
        }
      );
    }),
    abortPublication: vi.fn(async () => {
      order.push("abort");
      return { success: true };
    }),
    deliverFormat: vi.fn(async () => {
      order.push("deliver");
      if (config.deliverThrows !== undefined) throw config.deliverThrows;
      return config.deliver ?? delivered();
    }),
    generateThumbnail: vi.fn(async () => ({ status: "created" as const })),
  };
  return { deps, order };
}

describe("F60.7-06 — entrega vertical dedicada", () => {
  it("Teste 1: `wait` ⇒ processing step_in_progress, sem etapas/token/entrega", async () => {
    const { deps } = makeDeps({
      resume: envelope({ action: "wait", baseStatus: "in_progress" }),
    });
    const outcome = await deliverTwoFormatVertical(input(), deps);
    expect(outcome).toEqual({
      kind: "processing",
      state: "step_in_progress",
      nextStep: "base",
      canContinue: true,
    });
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.expand).not.toHaveBeenCalled();
    expect(deps.beginPublication).not.toHaveBeenCalled();
    expect(deps.deliverFormat).not.toHaveBeenCalled();
  });

  it("Teste 2: `blocked` + crédito delivered ⇒ replay idempotente pela sonda, sem token", async () => {
    const replay = makeDeps({
      resume: envelope({ action: "blocked", creditStatus: "delivered" }),
    });
    expect(await deliverTwoFormatVertical(input(), replay.deps)).toEqual({
      kind: "delivered",
      idempotent: true,
      campaignStatus: null,
      storagePath: PATH_916,
    });
    expect(replay.deps.beginPublication).not.toHaveBeenCalled();
    expect(replay.deps.deliverFormat).not.toHaveBeenCalled();

    const indeterminate = makeDeps({
      resume: envelope({ action: "blocked", creditStatus: "delivered" }),
      probe: { kind: "indeterminate" },
    });
    expect(await deliverTwoFormatVertical(input(), indeterminate.deps)).toEqual({
      kind: "indeterminate",
    });

    const absent = makeDeps({
      resume: envelope({ action: "blocked", creditStatus: "delivered" }),
      probe: { kind: "absent" },
    });
    expect(await deliverTwoFormatVertical(input(), absent.deps)).toEqual({
      kind: "unknown",
      reason: "delivered_without_integral_vertical_absent",
    });
    expect(absent.deps.beginPublication).not.toHaveBeenCalled();
  });

  it("Teste 3: `blocked` + crédito refunded ⇒ terminal_conflict", async () => {
    const { deps } = makeDeps({
      resume: envelope({ action: "blocked", creditStatus: "refunded" }),
    });
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "terminal_conflict",
      code: "operation_terminal",
    });
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.beginPublication).not.toHaveBeenCalled();
  });

  it("Teste 4: `blocked` + unknown persistido ⇒ unknown sem etapas", async () => {
    const { deps } = makeDeps({
      resume: envelope({ action: "blocked", unknown: true }),
    });
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "unknown",
      reason: "unknown_outcome",
    });
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.deliverFormat).not.toHaveBeenCalled();
  });

  it("Teste 5: `blocked` + failedOutcome ⇒ definitive failed_outcome sem etapas", async () => {
    const { deps } = makeDeps({
      resume: envelope({ action: "blocked", failedOutcome: true }),
    });
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "definitive",
      reason: "failed_outcome",
    });
    expect(deps.expand).not.toHaveBeenCalled();
    expect(deps.beginPublication).not.toHaveBeenCalled();
  });

  it("Teste 6: `blocked` genérico ⇒ processing suspended, canContinue false", async () => {
    const { deps } = makeDeps({
      resume: envelope({ action: "blocked" }),
    });
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "processing",
      state: "suspended",
      nextStep: "delivery",
      canContinue: false,
    });
  });

  it("Teste 7: base pendente ⇒ processing between_steps/base_pending, sem preparação", async () => {
    const { deps } = makeDeps({
      resume: envelope({
        action: "acquire_base",
        baseStatus: "pending",
        expansionStatus: "pending",
      }),
    });
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
      reason: "base_pending",
    });
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.expand).not.toHaveBeenCalled();
    expect(deps.probeVertical).not.toHaveBeenCalled();
    expect(deps.deliverFormat).not.toHaveBeenCalled();
  });

  it("Teste 8: base done + expansão pendente ⇒ preparação → expansão, com signal", async () => {
    const { deps, order } = makeDeps({
      resume: envelope({
        action: "acquire_expansion",
        expansionStatus: "pending",
      }),
    });
    const signal = new AbortController().signal;
    const outcome = await deliverTwoFormatVertical(input({ signal }), deps);
    expect(outcome).toEqual({
      kind: "delivered",
      idempotent: false,
      campaignStatus: "ready",
      storagePath: PATH_916,
    });
    expect(order).toEqual(["prepare", "expand", "probe", "token", "deliver"]);
    expect(deps.expand).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.expand).mock.calls[0][0].signal).toBe(signal);
    expect(deps.expand).toHaveBeenCalledWith(
      expect.objectContaining({ selection: LEGACY_SUNBURST_LOW }),
    );
  });

  it("Teste 9: preparação definitive/processing preserva o resultado do step", async () => {
    const definitive = makeDeps({
      resume: envelope({ expansionStatus: "pending" }),
      prepare: { kind: "definitive", reason: "source_absent" },
    });
    expect(await deliverTwoFormatVertical(input(), definitive.deps)).toEqual({
      kind: "definitive",
      reason: "source_absent",
    });
    expect(definitive.deps.expand).not.toHaveBeenCalled();
    expect(definitive.deps.beginPublication).not.toHaveBeenCalled();

    const processing = makeDeps({
      resume: envelope({ expansionStatus: "pending" }),
      prepare: {
        kind: "processing",
        state: "preparation_retry",
        nextStep: "expansion",
        canContinue: true,
      },
    });
    expect(await deliverTwoFormatVertical(input(), processing.deps)).toEqual({
      kind: "processing",
      state: "preparation_retry",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(processing.deps.expand).not.toHaveBeenCalled();
  });

  it("Teste 10: expansão unknown/definitive/retryable sem token", async () => {
    for (const outcome of [
      { kind: "unknown" as const, reason: "provider_unknown" },
      { kind: "definitive" as const, reason: "provider_failed" },
      { kind: "retryable" as const, reason: "transient" },
    ]) {
      const { deps } = makeDeps({
        resume: envelope({ expansionStatus: "pending" }),
        expand: outcome,
      });
      const result = await deliverTwoFormatVertical(input(), deps);
      expect(result).toEqual(
        outcome.kind === "retryable"
          ? { kind: "retryable", reason: outcome.reason }
          : { kind: outcome.kind, reason: outcome.reason },
      );
      expect(deps.beginPublication).not.toHaveBeenCalled();
      expect(deps.deliverFormat).not.toHaveBeenCalled();
    }
  });

  it("Teste 11: expansão completed + sonda integral ⇒ token e depois deliverFormat(9:16)", async () => {
    const { deps, order } = makeDeps();
    const outcome = await deliverTwoFormatVertical(input(), deps);
    expect(outcome).toEqual({
      kind: "delivered",
      idempotent: false,
      campaignStatus: "ready",
      storagePath: PATH_916,
    });
    expect(order).toEqual(["probe", "token", "deliver"]);
    expect(deps.beginPublication).toHaveBeenCalledWith(CAMPAIGN, OPERATION);
    expect(deps.deliverFormat).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      format: "9:16",
      publicationToken: TOKEN,
    });
  });

  it("Teste 11b: miniatura do vertical é gerada na entrega normal, com o caminho do artefato 9:16", async () => {
    const { deps } = makeDeps({
      deliver: delivered({ storagePath: `${STORE}/${CAMPAIGN}/projected-square.jpg` }),
    });
    const outcome = await deliverTwoFormatVertical(input(), deps);
    expect(outcome.kind).toBe("delivered");
    expect(deps.generateThumbnail).toHaveBeenCalledTimes(1);
    expect(deps.generateThumbnail).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      role: "vertical",
      storagePath: PATH_916,
    });

    const refusedRun = makeDeps({ deliver: refused("invalid_transition") });
    await deliverTwoFormatVertical(input(), refusedRun.deps);
    expect(refusedRun.deps.generateThumbnail).not.toHaveBeenCalled();

    const replay = makeDeps({
      resume: envelope({ action: "blocked", creditStatus: "delivered" }),
    });
    await deliverTwoFormatVertical(input(), replay.deps);
    expect(replay.deps.generateThumbnail).not.toHaveBeenCalled();
  });

  it("Teste 11c: falha da miniatura é best-effort e não desfaz a entrega", async () => {
    const { deps } = makeDeps();
    vi.mocked(deps.generateThumbnail).mockRejectedValueOnce(
      new Error("thumbnail_upload_failed"),
    );
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "delivered",
      idempotent: false,
      campaignStatus: "ready",
      storagePath: PATH_916,
    });
    expect(deps.deliverFormat).toHaveBeenCalledTimes(1);
  });

  it("Teste 12: sonda invalid/absent/indeterminate ⇒ sem token/entrega", async () => {
    const invalid = makeDeps({ probe: { kind: "invalid" } });
    expect(await deliverTwoFormatVertical(input(), invalid.deps)).toEqual({
      kind: "artifact_incompatible",
      reason: "vertical_incompatible",
    });
    const absent = makeDeps({ probe: { kind: "absent" } });
    expect(await deliverTwoFormatVertical(input(), absent.deps)).toEqual({
      kind: "artifact_absent",
    });
    const indeterminate = makeDeps({ probe: { kind: "indeterminate" } });
    expect(await deliverTwoFormatVertical(input(), indeterminate.deps)).toEqual({
      kind: "indeterminate",
    });
    for (const run of [invalid, absent, indeterminate]) {
      expect(run.deps.beginPublication).not.toHaveBeenCalled();
      expect(run.deps.deliverFormat).not.toHaveBeenCalled();
      expect(run.deps.abortPublication).not.toHaveBeenCalled();
    }
  });

  it("Teste 13: beginPublication sem token ⇒ publication_pending", async () => {
    const { deps } = makeDeps({
      begin: { acquired: false, token: null, publicationState: "in_flight" },
    });
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "publication_pending",
    });
    expect(deps.deliverFormat).not.toHaveBeenCalled();
    expect(deps.abortPublication).not.toHaveBeenCalled();
  });

  it("Teste 14: recusas de negócio do deliverFormat", async () => {
    const incompatible = makeDeps({ deliver: refused("artifact_incompatible") });
    expect(await deliverTwoFormatVertical(input(), incompatible.deps)).toEqual({
      kind: "artifact_incompatible",
      reason: "artifact_incompatible",
    });

    const transition = makeDeps({ deliver: refused("invalid_transition") });
    expect(await deliverTwoFormatVertical(input(), transition.deps)).toEqual({
      kind: "terminal_conflict",
      code: "invalid_transition",
    });

    for (const reason of [
      "credit_operation_missing",
      "delivery_link_missing",
      "unsupported_format",
    ] as const) {
      const run = makeDeps({ deliver: refused(reason) });
      expect(await deliverTwoFormatVertical(input(), run.deps)).toEqual({
        kind: "failed",
        code: reason,
      });
    }
  });

  it("Teste 15: token inválido/ausente como EXCEÇÃO local do cliente", async () => {
    const missing = makeDeps({
      deliverThrows: twoFormatError("missing_publication_token"),
    });
    expect(await deliverTwoFormatVertical(input(), missing.deps)).toEqual({
      kind: "publication_pending",
    });

    const invalid = makeDeps({
      deliverThrows: twoFormatError("invalid_publication_token"),
    });
    expect(await deliverTwoFormatVertical(input(), invalid.deps)).toEqual({
      kind: "failed",
      code: "invalid_publication_token",
    });
  });

  it("Teste 16: erros lançados preservam o código tipado", async () => {
    for (const code of [
      "invalid_envelope",
      "unknown",
      "operation_in_progress",
      "shared_operation_not_final",
      "delivery_links_inconsistent",
      "delivered_not_refundable",
      "publication_not_owner",
    ] as const) {
      const run = makeDeps({ deliverThrows: twoFormatError(code) });
      expect(await deliverTwoFormatVertical(input(), run.deps)).toEqual({
        kind: "failed",
        code,
      });
    }
  });

  it("Teste 17: deliver idempotente ⇒ delivered sem segunda entrega", async () => {
    const { deps } = makeDeps({ deliver: delivered({ idempotent: true }) });
    expect(await deliverTwoFormatVertical(input(), deps)).toEqual({
      kind: "delivered",
      idempotent: true,
      campaignStatus: "ready",
      storagePath: PATH_916,
    });
    expect(deps.deliverFormat).toHaveBeenCalledTimes(1);
  });

  it("Teste 18: abort só na allowlist, com token, preservando o artefato", async () => {
    const { deps } = makeDeps({ deliver: refused("artifact_incompatible") });
    await deliverTwoFormatVertical(input(), deps);
    expect(deps.abortPublication).toHaveBeenCalledTimes(1);
    expect(deps.abortPublication).toHaveBeenCalledWith(
      CAMPAIGN,
      OPERATION,
      TOKEN,
      "before_upload",
    );
    expect(deps.deliverFormat).toHaveBeenCalledTimes(1);
  });

  it("Teste 19: ambíguo/transporte preserva o fence, sem abort", async () => {
    for (const code of [
      "invalid_envelope",
      "unknown",
      "publication_not_owner",
      "publication_in_progress",
      "operation_in_progress",
      "delivery_links_inconsistent",
    ] as const) {
      const run = makeDeps({ deliverThrows: twoFormatError(code) });
      await deliverTwoFormatVertical(input(), run.deps);
      expect(run.deps.abortPublication).not.toHaveBeenCalled();
    }
    const transport = makeDeps({ deliverThrows: new Error("socket") });
    await deliverTwoFormatVertical(input(), transport.deps);
    expect(transport.deps.abortPublication).not.toHaveBeenCalled();
  });

  it("Teste 20: não importa o confirmador individual nem projeta", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/deliver-joint-vertical.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/deliverVertical\(/);
    expect(source).not.toMatch(/confirmOnVerticalDelivery\(/);
    expect(source).not.toMatch(/projectDelivered\(/);
    expect(source).not.toMatch(/projectClosed\(/);
    expect(source).not.toMatch(/runBaseStep\(/);
  });
});
