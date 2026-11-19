import "server-only";

import type { AttemptTarget, OperationViewLookup } from "@/lib/product-9-16-two-stage/types";
import { canAffordStep } from "@/lib/product-9-16-two-stage/orchestration/deadline-budget";

import type { JointBaseOutcome } from "./joint-base";
import type { JointFinalizeOutcome } from "./finalize-joint-failure";
import {
  type JointOpenInput,
  type JointOpenOutcome,
} from "./joint-operation-service";
import type { JointPreflightResult } from "./preflight";
import type { JointProjectionRepairOutcome } from "./repair-joint-projection";
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
import type { JointSquareDeliveryOutcome } from "./deliver-square";
import type { JointVerticalDeliveryOutcome } from "./deliver-joint-vertical";
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
  /** Deriva o alvo da AUTORIDADE persistida; `null` nunca é substituído. */
  readonly resolveAttemptTarget: (input: {
    campaignId: string;
    operationId: string;
  }) => Promise<AttemptTarget | null>;
  readonly finalizeJointFailure: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    stage: "base" | "preparation" | "expansion";
    outcomeKind: "definitive" | "unknown";
  }) => Promise<JointFinalizeOutcome>;
  readonly clock: () => number;
  readonly callIdFactory: () => string;
}

type Stream = ReturnType<typeof createTwoFormatStream>;

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
  options: { readonly partial?: boolean; readonly operationTerminal?: boolean } = {},
): TwoFormatEvent {
  const delivered = (["1:1", "9:16"] as const).filter(
    (format) => snapshot.formats[format].state === "delivered",
  );
  return {
    type: "result",
    campaignId: input.campaignId,
    operationId: input.operationId,
    responseTerminal: true,
    operationTerminal:
      options.operationTerminal ?? snapshot.operationTerminal,
    campaignUrl: `/campanhas/${input.campaignId}`,
    formats: snapshot.formats,
    preferredFormat: snapshot.preferredFormat,
    partial: options.partial ?? delivered.length === 1,
  };
}

function errorEvent(
  input: TwoFormatRunInput,
  code: string,
  message: string,
  options: {
    readonly operationTerminal?: boolean;
    readonly refunded?: boolean;
    readonly format?: TwoFormatFormat;
  } = {},
): TwoFormatEvent {
  return {
    type: "error",
    campaignId: input.campaignId,
    operationId: input.operationId,
    responseTerminal: true,
    operationTerminal: options.operationTerminal ?? false,
    code,
    message,
    ...(options.format === undefined ? {} : { format: options.format }),
    ...(options.refunded === undefined ? {} : { refunded: options.refunded }),
  };
}

function unknownEvent(input: TwoFormatRunInput): TwoFormatEvent {
  return {
    type: "unknown",
    campaignId: input.campaignId,
    operationId: input.operationId,
    responseTerminal: true,
    operationTerminal: false,
    reference: input.operationId,
  };
}

/**
 * Deriva o terminal da RESPOSTA a partir dos DOIS formatos, nunca de um único
 * campo. Ambos estornados NÃO são sucesso; indeterminação não é terminal.
 */
export function terminalForStatus(
  input: TwoFormatRunInput,
  snapshot: TwoFormatStatusSnapshot,
): TwoFormatEvent {
  const square = snapshot.formats["1:1"].state;
  const vertical = snapshot.formats["9:16"].state;
  const deliveredCount =
    (square === "delivered" ? 1 : 0) + (vertical === "delivered" ? 1 : 0);

  if (deliveredCount === 2) {
    return resultEvent(input, snapshot, {
      partial: false,
      operationTerminal: true,
    });
  }

  if (deliveredCount === 1) {
    const other = square === "delivered" ? vertical : square;
    if (other === "processing") return processingEvent(input, snapshot);
    if (other === "absent") {
      return resultEvent(input, snapshot, {
        partial: true,
        operationTerminal: true,
      });
    }
    // unknown/unavailable: preserva o entregue, sem declarar terminal.
    return resultEvent(input, snapshot, {
      partial: true,
      operationTerminal: false,
    });
  }

  if (square === "absent" && vertical === "absent") {
    if (snapshot.operationTerminal) {
      return errorEvent(
        input,
        "joint_refunded",
        "A operação conjunta foi estornada.",
        { operationTerminal: true, refunded: true },
      );
    }
    return processingEvent(input, snapshot);
  }

  if (
    square === "unknown" ||
    vertical === "unknown" ||
    square === "unavailable" ||
    vertical === "unavailable"
  ) {
    return unknownEvent(input);
  }

  return processingEvent(input, snapshot);
}

async function readStatus(
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
): Promise<TwoFormatStatusSnapshot> {
  return deps.readStatus({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    allowNewPaidStep: input.allowNewPaidStep,
  });
}

async function finishFromStatus(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
): Promise<void> {
  let snapshot: TwoFormatStatusSnapshot;
  try {
    snapshot = await readStatus(input, deps);
  } catch {
    stream.emitTerminal(unknownEvent(input));
    return;
  }
  stream.emitTerminal(terminalForStatus(input, snapshot));
}

async function finalizeAndFinish(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  stage: "base" | "preparation" | "expansion",
  outcomeKind: "definitive" | "unknown",
): Promise<void> {
  let outcome: JointFinalizeOutcome;
  try {
    outcome = await deps.finalizeJointFailure({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage,
      outcomeKind,
    });
  } catch {
    stream.emitTerminal(unknownEvent(input));
    return;
  }
  if (outcome.kind === "unknown") {
    stream.emitTerminal(unknownEvent(input));
    return;
  }
  if (outcome.kind === "unavailable") {
    stream.emitTerminal(
      errorEvent(input, "joint_finalize_unavailable", "Operação indisponível."),
    );
    return;
  }
  // `refunded`, `partial`, `delivery_required` e `blocked` são refletidos pelo
  // estado durável (nunca inventamos terminal a partir do retorno do estorno).
  await finishFromStatus(stream, input, deps);
}

function verticalStage(snapshot: TwoFormatStatusSnapshot): "base" | "expansion" {
  return snapshot.formats["1:1"].state === "delivered" ? "expansion" : "base";
}

function mapBaseOutcome(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  outcome: JointBaseOutcome,
): Promise<void> {
  switch (outcome.kind) {
    case "completed":
      stream.emitPhase("square_base", "complete");
      return finishFromStatus(stream, input, deps);
    case "skipped":
      stream.emitPhase("square_base", "skipped");
      return finishFromStatus(stream, input, deps);
    case "processing":
      return finishFromStatus(stream, input, deps);
    case "retryable":
      return finishFromStatus(stream, input, deps);
    case "definitive":
      stream.emitPhase("square_base", "failed", outcome.reason);
      return finalizeAndFinish(stream, input, deps, "base", "definitive");
    case "unknown":
      stream.emitPhase("square_base", "failed", outcome.reason);
      return finalizeAndFinish(stream, input, deps, "base", "unknown");
  }
}

function mapVerticalOutcome(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  outcome: JointVerticalDeliveryOutcome,
): Promise<void> {
  switch (outcome.kind) {
    case "delivered":
      stream.emitPhase("vertical_delivery", "complete");
      return finishFromStatus(stream, input, deps);
    case "processing":
    case "retryable":
    case "publication_pending":
    case "terminal_conflict":
      return finishFromStatus(stream, input, deps);
    case "definitive":
    case "failed":
    case "artifact_absent":
    case "artifact_incompatible":
      stream.emitPhase("vertical_delivery", "failed");
      return finalizeAndFinish(stream, input, deps, "expansion", "definitive");
    case "indeterminate":
    case "unknown":
      return finalizeAndFinish(stream, input, deps, "expansion", "unknown");
  }
}

function mapSquareOutcome(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  outcome: JointSquareDeliveryOutcome,
): Promise<void> {
  switch (outcome.kind) {
    case "delivered":
      stream.emitPhase("square_delivery", "complete");
      return finishFromStatus(stream, input, deps);
    case "publication_pending":
    case "terminal_conflict":
      return finishFromStatus(stream, input, deps);
    case "artifact_absent":
    case "artifact_incompatible":
    case "failed":
      stream.emitPhase("square_delivery", "failed");
      return finalizeAndFinish(stream, input, deps, "base", "definitive");
    case "indeterminate":
      return finalizeAndFinish(stream, input, deps, "base", "unknown");
  }
}

function mapRepairOutcome(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  outcome: JointProjectionRepairOutcome,
): Promise<void> {
  if (outcome.kind === "repaired") {
    stream.emitPhase("projection", "complete");
  }
  return finishFromStatus(stream, input, deps);
}

async function handleResumeOutcome(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  outcome: JointResumeOutcome,
): Promise<void> {
  switch (outcome.kind) {
    case "executed":
      if (outcome.action === "run_base") {
        return mapBaseOutcome(stream, input, deps, outcome.outcome);
      }
      if (outcome.action === "run_vertical_only") {
        return mapVerticalOutcome(stream, input, deps, outcome.outcome);
      }
      return mapRepairOutcome(stream, input, deps, outcome.outcome);
    case "settle_square":
      return mapSquareOutcome(stream, input, deps, outcome.outcome);
    case "partial_terminal":
      return finishFromStatus(stream, input, deps);
    case "pending_finalization": {
      // Um formato já estornado e o outro reservado: finaliza SOMENTE o escopo
      // pendente, com epoch/sonda novos e sem repetir o estorno efetivado.
      let snapshot: TwoFormatStatusSnapshot;
      try {
        snapshot = await readStatus(input, deps);
      } catch {
        stream.emitTerminal(unknownEvent(input));
        return;
      }
      return finalizeAndFinish(
        stream,
        input,
        deps,
        verticalStage(snapshot),
        "definitive",
      );
    }
    case "terminal_error":
      return finishFromStatus(stream, input, deps);
    case "blocked":
      switch (outcome.reason) {
        case "operation_in_progress":
        case "operation_terminal":
          return finishFromStatus(stream, input, deps);
        case "failed_outcome": {
          // Outcome durável já gravado: finaliza o que ficou pendente
          // (estorno/entrega), sem reexecutar etapa paga.
          let view: OperationViewLookup;
          try {
            view = await deps.readOperationView({
              campaignId: input.campaignId,
              operationId: input.operationId,
            });
          } catch {
            stream.emitTerminal(unknownEvent(input));
            return;
          }
          if (view.kind !== "found") {
            stream.emitTerminal(unknownEvent(input));
            return;
          }
          let snapshot: TwoFormatStatusSnapshot;
          try {
            snapshot = await readStatus(input, deps);
          } catch {
            stream.emitTerminal(unknownEvent(input));
            return;
          }
          return finalizeAndFinish(
            stream,
            input,
            deps,
            verticalStage(snapshot),
            view.view.unknown ? "unknown" : "definitive",
          );
        }
        case "unknown":
          stream.emitTerminal(unknownEvent(input));
          return;
        case "read_failed":
        case "partial_read":
        case "probe_failed":
        case "operation_read_failed":
        case "operation_absent":
          stream.emitTerminal(
            errorEvent(input, "operation_unavailable", "Operação indisponível."),
          );
          return;
        case "reconstruction_failed":
          stream.emitTerminal(
            errorEvent(
              input,
              "reconstruction_failed",
              "Não foi possível reconstruir o conteúdo durável.",
            ),
          );
          return;
        default:
          stream.emitTerminal(
            errorEvent(input, "joint_blocked", outcome.reason),
          );
          return;
      }
  }
}

async function runResume(
  stream: Stream,
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  acquisitionId: string,
): Promise<void> {
  let attemptTarget: AttemptTarget | null;
  try {
    attemptTarget = await deps.resolveAttemptTarget({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch {
    stream.emitTerminal(unknownEvent(input));
    return;
  }

  let outcome: JointResumeOutcome;
  try {
    outcome = await deps.resumeJointOperation({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      acquisitionId,
      attemptReference: deps.callIdFactory(),
      deadlineAtMs: input.deadlineAtMs,
      allowNewPaidStep: input.allowNewPaidStep,
      ...(attemptTarget === null ? {} : { attemptTarget }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
  } catch {
    stream.emitTerminal(unknownEvent(input));
    return;
  }

  await handleResumeOutcome(stream, input, deps, outcome);
}

async function execute(
  input: TwoFormatRunInput,
  deps: TwoFormatRunDeps,
  stream: Stream,
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

    // A abertura reserva crédito: revalidar cancelamento e orçamento DEPOIS de
    // todas as leituras e IMEDIATAMENTE antes do efeito financeiro.
    if (input.signal?.aborted) {
      stream.emitTerminal(
        errorEvent(input, "request_aborted", "Requisição cancelada antes da abertura."),
      );
      return;
    }
    if (!canAffordStep(deps.clock(), input.deadlineAtMs, "base")) {
      stream.emitTerminal(
        errorEvent(input, "deadline_exceeded", "Prazo esgotado antes da abertura."),
      );
      return;
    }

    let opened: JointOpenOutcome;
    try {
      opened = await deps.openJointOperation({
        mode: "new",
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        squareDeliveryId: input.squareDeliveryId,
        inputSnapshot: input.inputSnapshot,
        selection: preflight.selection,
      });
    } catch {
      stream.emitTerminal(unknownEvent(input));
      return;
    }
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
    await runResume(stream, input, deps, input.initialRequestId);
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
