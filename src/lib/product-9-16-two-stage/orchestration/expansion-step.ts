import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";
import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import type { ExpandVerticalResult } from "@/lib/campaign/vertical-expansion/types";
import { probeExpansionTarget } from "@/lib/campaign/vertical-expansion/probe";
import type { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import type { AttemptTarget, TwoStageStepStatus } from "../types";
import { canAffordStep, remainingForStep } from "./deadline-budget";
import { mapModuleOutcomeToControl, type ModuleOutcome } from "./failure-mapping";
import { finishStepWithAck } from "./finish-ack";
import { reconcileExpansionArtifact } from "./reconciliation";
import type { StepExecutionOutcome, ExpansionConfigurationPreflight } from "./types";

export interface ExpansionStepInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
  readonly acquisitionId: string;
  readonly attemptReference: string;
  readonly attemptTarget: AttemptTarget;
  readonly deadlineAtMs: number;
  readonly expansionStatus: TwoStageStepStatus;
  readonly allowNewPaidStep: boolean;
  /**
   * Seleção congelada da expansão. Recebida do orquestrador (preflight) e
   * encaminhada ao expansor; o step nunca monta seleção própria.
   */
  readonly selection: ExpansionSelection;
  readonly signal?: AbortSignal;
}

export interface ExpansionStepDeps {
  readonly control: Pick<ProductTwoStageOperationClient, "acquire" | "finish" | "getOperationView">;
  readonly expand: (
    input: {
      source: {
        storeId: string;
        campaignId: string;
        operationId: string;
        role: "square_prepared";
      };
      operationId: string;
      attempt: { number: number; reference: string };
      authorization: AuthorizationContext;
      timeoutMs: number;
      signal?: AbortSignal;
    },
    deps: { readonly selection: ExpansionSelection },
  ) => Promise<ExpandVerticalResult>;
  /**
   * Preflight read-only de catálogo + pricing da seleção CONGELADA. Obrigatório:
   * a ausência de dependência não pode desligar silenciosamente o gate de gasto.
   * Nunca lê a configuração administrativa vigente.
   */
  readonly preflightFrozenExpansion: (
    selection: ExpansionSelection,
  ) => Promise<ExpansionConfigurationPreflight>;
  readonly retrieve?: typeof retrieveCompositionArtifact;
  readonly probe?: typeof probeExpansionTarget;
  readonly clock: () => number;
  readonly client?: unknown;
  readonly reconcile?: typeof reconcileExpansionArtifact;
}

function outcomeForFailure(result: Exclude<ExpandVerticalResult, { kind: "expanded" | "reused" }>): ModuleOutcome {
  switch (result.kind) {
    case "provider_failure":
      return { kind: "provider_failure", failureClass: result.failure.class };
    case "definitive_failure":
      return { kind: "definitive_failure" };
    case "unknown_result":
      return { kind: "unknown_result" };
    case "invalid_output":
      return { kind: "invalid_output" };
    case "export_failed":
      return { kind: "definitive_failure" };
    case "conflict":
      return { kind: "conflict" };
    case "persistence_failed":
      return { kind: "persistence_failed" };
    case "readback_failed":
      return { kind: "readback_failed" };
    case "blocked":
      return { kind: "blocked", transient: true };
    case "model_unavailable":
    case "pricing_unavailable":
    case "source_unavailable":
      return { kind: "definitive_failure" };
    case "invalid_input":
    case "authorization_denied":
      return { kind: "invalid_input" };
    default:
      return { kind: "definitive_failure" };
  }
}

function recoverable(reason: string): StepExecutionOutcome {
  return {
    kind: "processing",
    state: "between_steps",
    nextStep: "expansion",
    canContinue: true,
    reason,
  };
}

function preCallGate(
  input: ExpansionStepInput,
  deps: ExpansionStepDeps,
): StepExecutionOutcome | null {
  if (input.signal?.aborted) return recoverable("aborted");
  if (!canAffordStep(deps.clock(), input.deadlineAtMs, "expansion")) {
    return recoverable("deadline_exceeded");
  }
  return null;
}

export async function runExpansionStep(
  input: ExpansionStepInput,
  deps: ExpansionStepDeps,
): Promise<StepExecutionOutcome> {
  if (!input.allowNewPaidStep) {
    return { kind: "processing", state: "suspended", nextStep: "expansion", canContinue: false };
  }
  if (input.expansionStatus === "done") return { kind: "skipped" };
  if (input.expansionStatus === "in_progress") {
    return { kind: "processing", state: "step_in_progress", nextStep: "expansion", canContinue: false };
  }
  const initialGate = preCallGate(input, deps);
  if (initialGate) return initialGate;

  const retrieve = deps.retrieve ?? retrieveCompositionArtifact;
  let source: Awaited<ReturnType<typeof retrieve>>;
  try {
    source = await retrieve(
      {
        identity: {
          storeId: input.storeId,
          campaignId: input.campaignId,
          operationId: input.operationId,
          role: "square_prepared",
        },
        authorization: input.authorization,
      },
      deps.client === undefined ? {} : { client: deps.client as never },
    );
  } catch {
    return recoverable("source_read_failed");
  }
  if (source.kind !== "integral") {
    // Leitura indeterminada da fonte e pre-chamada: recuperavel, sem desfecho.
    return source.kind === "indeterminate"
      ? recoverable("source_indeterminate")
      : { kind: "definitive", reason: `source_${source.kind}` };
  }
  const sourceArtifact: ArtifactRecord = source.artifact;
  const probe = deps.probe ?? probeExpansionTarget;
  let probeResult: Awaited<ReturnType<typeof probe>>;
  try {
    probeResult = await probe(
      {
        destination: {
          storeId: input.storeId,
          campaignId: input.campaignId,
          operationId: input.operationId,
          role: "vertical",
        },
        source: sourceArtifact,
        authorization: input.authorization,
      },
      deps.client === undefined ? {} : { client: deps.client as never },
    );
  } catch {
    return recoverable("probe_read_failed");
  }
  if (probeResult.kind === "blocked") {
    return recoverable("probe_indeterminate");
  }
  if (probeResult.kind === "conflict") {
    return { kind: "definitive", reason: probeResult.reason };
  }

  // Reutilização comprovada da arte existente não é uma nova geração paga:
  // pricing/catálogo não podem bloquear a recuperação. Ainda assim, a etapa é
  // confirmada pelo caminho normal (acquire -> expand reutilizado -> finish),
  // preservando reconciliação e autoridade financeira; nada é marcado
  // `completed` só porque a imagem existe.
  const reusableArtifact =
    probeResult.kind === "reused" || probeResult.kind === "adopted";

  // Revalidar cancelamento/orcamento apos as leituras lentas, antes de adquirir.
  const gate = preCallGate(input, deps);
  if (gate) return gate;

  if (!reusableArtifact) {
    /**
     * Preflight READ-ONLY da seleção congelada: acontece UMA única vez por
     * invocação que executaria etapa paga, entre a sonda e o `acquire`, para que
     * um erro de configuração/modelo/pricing não consuma tentativa. Ordem
     * contratual: retrieve -> probe -> gate -> preflight -> recheck -> acquire.
     */
    let preflight: ExpansionConfigurationPreflight;
    try {
      preflight = await deps.preflightFrozenExpansion(input.selection);
    } catch {
      preflight = {
        ok: false,
        failure: "configuration_read_failed",
        reason: "preflight_read_failed",
        missing: [],
      };
    }
    if (!preflight.ok) {
      if (preflight.failure === "configuration_read_failed") {
        // Indeterminação: recuperável, sem acquire/desfecho/estorno.
        return recoverable("configuration_read_failed");
      }
      // Configuração comprovadamente inválida: definitivo para esta operação,
      // sem acquire, sem tentativa consumida e sem efeito financeiro direto.
      return {
        kind: "definitive",
        reason: `${preflight.failure}:${preflight.reason}`,
      };
    }
  }

  // Recheck obrigatório imediatamente antes de adquirir: cancelamento ou
  // orçamento esgotado durante o preflight não podem consumir tentativa.
  const recheck = preCallGate(input, deps);
  if (recheck) return recheck;

  const acquire = await deps.control.acquire({
    campaignId: input.campaignId,
    operationId: input.operationId,
    stage: "expansion",
    requestId: input.acquisitionId,
    target: input.attemptTarget,
  });
  if (!acquire.acquired) {
    return {
      kind: "processing",
      state: "step_in_progress",
      nextStep: "expansion",
      canContinue: false,
      reason: acquire.reason ?? "query_only",
    };
  }

  const result = await deps.expand(
    {
      source: {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        role: "square_prepared",
      },
      operationId: input.operationId,
      attempt: { number: acquire.attemptNumber, reference: input.attemptReference },
      authorization: input.authorization,
      timeoutMs: remainingForStep(deps.clock(), input.deadlineAtMs),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
    { selection: input.selection },
  );

  if (result.kind === "expanded" || result.kind === "reused") {
    const ack = await finishStepWithAck(
      {
        stage: "expansion",
        request: {
          campaignId: input.campaignId,
          operationId: input.operationId,
          attemptToken: acquire.attemptToken,
          expectedStatus: "in_progress",
          status: "completed",
        },
      },
      deps,
    );
    if (ack.kind === "accepted" || ack.kind === "already_done") {
      return { kind: "completed" };
    }
    return {
      kind: "unknown",
      reason: ack.kind === "rejected" ? `finish_rejected_${ack.reason}` : ack.reason,
    };
  }

  const mapped = mapModuleOutcomeToControl(outcomeForFailure(result));
  if (mapped.reconcileFirst) {
    const reconcile = deps.reconcile ?? reconcileExpansionArtifact;
    const reconciled = await reconcile(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        authorization: input.authorization,
      },
      deps.client === undefined ? {} : { client: deps.client as never },
    );
    if (reconciled.kind === "completed") {
      const ack = await finishStepWithAck(
        {
          stage: "expansion",
          request: {
            campaignId: input.campaignId,
            operationId: input.operationId,
            attemptToken: acquire.attemptToken,
            expectedStatus: "in_progress",
            status: "completed",
          },
        },
        deps,
      );
      if (ack.kind === "accepted" || ack.kind === "already_done") {
        return { kind: "completed" };
      }
      return {
        kind: "unknown",
        reason: ack.kind === "rejected" ? `finish_rejected_${ack.reason}` : ack.reason,
      };
    }
    if (reconciled.kind === "unknown") return { kind: "unknown", reason: reconciled.reason };
  }

  const failedAck = await finishStepWithAck(
    {
      stage: "expansion",
      request: {
        campaignId: input.campaignId,
        operationId: input.operationId,
        attemptToken: acquire.attemptToken,
        expectedStatus: "in_progress",
        status: "failed",
        failureClass: mapped.finishFailureClass,
      },
    },
    deps,
  );
  if (failedAck.kind === "already_done") {
    return { kind: "completed" };
  }
  if (failedAck.kind !== "accepted") {
    return {
      kind: "unknown",
      reason:
        failedAck.kind === "rejected"
          ? `finish_rejected_${failedAck.reason}`
          : failedAck.reason,
    };
  }
  if (mapped.finishFailureClass === "unknown") return { kind: "unknown", reason: "provider_unknown" };
  if (mapped.finishFailureClass === "transient") return { kind: "retryable", reason: "transient" };
  return { kind: "definitive", reason: result.kind };
}
