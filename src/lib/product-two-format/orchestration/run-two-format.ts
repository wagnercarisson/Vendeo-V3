import "server-only";

import type { AttemptTarget, OperationViewLookup } from "@/lib/product-9-16-two-stage/types";
import type { JointBaseInput, JointBaseOutcome } from "./joint-base";

import {
  type JointOpenInput,
  type JointOpenOutcome,
} from "./joint-operation-service";
import type { JointPreflightResult } from "./preflight";
import {
  type JointResumeOperationInput,
  type JointResumeOutcome,
} from "./resume-joint-operation";
import { createTwoFormatStream } from "./two-format-stream";
import type {
  TwoFormatEvent,
  TwoFormatFormatStatus,
  TwoFormatStatusSnapshot,
} from "./two-format-events";
import type { TwoFormatFormat } from "../types";

export interface TwoFormatRunInput {
  readonly mode: "new" | "continue";
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: JointResumeOperationInput["authorization"];
  readonly allowNewPaidStep: boolean;
  readonly requestStartedAtMs: number;
  readonly deadlineAtMs: number;
  readonly inputSnapshot: unknown;
  readonly squareDeliveryId: string;
  readonly initialRequestId?: string;
  readonly requestId?: string;
  readonly content?: JointBaseInput["content"];
  readonly preflight?: JointPreflightResult;
  readonly signal?: AbortSignal;
}

export interface TwoFormatRunDeps {
  readonly readOperationView: (input: {
    campaignId: string;
    operationId: string;
  }) => Promise<OperationViewLookup>;
  readonly readStatus: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    allowNewPaidStep: boolean;
  }) => Promise<TwoFormatStatusSnapshot>;
  readonly preflightJointSelection: () => Promise<JointPreflightResult>;
  readonly openJointOperation: (
    input: JointOpenInput,
  ) => Promise<JointOpenOutcome>;
  readonly resumeJointOperation: (
    input: JointResumeOperationInput,
  ) => Promise<JointResumeOutcome>;
  readonly runInitialBase: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    authorization: JointResumeOperationInput["authorization"];
    content: JointBaseInput["content"];
    acquisitionId: string;
    attemptReference: string;
    deadlineAtMs: number;
    allowNewPaidStep: boolean;
    attemptTarget: AttemptTarget;
    signal?: AbortSignal;
  }) => Promise<JointBaseOutcome>;
  readonly resolveAttemptTarget: (input: {
    campaignId: string;
    operationId: string;
  }) => Promise<AttemptTarget>;
  readonly clock: () => number;
  readonly callIdFactory: () => string;
}

function formats(
  left: TwoFormatFormatStatus,
  right: TwoFormatFormatStatus,
): Record<TwoFormatFormat, TwoFormatFormatStatus> {
  return { "1:1": left, "9:16": right };
}

function processingEvent(
  input: TwoFormatRunInput,
  snapshot: TwoFormatStatusSnapshot,
): TwoFormatEvent {
  return {
    type: "processing",
    campaignId: input.campaignId,
    operationId: input.operationId,
    responseTerminal: true,
    operationTerminal: false,
    state:
      snapshot.nextStep === null ? "between_steps" : `next:${snapshot.nextStep}`,
    nextStep: snapshot.nextStep,
    canContinue: snapshot.canContinue,
    formats: snapshot.formats,
    preferredFormat: snapshot.preferredFormat,
  };
}

function resultEvent(
  input: TwoFormatRunInput,
  snapshot: TwoFormatStatusSnapshot,
): TwoFormatEvent {
  const delivered = (["1:1", "9:16"] as const).filter(
    (format) => snapshot.formats[format].state === "delivered",
  );
  return {
    type: "result",
    campaignId: input.campaignId,
    operationId: input.operationId,
    responseTerminal: true,
    operationTerminal: snapshot.operationTerminal,
    campaignUrl: `/campanhas/${input.campaignId}`,
    formats: snapshot.formats,
    preferredFormat: snapshot.preferredFormat,
    partial: delivered.length === 1,
  };
}

function errorEvent(
  input: TwoFormatRunInput,
  code: string,
  message: string,
): TwoFormatEvent {
  return {
    type: "error",
    campaignId: input.campaignId,
    operationId: input.operationId,
    responseTerminal: true,
    operationTerminal: false,
    code,
    message,
  };
}

function terminalForStatus(
  input: TwoFormatRunInput,
  snapshot: TwoFormatStatusSnapshot,
): TwoFormatEvent {
  if (
    snapshot.operationTerminal ||
    snapshot.formats["1:1"].state === "delivered" ||
    snapshot.formats["9:16"].state === "delivered"
  ) {
    return resultEvent(input, snapshot);
  }
  return processingEvent(input, snapshot);
}

async function finishFromStatus(
  stream: ReturnType<typeof createTwoFormatStream>,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
): Promise<void> {
  const snapshot = await deps.readStatus({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    allowNewPaidStep: input.allowNewPaidStep,
  });
  stream.emitTerminal(terminalForStatus(input, snapshot));
}

async function runResume(
  stream: ReturnType<typeof createTwoFormatStream>,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  acquisitionId: string,
): Promise<void> {
  const attemptTarget = await deps.resolveAttemptTarget({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  const outcome = await deps.resumeJointOperation({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
    acquisitionId,
    attemptReference: deps.callIdFactory(),
    deadlineAtMs: input.deadlineAtMs,
    allowNewPaidStep: input.allowNewPaidStep,
    attemptTarget,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });

  if (outcome.kind === "executed") {
    const phase =
      outcome.action === "run_base"
        ? "square_base"
        : outcome.action === "run_vertical_only"
          ? "vertical_delivery"
          : "projection";
    stream.emitPhase(phase, "complete");
    await finishFromStatus(stream, input, deps);
    return;
  }
  if (outcome.kind === "settle_square") {
    stream.emitPhase("square_delivery", "complete");
    await finishFromStatus(stream, input, deps);
    return;
  }
  if (outcome.kind === "blocked") {
    if (outcome.reason === "operation_in_progress") {
      await finishFromStatus(stream, input, deps);
      return;
    }
    stream.emitTerminal(errorEvent(input, "joint_blocked", outcome.reason));
    return;
  }
  if (outcome.kind === "partial_terminal") {
    const snapshot = await deps.readStatus({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      allowNewPaidStep: input.allowNewPaidStep,
    });
    stream.emitTerminal({
      type: "result",
      campaignId: input.campaignId,
      operationId: input.operationId,
      responseTerminal: true,
      operationTerminal: true,
      campaignUrl: `/campanhas/${input.campaignId}`,
      formats: snapshot.formats,
      preferredFormat: snapshot.preferredFormat,
      partial: true,
    });
    return;
  }
  if (outcome.kind === "pending_finalization") {
    await finishFromStatus(stream, input, deps);
    return;
  }
  stream.emitTerminal(errorEvent(input, "joint_terminal_error", "Operação não concluída."));
}

async function execute(
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  stream: ReturnType<typeof createTwoFormatStream>,
): Promise<void> {
  let lookup: OperationViewLookup;
  try {
    lookup = await deps.readOperationView({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch {
    stream.emitTerminal(errorEvent(input, "operation_unavailable", "Operação indisponível."));
    return;
  }

  if (input.mode === "new") {
    if (lookup.kind === "found") {
      // POST inicial repetido: read-only, nenhuma etapa paga.
      await finishFromStatus(stream, input, deps);
      return;
    }
    if (lookup.kind === "read_failed") {
      stream.emitTerminal(errorEvent(input, "operation_unavailable", "Operação indisponível."));
      return;
    }
    if (!input.allowNewPaidStep) {
      stream.emitTerminal(
        errorEvent(
          input,
          "generation_unavailable",
          "Nova geração conjunta indisponível. Nenhuma operação foi criada.",
        ),
      );
      return;
    }
    if (!input.initialRequestId) {
      stream.emitTerminal(errorEvent(input, "missing_initial_request_id", "Identidade inicial ausente."));
      return;
    }

    let preflight: JointPreflightResult;
    if (input.preflight !== undefined) {
      preflight = input.preflight;
    } else {
      try {
        preflight = await deps.preflightJointSelection();
      } catch {
        stream.emitTerminal(errorEvent(input, "configuration_read_failed", "Configuração indisponível."));
        return;
      }
    }
    if (!preflight.ok) {
      stream.emitTerminal(
        errorEvent(input, preflight.reason, "Seleção de expansão indisponível."),
      );
      return;
    }
    if (!input.content) {
      stream.emitTerminal(errorEvent(input, "missing_content", "Conteúdo inicial ausente."));
      return;
    }

    const opened = await deps.openJointOperation({
      mode: "new",
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      squareDeliveryId: input.squareDeliveryId,
      inputSnapshot: input.inputSnapshot,
      selection: preflight.selection,
    });
    if (opened.kind !== "opened") {
      stream.emitTerminal(
        errorEvent(
          input,
          opened.kind === "business" ? opened.reason : "joint_open_failed",
          "Não foi possível abrir a operação conjunta.",
        ),
      );
      return;
    }
    stream.emitPhase("square_base", "running");
    const target = await deps.resolveAttemptTarget({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    const base = await deps.runInitialBase({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      content: input.content,
      acquisitionId: input.initialRequestId,
      attemptReference: deps.callIdFactory(),
      deadlineAtMs: input.deadlineAtMs,
      allowNewPaidStep: input.allowNewPaidStep,
      attemptTarget: target,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    stream.emitPhase(
      "square_base",
      base.kind === "completed" ? "complete" : "skipped",
    );
    await finishFromStatus(stream, input, deps);
    return;
  }

  if (lookup.kind !== "found") {
    stream.emitTerminal(errorEvent(input, "operation_not_found", "Operação não encontrada."));
    return;
  }
  if (!input.requestId) {
    stream.emitTerminal(errorEvent(input, "missing_request_id", "requestId obrigatório."));
    return;
  }
  await runResume(stream, input, deps, input.requestId);
}

export async function runTwoFormatGeneration(
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
): Promise<Response> {
  const stream = createTwoFormatStream({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  stream.start(() => execute(input, deps, stream));
  return stream.response;
}
