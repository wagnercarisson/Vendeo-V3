import "server-only";

import { verifyCampaignAccess } from "@/lib/campaign/composition-artifacts/access";
import type { CopyProgressEvent } from "@/lib/campaign/square-base/run-square-base";
import type { FrozenStateReadResult } from "@/lib/campaign/square-base/types";
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
  NineSixteenPhase,
  NineSixteenProcessingState,
  RunNineSixteenDeps,
  RunNineSixteenInput,
  StepExecutionOutcome,
} from "./types";
import type { TwoStageOperationView } from "../types";

export type { RunNineSixteenDeps };

type Stream = ReturnType<typeof createNineSixteenStream>;

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
  state: NineSixteenProcessingState,
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

function statusEvent(
  input: RunNineSixteenInput,
  view: TwoStageOperationView,
  allow: boolean,
): NineSixteenEvent {
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

function withReconstruction(deps: RunNineSixteenDeps): RunNineSixteenDeps {
  if (deps.reconstruction === undefined) return deps;
  return { ...deps, ...deps.reconstruction };
}

async function readFrozenSafe(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
): Promise<FrozenStateReadResult | null> {
  try {
    return await deps.readFrozenState({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch {
    return null;
  }
}

function phaseDone(stream: Stream, phase: NineSixteenPhase, outcome: StepExecutionOutcome): void {
  if (outcome.kind === "completed") stream.emitPhase(phase, "complete");
  else if (outcome.kind === "skipped") stream.emitPhase(phase, "skipped");
  // `processing` deixa a fase em `running`; o terminal a fecha como `skipped`.
}

/**
 * F60.5 — conecta o ciclo REAL da copy ao progresso NDJSON. A copy roda dentro
 * da base; este callback só traduz os desfechos observados. Falha/indisponibilidade
 * NÃO viram sucesso e estados de espera não ficam `running` indefinidamente.
 */
function emitCopyPhase(stream: Stream, event: CopyProgressEvent): void {
  switch (event.status) {
    case "running":
      stream.emitPhase("campaign_copy", "running", "Gerando texto da campanha...");
      return;
    case "complete":
      stream.emitPhase(
        "campaign_copy",
        "complete",
        event.origin === "reused"
          ? "Texto da campanha reaproveitado."
          : "Texto da campanha gerado.",
      );
      return;
    case "failed":
      stream.emitPhase(
        "campaign_copy",
        "failed",
        "Não foi possível gerar o texto; a arte continua.",
      );
      return;
    case "skipped":
      switch (event.reason) {
        case "not_requested":
          stream.emitPhase("campaign_copy", "skipped", "Texto não solicitado.");
          return;
        case "in_progress":
          stream.emitPhase(
            "campaign_copy",
            "skipped",
            "Texto em processamento em outra requisição.",
          );
          return;
        case "waiting":
          stream.emitPhase(
            "campaign_copy",
            "skipped",
            "Texto aguardando nova janela; a arte continua.",
          );
          return;
        case "budget_exhausted":
          stream.emitPhase(
            "campaign_copy",
            "skipped",
            "Texto não iniciado por orçamento; a arte continua.",
          );
          return;
      }
  }
}

async function deliverAndEmit(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: Stream,
): Promise<void> {
  stream.emitPhase("campaign_delivery", "running");
  const delivered = await deliverVertical(input, deps);
  if (delivered.kind === "completed") {
    stream.emitPhase("campaign_delivery", "complete");
    stream.emitTerminal(resultEvent(input));
  } else if (delivered.kind === "processing") {
    stream.emitTerminal(processingEvent(input, "delivery_pending", "delivery", true));
  } else if (delivered.kind === "unknown") {
    stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
  } else {
    stream.emitTerminal(errorEvent(input, "delivery_failed", delivered.reason));
  }
}

async function handleFinalizedFailure(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: Stream,
  finalized: Awaited<ReturnType<typeof finalizeDefinitiveFailure>>,
): Promise<void> {
  if (finalized.kind === "refunded") {
    stream.emitTerminal(
      errorEvent(input, "generation_failed", "A geração falhou e o crédito foi devolvido.", true),
    );
    return;
  }
  if (finalized.kind === "delivery_required") {
    // Vertical integro com etapa ja falhada: resolucao administrativa, sem
    // prometer continuacao automatica e sem novo efeito financeiro.
    stream.emitTerminal(processingEvent(input, "delivery_pending", "delivery", false));
    return;
  }
  stream.emitTerminal(unknownEvent(input, deps.newSupportReference()));
}

async function handleStepFailure(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: Stream,
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
        await handleFinalizedFailure(input, deps, stream, finalized);
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
  await handleFinalizedFailure(input, deps, stream, finalized);
}

function contentFromInput(input: RunNineSixteenInput) {
  return {
    briefing: input.briefing as never,
    briefingText: input.briefingText ?? "",
    campaignIntent: input.campaignIntent as never,
    backgroundDirection: input.backgroundDirection as never,
    productImagesDataUrls: input.productImagesDataUrls ?? [],
    ...(input.identityImageUrl === undefined ? {} : { identityImageUrl: input.identityImageUrl }),
    ...(input.identityDirective === undefined
      ? {}
      : { identityDirective: input.identityDirective }),
    ...(input.references === undefined ? {} : { references: input.references }),
    referenceSelections: input.referenceSelections,
    ...(input.copyContext === undefined ? {} : { copyContext: input.copyContext }),
    usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
    creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
  };
}

async function runBase(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: Stream,
  options: {
    frozen: FrozenStateReadResult;
    acquisitionId: string;
    attemptTarget: AcquireStepResult["target"] | null;
    baseStatus: TwoStageOperationView["base"]["status"];
    deadlineAtMs: number;
    allowNewPaidStep: boolean;
  },
): Promise<StepExecutionOutcome> {
  stream.emitPhase("campaign_base", "running");
  const outcome = await runBaseStep(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      content: contentFromInput(input) as never,
      acquisitionId: options.acquisitionId,
      attemptReference: deps.callIdFactory(),
      attemptTarget: options.attemptTarget ?? "primary",
      deadlineAtMs: options.deadlineAtMs,
      baseStatus: options.baseStatus,
      allowNewPaidStep: options.allowNewPaidStep,
      frozenState: options.frozen,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
    {
      ...withReconstruction(deps),
      onCopyPhase: (event) => emitCopyPhase(stream, event),
    },
  );
  phaseDone(stream, "campaign_base", outcome);
  return outcome;
}

async function runPreparation(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: Stream,
): Promise<StepExecutionOutcome> {
  stream.emitPhase("campaign_preparation", "running");
  const outcome = await runPreparationStep(input, deps);
  phaseDone(stream, "campaign_preparation", outcome);
  return outcome;
}

async function runExpansion(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: Stream,
  options: {
    acquisitionId: string;
    attemptTarget: AcquireStepResult["target"] | null;
    expansionStatus: TwoStageOperationView["expansion"]["status"];
    deadlineAtMs: number;
    allowNewPaidStep: boolean;
  },
): Promise<StepExecutionOutcome> {
  stream.emitPhase("campaign_expansion", "running");
  const outcome = await runExpansionStep(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      acquisitionId: options.acquisitionId,
      attemptReference: deps.callIdFactory(),
      attemptTarget: options.attemptTarget ?? "initial",
      deadlineAtMs: options.deadlineAtMs,
      expansionStatus: options.expansionStatus,
      allowNewPaidStep: options.allowNewPaidStep,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
    {
      ...withReconstruction(deps),
      ...(deps.retrieveCompositionArtifact === undefined
        ? {}
        : { retrieve: deps.retrieveCompositionArtifact }),
      ...(deps.probeExpansion === undefined ? {} : { probe: deps.probeExpansion }),
    },
  );
  phaseDone(stream, "campaign_expansion", outcome);
  return outcome;
}

async function execute(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
  stream: Stream,
): Promise<void> {
  stream.emitPhase("campaign_validation", "running");

  const access = await verifyCampaignAccess(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      authorization: input.authorization,
    },
    deps.client,
  );
  if (!access.ok) {
    stream.emitPhase("campaign_validation", "failed");
    stream.emitTerminal(errorEvent(input, "authorization_denied", "Acesso negado."));
    return;
  }

  const deadlineAtMs = computeInvocationDeadline(input.requestStartedAtMs, input.timeoutMs);
  const allowNewPaidStep = input.allowNewPaidStep !== false;

  let acquisitionIds;
  if (input.mode === "initial") {
    acquisitionIds = newAcquisitionIds();
  } else {
    const parsed = parseAcquisitionIds(input.acquisitionIds);
    if (!parsed.ok) {
      stream.emitPhase("campaign_validation", "failed");
      stream.emitTerminal(errorEvent(input, "invalid_acquisition_ids", parsed.reason));
      return;
    }
    acquisitionIds = parsed.ids;
  }

  const lookup = await deps.control.getOperationView({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (lookup.kind === "read_failed") {
    stream.emitTerminal(processingEvent(input, "between_steps", null, false));
    return;
  }

  if (input.mode === "initial") {
    if (lookup.kind === "found") {
      stream.emitPhase("campaign_validation", "complete");
      stream.emitTerminal(statusEvent(input, lookup.view, allowNewPaidStep));
      return;
    }
    try {
      await deps.financial.reserveOperationOnce({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
    } catch {
      stream.emitPhase("campaign_validation", "failed");
      stream.emitTerminal(errorEvent(input, "reservation_failed", "Não foi possível reservar o crédito."));
      return;
    }
  } else if (lookup.kind === "absent") {
    stream.emitPhase("campaign_validation", "failed");
    stream.emitTerminal(errorEvent(input, "operation_not_found", "Operação não encontrada."));
    return;
  }
  stream.emitPhase("campaign_validation", "complete");

  const view: TwoStageOperationView = lookup.kind === "found" ? lookup.view : defaultView(input);

  if (input.mode === "continue") {
    let resume: ResumeOperationResult;
    try {
      resume = await deps.control.resume({
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
    } catch {
      stream.emitTerminal(processingEvent(input, "between_steps", null, false));
      return;
    }
    if (!resume.success) {
      stream.emitTerminal(errorEvent(input, "operation_not_found", resume.reason));
      return;
    }
    if (resume.action === "wait") {
      stream.emitTerminal(processingEvent(input, "step_in_progress", null, false));
      return;
    }
    if (resume.action === "blocked") {
      // A RPC devolve `blocked` tambem para credito terminal e desfecho
      // desconhecido; o estado duravel decide o desfecho correto.
      if (view.credit.delivered) {
        // Entregue: reparar projecao sem nova cobranca/confirmacao.
        await deliverAndEmit(input, deps, stream);
        return;
      }
      if (view.credit.refunded) {
        stream.emitTerminal(
          errorEvent(input, "operation_refunded", "A geração foi encerrada e o crédito devolvido.", true),
        );
        return;
      }
      if (view.unknown) {
        stream.emitTerminal(unknownEvent(input, view.supportReference ?? input.operationId));
        return;
      }
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
        await handleFinalizedFailure(input, deps, stream, finalized);
      } else {
        stream.emitTerminal(processingEvent(input, "between_steps", null, false));
      }
      return;
    }
    if (resume.action === "deliver") {
      await deliverAndEmit(input, deps, stream);
      return;
    }
    if (resume.action === "acquire_base" || resume.action === "retry_base") {
      const frozen = await readFrozenSafe(input, deps);
      if (frozen === null || frozen.kind === "indeterminate") {
        stream.emitTerminal(processingEvent(input, "between_steps", "base", true));
        return;
      }
      const base = await runBase(input, deps, stream, {
        frozen,
        acquisitionId: acquisitionIds.base,
        attemptTarget: resume.nextTarget,
        baseStatus: view.base.status,
        deadlineAtMs,
        allowNewPaidStep,
      });
      if (base.kind === "completed" || base.kind === "skipped") {
        // A proxima continuacao executa a preparacao gratuita antes da expansao.
        stream.emitTerminal(processingEvent(input, "between_steps", "expansion", true));
      } else if (base.kind === "processing") {
        stream.emitTerminal(processingEvent(input, base.state, base.nextStep, base.canContinue));
      } else {
        await handleStepFailure(input, deps, stream, base, "base");
      }
      return;
    }
    if (resume.action === "acquire_expansion" || resume.action === "retry_expansion") {
      // Preparacao 1152 SEMPRE antes da expansao paga (gratuita e reutilizavel).
      const preparation = await runPreparation(input, deps, stream);
      if (preparation.kind === "processing") {
        stream.emitTerminal(processingEvent(input, "preparation_retry", "expansion", true));
        return;
      }
      if (preparation.kind === "definitive") {
        await handleStepFailure(input, deps, stream, preparation, "expansion");
        return;
      }
      const expansion = await runExpansion(input, deps, stream, {
        acquisitionId: acquisitionIds.expansion,
        attemptTarget: resume.nextTarget,
        expansionStatus: view.expansion.status,
        deadlineAtMs,
        allowNewPaidStep,
      });
      if (expansion.kind === "completed") {
        await deliverAndEmit(input, deps, stream);
      } else if (expansion.kind === "processing") {
        stream.emitTerminal(
          processingEvent(
            input,
            expansion.state,
            expansion.nextStep ?? "expansion",
            expansion.canContinue,
          ),
        );
      } else if (expansion.kind === "skipped") {
        stream.emitTerminal(
          processingEvent(input, "between_steps", "expansion", false),
        );
      } else {
        await handleStepFailure(input, deps, stream, expansion, "expansion");
      }
      return;
    }
  }

  // initial: base -> preparation -> expansion -> delivery
  const frozen = await readFrozenSafe(input, deps);
  if (frozen === null || frozen.kind === "indeterminate") {
    stream.emitTerminal(processingEvent(input, "between_steps", "base", true));
    return;
  }
  const base = await runBase(input, deps, stream, {
    frozen,
    acquisitionId: acquisitionIds.base,
    attemptTarget: "primary",
    baseStatus: view.base.status,
    deadlineAtMs,
    allowNewPaidStep,
  });
  if (base.kind === "processing") {
    stream.emitTerminal(
      processingEvent(input, base.state, base.nextStep ?? "base", base.canContinue),
    );
    return;
  }
  if (base.kind === "skipped") {
    stream.emitTerminal(processingEvent(input, "between_steps", "base", false));
    return;
  }
  if (base.kind !== "completed") {
    await handleStepFailure(input, deps, stream, base, "base");
    return;
  }

  const preparation = await runPreparation(input, deps, stream);
  if (preparation.kind === "processing") {
    stream.emitTerminal(processingEvent(input, "preparation_retry", "expansion", true));
    return;
  }
  if (preparation.kind === "definitive") {
    await handleStepFailure(input, deps, stream, preparation, "expansion");
    return;
  }

  const expansion = await runExpansion(input, deps, stream, {
    acquisitionId: acquisitionIds.expansion,
    attemptTarget: "initial",
    expansionStatus: view.expansion.status,
    deadlineAtMs,
    allowNewPaidStep,
  });
  if (expansion.kind === "processing") {
    stream.emitTerminal(
      processingEvent(
        input,
        expansion.state,
        expansion.nextStep ?? "expansion",
        expansion.canContinue,
      ),
    );
    return;
  }
  if (expansion.kind === "skipped") {
    stream.emitTerminal(processingEvent(input, "between_steps", "expansion", false));
    return;
  }
  if (expansion.kind !== "completed") {
    await handleStepFailure(input, deps, stream, expansion, "expansion");
    return;
  }

  await deliverAndEmit(input, deps, stream);
}

/**
 * Devolve a `Response` NDJSON IMEDIATAMENTE; o trabalho continua em background,
 * emitindo fases durante a geracao. Qualquer excecao nao tratada vira um unico
 * terminal seguro (`unknown`), sem retry/estorno.
 */
export async function runNineSixteenTwoStageGeneration(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
): Promise<Response> {
  const stream = createNineSixteenStream({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  stream.start(() => execute(input, deps, stream));
  return stream.response;
}
