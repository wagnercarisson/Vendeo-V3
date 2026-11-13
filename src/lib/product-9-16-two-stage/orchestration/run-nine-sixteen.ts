import "server-only";

import { verifyCampaignAccess } from "@/lib/campaign/composition-artifacts/access";
import type { ProductTwoStageOperationError } from "../types";
import type { AcquireStepResult, ResumeOperationResult } from "../types";
import { newAcquisitionIds, parseAcquisitionIds } from "./acquisition-ids";
import { runBaseStep } from "./base-step";
import { computeInvocationDeadline } from "./deadline-budget";
import {
  deliverVertical,
  finalizeDefinitiveFailure,
  finalizeExhaustedLimit,
} from "./delivery";
import { runExpansionStep } from "./expansion-step";
import { createNineSixteenStream } from "./ndjson";
import { runPreparationStep } from "./preparation-step";
import {
  classifyBlockedState,
  deriveTwoStageStatus,
  nextStepFromAction,
} from "./status-view";
import type {
  NineSixteenEvent,
  RunNineSixteenDeps,
  RunNineSixteenInput,
  StepExecutionOutcome,
} from "./types";
import type { TwoStageOperationView } from "../types";

export type { RunNineSixteenDeps };

function errorEvent(
  input: RunNineSixteenInput,
  code: string,
  message: string,
  refunded?: boolean,
): NineSixteenEvent {
  return {
    type: "error",
    campaignId: input.campaignId,
    operationId: input.operationId,
    code,
    message,
    ...(refunded === undefined ? {} : { refunded }),
  };
}

function unknownEvent(input: RunNineSixteenInput, reference: string): NineSixteenEvent {
  return {
    type: "unknown",
    campaignId: input.campaignId,
    operationId: input.operationId,
    reference,
  };
}

function processingEvent(
  input: RunNineSixteenInput,
  state: "between_steps" | "step_in_progress" | "delivery_pending" | "preparation_retry" | "suspended",
  nextStep: "base" | "expansion" | "delivery" | null,
  canContinue: boolean,
): NineSixteenEvent {
  return {
    type: "processing",
    campaignId: input.campaignId,
    operationId: input.operationId,
    state,
    nextStep,
    canContinue,
  };
}

function resultEvent(input: RunNineSixteenInput): NineSixteenEvent {
  return {
    type: "result",
    campaignId: input.campaignId,
    operationId: input.operationId,
    campaignUrl: `/campanhas/${input.campaignId}`,
  };
}

function statusEvent(input: RunNineSixteenInput, view: TwoStageOperationView, allow: boolean): NineSixteenEvent {
  const status = deriveTwoStageStatus(view, { allowNewPaidStep: allow });
  if (status.state === "delivered") return resultEvent(input);
  if (status.state === "refunded") {
    return errorEvent(input, "operation_refunded", "A geração foi encerrada e o crédito devolvido.", true);
  }
  if (status.state === "unknown") {
    return unknownEvent(input, view.supportReference ?? input.operationId);
  }
  return processingEvent(
    input,
    status.processingPhase ?? "between_steps",
    nextStepFromAction(view.nextAction),
    status.canContinue,
  );
}

function defaultView(input: RunNineSixteenInput): TwoStageOperationView {
  const pending = (stage: "base" | "expansion") => ({
    stage,
    status: "pending" as const,
    attemptsUsed: 0,
    failureClass: null,
    attemptNumber: null,
    claimedAt: null,
  });
  return {
    campaignId: input.campaignId,
    operationId: input.operationId,
    origin: "9_16_two_stage",
    credit: {
      status: "reserved",
      terminal: false,
      delivered: false,
      refunded: false,
      reserved: true,
    },
    base: pending("base"),
    expansion: pending("expansion"),
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "acquire_base",
    canContinue: true,
    processingPhase: "between_steps",
  };
}

function asAcquireTarget(target: AcquireStepResult["target"]): "primary" | "fallback" | "initial" | "retry" {
  return target ?? "primary";
}

async function handleStepFailure(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: ReturnType<typeof createNineSixteenStream>,
  outcome: Extract<StepExecutionOutcome, { kind: "definitive" | "unknown" | "retryable" }>,
  stage: "base" | "expansion",
): Promise<void> {
  if (outcome.kind === "retryable") {
    const lookup = await deps.control.getOperationView({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    if (lookup.kind === "found") {
      const reason = classifyBlockedState(lookup.view);
      if (reason === "attempt_limit_exhausted" || reason === "known_final_failure") {
        const finalized = await finalizeExhaustedLimit(
          {
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
            authorization: input.authorization,
            stage,
            supportReference: deps.newSupportReference(),
          },
          deps,
        );
        if (finalized.kind === "refunded") {
          stream.emitTerminal(
            errorEvent(input, "generation_failed", "A geração falhou e o crédito foi devolvido.", true),
          );
        } else if (finalized.kind === "delivery_required") {
          stream.emitTerminal(processingEvent(input, "delivery_pending", "delivery", true));
        } else {
          stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
        }
        return;
      }
    }
    stream.emitTerminal(
      processingEvent(input, "between_steps", stage === "base" ? "base" : "expansion", true),
    );
    return;
  }
  if (outcome.kind === "unknown") {
    try {
      await deps.control.recordOutcome({
        campaignId: input.campaignId,
        operationId: input.operationId,
        stage,
        outcome: "unknown",
        supportReference: deps.newSupportReference(),
      });
    } catch {
      // safe resolution remains
    }
    stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
    return;
  }
  const finalized = await finalizeDefinitiveFailure(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      stage,
    },
    deps,
  );
  if (finalized.kind === "refunded") {
    stream.emitTerminal(
      errorEvent(input, "generation_failed", "A geração falhou e o crédito foi devolvido.", true),
    );
    return;
  }
  if (finalized.kind === "delivery_required") {
    stream.emitTerminal(
      processingEvent(input, "delivery_pending", "delivery", true),
    );
    return;
  }
  stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
}

export async function runNineSixteenTwoStageGeneration(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
): Promise<Response> {
  const stream = createNineSixteenStream({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });

  const access = await verifyCampaignAccess(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      authorization: input.authorization,
    },
    (deps as { client?: never }).client as never,
  );
  if (!access.ok) {
    stream.emitTerminal(errorEvent(input, "authorization_denied", "Acesso negado."));
    return stream.response;
  }

  const deadlineAtMs = computeInvocationDeadline(input.requestStartedAtMs, input.timeoutMs);
  const allowNewPaidStep = input.allowNewPaidStep !== false;

  let acquisitionIds;
  if (input.mode === "initial") {
    acquisitionIds = newAcquisitionIds();
  } else {
    const parsed = parseAcquisitionIds(input.acquisitionIds);
    if (!parsed.ok) {
      stream.emitTerminal(errorEvent(input, "invalid_acquisition_ids", parsed.reason));
      return stream.response;
    }
    acquisitionIds = parsed.ids;
  }

  const lookup = await deps.control.getOperationView({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (lookup.kind === "read_failed") {
    stream.emitTerminal(
      processingEvent(input, "between_steps", null, false),
    );
    return stream.response;
  }

  if (input.mode === "initial") {
    if (lookup.kind === "found") {
      stream.emitTerminal(statusEvent(input, lookup.view, allowNewPaidStep));
      return stream.response;
    }
    try {
      await deps.financial.reserveOperationOnce({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
    } catch {
      stream.emitTerminal(errorEvent(input, "reservation_failed", "Não foi possível reservar o crédito."));
      return stream.response;
    }
  } else if (lookup.kind === "absent") {
    stream.emitTerminal(errorEvent(input, "operation_not_found", "Operação não encontrada."));
    return stream.response;
  }

  let view: TwoStageOperationView = lookup.kind === "found" ? lookup.view : defaultView(input);

  if (input.mode === "continue") {
    let resume: ResumeOperationResult;
    try {
      resume = await deps.control.resume({
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
    } catch {
      stream.emitTerminal(processingEvent(input, "between_steps", null, false));
      return stream.response;
    }
    if (!resume.success) {
      stream.emitTerminal(errorEvent(input, "operation_not_found", resume.reason));
      return stream.response;
    }
    if (resume.action === "wait") {
      stream.emitTerminal(processingEvent(input, "step_in_progress", null, false));
      return stream.response;
    }
    if (resume.action === "blocked") {
      const reason = classifyBlockedState(view);
      if (reason === "attempt_limit_exhausted" || reason === "known_final_failure") {
        const finalized = await finalizeExhaustedLimit(
          {
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
            authorization: input.authorization,
            stage: view.base.status === "failed" ? "base" : "expansion",
            supportReference: deps.newSupportReference(),
          },
          deps,
        );
        if (finalized.kind === "refunded") {
          stream.emitTerminal(
            errorEvent(input, "generation_failed", "A geração falhou e o crédito foi devolvido.", true),
          );
        } else if (finalized.kind === "delivery_required") {
          stream.emitTerminal(processingEvent(input, "delivery_pending", "delivery", true));
        } else {
          stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
        }
      } else {
        stream.emitTerminal(processingEvent(input, "between_steps", null, false));
      }
      return stream.response;
    }
    if (resume.action === "deliver") {
      const delivered = await deliverVertical(input, deps);
      if (delivered.kind === "completed") stream.emitTerminal(resultEvent(input));
      else if (delivered.kind === "processing") {
        stream.emitTerminal(processingEvent(input, "delivery_pending", "delivery", true));
      } else if (delivered.kind === "unknown") {
        stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
      } else {
        stream.emitTerminal(errorEvent(input, "delivery_failed", delivered.reason));
      }
      return stream.response;
    }
    if (resume.action === "acquire_base" || resume.action === "retry_base") {
      const frozen = await deps.readFrozenState({
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
      const base = await runBaseStep(
        {
          storeId: input.storeId,
          campaignId: input.campaignId,
          operationId: input.operationId,
          authorization: input.authorization,
          content: {
            briefing: input.briefing as never,
            briefingText: input.briefingText ?? "",
            campaignIntent: input.campaignIntent as never,
            backgroundDirection: input.backgroundDirection as never,
            productImagesDataUrls: input.productImagesDataUrls ?? [],
            ...(input.identityImageUrl === undefined ? {} : { identityImageUrl: input.identityImageUrl }),
            ...(input.identityDirective === undefined ? {} : { identityDirective: input.identityDirective }),
            ...(input.references === undefined ? {} : { references: input.references }),
            referenceSelections: input.referenceSelections,
            ...(input.copyContext === undefined ? {} : { copyContext: input.copyContext }),
            usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
            creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
          },
          acquisitionId: acquisitionIds.base,
          attemptReference: deps.callIdFactory(),
          attemptTarget: resume.nextTarget ?? "primary",
          deadlineAtMs,
          baseStatus: view.base.status,
          allowNewPaidStep,
          frozenState: frozen,
        },
        deps,
      );
      if (base.kind === "completed" || base.kind === "skipped") {
        stream.emitTerminal(processingEvent(input, "between_steps", "expansion", true));
      } else if (base.kind === "processing") {
        stream.emitTerminal(processingEvent(input, base.state, base.nextStep, base.canContinue));
      } else {
        await handleStepFailure(input, deps, stream, base, "base");
      }
      return stream.response;
    }
    if (resume.action === "acquire_expansion" || resume.action === "retry_expansion") {
      const expansion = await runExpansionStep(
        {
          storeId: input.storeId,
          campaignId: input.campaignId,
          operationId: input.operationId,
          authorization: input.authorization,
          acquisitionId: acquisitionIds.expansion,
          attemptReference: deps.callIdFactory(),
          attemptTarget: resume.nextTarget ?? "initial",
          deadlineAtMs,
          expansionStatus: view.expansion.status,
          allowNewPaidStep,
        },
        deps,
      );
      if (expansion.kind === "completed") {
        const delivered = await deliverVertical(input, deps);
        if (delivered.kind === "completed") stream.emitTerminal(resultEvent(input));
        else if (delivered.kind === "processing") {
          stream.emitTerminal(processingEvent(input, "delivery_pending", "delivery", true));
        } else {
          stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
        }
      } else if (expansion.kind === "processing" || expansion.kind === "skipped") {
        stream.emitTerminal(processingEvent(input, "between_steps", "expansion", expansion.kind !== "skipped"));
      } else {
        await handleStepFailure(input, deps, stream, expansion, "expansion");
      }
      return stream.response;
    }
  }

  // initial: base -> preparation -> expansion -> delivery
  const base = await runBaseStep(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      content: {
        briefing: input.briefing as never,
        briefingText: input.briefingText ?? "",
        campaignIntent: input.campaignIntent as never,
        backgroundDirection: input.backgroundDirection as never,
        productImagesDataUrls: input.productImagesDataUrls ?? [],
        ...(input.identityImageUrl === undefined ? {} : { identityImageUrl: input.identityImageUrl }),
        ...(input.identityDirective === undefined ? {} : { identityDirective: input.identityDirective }),
        ...(input.references === undefined ? {} : { references: input.references }),
        referenceSelections: input.referenceSelections,
        ...(input.copyContext === undefined ? {} : { copyContext: input.copyContext }),
        usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
        creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
      },
      acquisitionId: acquisitionIds.base,
      attemptReference: deps.callIdFactory(),
      attemptTarget: "primary",
      deadlineAtMs,
      baseStatus: view.base.status,
      allowNewPaidStep,
      frozenState: { kind: "absent" },
    },
    deps,
  );
  if (base.kind === "processing" || base.kind === "skipped") {
    stream.emitTerminal(processingEvent(input, "between_steps", "base", base.kind !== "skipped"));
    return stream.response;
  }
  if (base.kind !== "completed") {
    await handleStepFailure(input, deps, stream, base, "base");
    return stream.response;
  }

  const preparation = await runPreparationStep(input, deps);
  if (preparation.kind === "processing") {
    stream.emitTerminal(processingEvent(input, "preparation_retry", "expansion", true));
    return stream.response;
  }
  if (preparation.kind === "definitive") {
    await handleStepFailure(input, deps, stream, preparation, "expansion");
    return stream.response;
  }

  const expansion = await runExpansionStep(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      acquisitionId: acquisitionIds.expansion,
      attemptReference: deps.callIdFactory(),
      attemptTarget: "initial",
      deadlineAtMs,
      expansionStatus: view.expansion.status,
      allowNewPaidStep,
    },
    deps,
  );
  if (expansion.kind === "processing" || expansion.kind === "skipped") {
    stream.emitTerminal(processingEvent(input, "between_steps", "expansion", expansion.kind !== "skipped"));
    return stream.response;
  }
  if (expansion.kind !== "completed") {
    await handleStepFailure(input, deps, stream, expansion, "expansion");
    return stream.response;
  }

  const delivered = await deliverVertical(input, deps);
  if (delivered.kind === "completed") stream.emitTerminal(resultEvent(input));
  else if (delivered.kind === "processing") {
    stream.emitTerminal(processingEvent(input, "delivery_pending", "delivery", true));
  } else if (delivered.kind === "unknown") {
    stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
  } else {
    stream.emitTerminal(errorEvent(input, "delivery_failed", delivered.reason));
  }
  return stream.response;
}
