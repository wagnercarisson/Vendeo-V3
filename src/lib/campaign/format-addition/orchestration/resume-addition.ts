import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { TwoStageOperationView } from "@/lib/product-9-16-two-stage/types";

import { parseFrozenEconomics } from "../frozen-economics";
import type {
  FormatAdditionExecutionDeps,
  FormatAdditionPilotSpendResolution,
  FormatAdditionRunResult,
} from "./types";

export interface ContinueFormatAdditionInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly authorization: AuthorizationContext;
  readonly deadlineAtMs: number;
  readonly allowNewPaidStep: boolean;
  readonly signal?: AbortSignal;
}

function fail(
  code: string,
  reason: string,
  detail?: string,
): FormatAdditionRunResult {
  return Object.freeze({
    ok: false as const,
    code,
    reason,
    ...(detail === undefined ? {} : { detail }),
  });
}

function processing(
  input: ContinueFormatAdditionInput,
  state: string,
  reason?: string,
): FormatAdditionRunResult {
  return Object.freeze({
    ok: true as const,
    kind: "processing" as const,
    operationId: input.operationId,
    requestId: input.requestId,
    state,
    ...(reason === undefined ? {} : { reason }),
  });
}

function delivered(
  input: ContinueFormatAdditionInput,
  idempotent: boolean,
): FormatAdditionRunResult {
  return Object.freeze({
    ok: true as const,
    kind: "delivered" as const,
    operationId: input.operationId,
    requestId: input.requestId,
    idempotent,
  });
}

function refunded(input: ContinueFormatAdditionInput): FormatAdditionRunResult {
  return Object.freeze({
    ok: true as const,
    kind: "refunded" as const,
    operationId: input.operationId,
    requestId: input.requestId,
  });
}

function unknown(
  input: ContinueFormatAdditionInput,
  reason: string,
): FormatAdditionRunResult {
  return Object.freeze({
    ok: true as const,
    kind: "unknown" as const,
    operationId: input.operationId,
    requestId: input.requestId,
    reason,
  });
}

export async function continueFormatAddition(
  input: ContinueFormatAdditionInput,
  deps: FormatAdditionExecutionDeps,
): Promise<FormatAdditionRunResult> {
  const durable = await deps.readDurableContext({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (durable.kind === "missing") {
    return fail("durable_context_missing", "format_addition_not_found");
  }
  if (durable.kind === "read_failed") {
    return fail("durable_context_read_failed", durable.reason);
  }

  const frozen = parseFrozenEconomics(
    durable.context.selection,
    durable.context.frozenEconomics,
  );
  if (!frozen.ok) {
    return fail("frozen_economics_invalid", frozen.reason, frozen.detail);
  }

  // C3: a visão durável é lida ANTES de refazer a preparação. Ela decide se o
  // caso é terminal/reconciliável (delivered/refunded/unknown/failed) e evita
  // escrita desnecessária na retomada.
  let lookup;
  try {
    lookup = await deps.control.getOperationView({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch (error) {
    return fail(
      "operation_view_read_failed",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (lookup.kind === "absent") {
    return fail("operation_not_found", "format_addition_not_found");
  }
  if (lookup.kind === "read_failed") {
    return fail("operation_view_read_failed", lookup.reason);
  }
  const view = lookup.view;

  const reconciled = await reconcileTerminalView(input, deps, view);
  if (reconciled !== null) return reconciled;

  if (view.expansion.status === "done" || view.nextAction === "deliver") {
    return deliverOrFinalize(input, deps);
  }
  if (view.expansion.status === "in_progress" || view.nextAction === "wait") {
    return processing(input, "expansion_in_progress");
  }
  if (view.nextAction === "blocked") {
    return unknown(input, "operation_blocked");
  }
  if (!input.allowNewPaidStep) {
    return processing(input, "suspended");
  }
  if (view.base.status === "in_progress") {
    return processing(input, "preparation_in_progress");
  }

  // C5: `base = done` significa apenas que o quadrado original foi reutilizado,
  // NÃO que o `square_prepared` exista. A preparação idempotente garante/reutiliza
  // o prepared antes de qualquer expansão nova/retry; se ele já for íntegro, a
  // própria preparação o reutiliza sem transformação/upload duplicados.
  const prepared = await deps.prepare({
    source: {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: durable.context.sourceRegistrationOperationId,
      role: "square_original",
    },
    preparedOperationId: input.operationId,
    authorization: input.authorization,
  });
  if (prepared.kind !== "prepared") {
    const disposition = classifyPreparationFailure(prepared);
    if (disposition.kind === "retry") {
      return processing(input, "preparation_retry", disposition.reason);
    }
    return finalize(input, deps, disposition.reason);
  }

  // C1: o gate do piloto é resolvido somente no limite da chamada paga. Uma
  // leitura incerta bloqueia o provider sem gravar desfecho nem estornar.
  let pilot: FormatAdditionPilotSpendResolution;
  try {
    pilot = await deps.resolvePilotSpend({ storeId: input.storeId });
  } catch {
    pilot = { kind: "blocked", reason: "pilot_gate_read_failed" };
  }
  if (pilot.kind === "blocked") {
    return processing(input, "pilot_blocked", pilot.reason);
  }

  const expansion = await deps.runExpansion({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
    selection: {
      model: frozen.frozen.selection.model,
      quality: frozen.frozen.selection.quality,
      configVersionId: frozen.frozen.selection.configVersionId,
      origin: "configured",
    },
    frozen: frozen.frozen,
    acquisitionId: deps.callId(),
    attemptReference: deps.callId(),
    attemptTarget:
      view.nextAction === "retry_expansion" ? "retry" : "initial",
    deadlineAtMs: input.deadlineAtMs,
    expansionStatus: view.expansion.status,
    allowNewPaidStep: input.allowNewPaidStep,
    ...(pilot.kind === "armed" ? { pilotSpend: pilot.gate } : {}),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });

  switch (expansion.kind) {
    case "completed":
      return deliverOrFinalize(input, deps);
    case "processing":
    case "retryable":
      return processing(
        input,
        expansion.kind === "processing" ? expansion.state : "retryable",
        "reason" in expansion && expansion.reason !== undefined
          ? expansion.reason
          : undefined,
      );
    case "definitive":
      return finalize(input, deps, expansion.reason);
    case "unknown":
      return unknown(input, expansion.reason);
    case "skipped":
      return processing(input, "skipped");
  }
}

type PreparationFailure = Exclude<
  Awaited<ReturnType<FormatAdditionExecutionDeps["prepare"]>>,
  { kind: "prepared" }
>;

/**
 * C4: leitura/persistência/indeterminação da preparação são RETOMÁVEIS. Só
 * falhas comprovadamente definitivas gravam outcome/estorno.
 */
function classifyPreparationFailure(
  failure: PreparationFailure,
): { kind: "retry"; reason: string } | { kind: "terminal"; reason: string } {
  switch (failure.kind) {
    case "indeterminate":
      return { kind: "retry", reason: "preparation_indeterminate" };
    case "persistence_failed":
      return {
        kind: "retry",
        reason: `preparation_persistence_failed_${failure.reason}`,
      };
    case "readback_failed":
      return {
        kind: "retry",
        reason: `preparation_readback_failed_${failure.reason}`,
      };
    case "source_unavailable":
      return failure.reason === "indeterminate"
        ? { kind: "retry", reason: "preparation_source_indeterminate" }
        : {
            kind: "terminal",
            reason: `preparation_source_${failure.reason}`,
          };
    case "transform_failed":
      return {
        kind: "terminal",
        reason: `preparation_transform_${failure.reason}`,
      };
    case "invalid_input":
      return { kind: "terminal", reason: `preparation_invalid_${failure.reason}` };
    case "authorization_denied":
      return {
        kind: "terminal",
        reason: `preparation_authorization_${failure.reason}`,
      };
    case "conflict":
      return { kind: "terminal", reason: `preparation_${failure.reason}` };
  }
}

/**
 * C3: reconcilia estados terminais/incertos ANTES de encerrar. `unknown` e
 * `failedOutcome` sondam o artefato: arte íntegra é entregue sem nova chamada
 * paga; `failed` com arte ausente conclui o estorno; `unknown` com arte ausente
 * permanece unknown, sem estorno nem regeneração.
 */
async function reconcileTerminalView(
  input: ContinueFormatAdditionInput,
  deps: FormatAdditionExecutionDeps,
  view: TwoStageOperationView,
): Promise<FormatAdditionRunResult | null> {
  if (view.credit.delivered) return delivered(input, true);
  if (view.credit.refunded) return refunded(input);
  if (!view.unknown && !view.failedOutcome) return null;

  const delivery = await deps.deliverVertical({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
  });

  switch (delivery.kind) {
    case "delivered":
      return delivered(input, delivery.idempotent);
    case "processing":
      return processing(input, "delivery_pending", delivery.reason);
    case "indeterminate":
      return unknown(input, "vertical_artifact_indeterminate");
    case "absent":
      return view.failedOutcome
        ? finalize(input, deps, "failed_outcome_without_artifact")
        : unknown(input, "operation_unknown");
    case "invalid":
      return unknown(
        input,
        view.failedOutcome
          ? "failed_outcome_artifact_invalid"
          : "unknown_artifact_invalid",
      );
    case "failed":
      return unknown(
        input,
        view.failedOutcome
          ? "failed_outcome_delivery_failed"
          : "unknown_delivery_failed",
      );
  }
}

async function deliverOrFinalize(
  input: ContinueFormatAdditionInput,
  deps: FormatAdditionExecutionDeps,
  allowFinalize = true,
): Promise<FormatAdditionRunResult> {
  const delivery = await deps.deliverVertical({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
  });

  switch (delivery.kind) {
    case "delivered":
      return delivered(input, delivery.idempotent);
    case "processing":
      return processing(input, "delivery_pending", delivery.reason);
    case "indeterminate":
      return unknown(input, "vertical_artifact_indeterminate");
    case "absent":
      return allowFinalize
        ? finalize(input, deps, "vertical_artifact_absent")
        : fail("delivery_failed", "vertical_artifact_absent");
    case "invalid":
      return allowFinalize
        ? finalize(input, deps, "vertical_artifact_invalid")
        : fail("delivery_failed", "vertical_artifact_invalid");
    case "failed":
      return fail("delivery_failed", delivery.reason, delivery.code);
  }
}

async function finalize(
  input: ContinueFormatAdditionInput,
  deps: FormatAdditionExecutionDeps,
  reason: string,
): Promise<FormatAdditionRunResult> {
  const finalized = await deps.finalizeFailure({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
    reason,
  });

  switch (finalized.kind) {
    case "refunded":
      return refunded(input);
    case "delivered":
      return deliverOrFinalize(input, deps, false);
    case "unknown":
      return unknown(input, finalized.reason);
    case "blocked":
      return fail("finalization_blocked", finalized.reason);
  }
}
