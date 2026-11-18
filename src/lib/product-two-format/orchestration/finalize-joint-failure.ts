import "server-only";

import type { CreditOperationErrorCode } from "@/lib/product-1-1/credit-operation/types";
import type { JointSquareProbeResult } from "@/lib/product-two-format/orchestration/square-probe";
import type { VerticalArtifactProbeResult } from "@/lib/product-9-16-two-stage/two-stage-financial-service";
import type {
  RecordOutcomeRequest,
  RecordOutcomeResult,
  TwoStageStage,
} from "@/lib/product-9-16-two-stage/types";
import { readTwoFormatDelivery, type TwoFormatReadResult } from "@/lib/product-two-format/delivery-reader";
import type { TwoFormatFormatView } from "@/lib/product-two-format/read-model";
import type { TwoFormatFormat } from "@/lib/product-two-format/types";
import type {
  TwoFormatDeliveryErrorCode,
  TwoFormatRefundInput,
  TwoFormatRefundResult,
} from "@/lib/product-two-format/joint-financial-client";

/**
 * F60.7-06 — semântica D12 de falha e estorno parcial (server-only).
 *
 * Nenhum refund acontece sem AUSÊNCIA COMPROVADA por sonda server-side e sem
 * OUTCOME CONFIRMADO. O `observedEpoch` é lido ANTES da sonda, na identidade do
 * formato (vertical = controle; quadrado = `squareDeliveryId`). A projeção é
 * sempre da RPC: nada é projetado no app.
 *
 * Retomada: quando o vertical já foi estornado (crédito compartilhado
 * `refunded`), o outcome do controle NÃO é regravado — a RPC devolve
 * `operation_terminal` antes de checar idempotência — e o refund do vertical
 * NÃO é repetido. A finalidade durável compartilhada já aceita pela RPC
 * conjunta é usada como está; confirma-se o outcome PRÓPRIO do quadrado e
 * estorna-se somente ele, com epoch e sonda novos.
 */

export interface JointFinalizeInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly stage: "base" | "preparation" | "expansion";
  readonly outcomeKind: "definitive" | "unknown";
  readonly supportReference?: string | null;
  readonly attemptToken?: string;
}

export interface JointFinalizeDeps {
  readonly finish?: (input: {
    campaignId: string;
    operationId: string;
    attemptToken: string;
    expectedStatus: "in_progress";
    status: "failed";
    failureClass: "definitive";
  }) => Promise<unknown>;
  readonly recordOutcome: (
    input: RecordOutcomeRequest,
  ) => Promise<RecordOutcomeResult>;
  /** Resolve apenas quando o cliente 1:1 confirmou `success` e identidade. */
  readonly recordFormatOutcome: (input: {
    readonly campaignId: string;
    readonly operationId: string;
    readonly outcome: "failed" | "unknown";
    readonly supportReference?: string | null;
  }) => Promise<void>;
  readonly probeSquare: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<JointSquareProbeResult>;
  readonly probeVertical: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<VerticalArtifactProbeResult>;
  readonly getPublicationEpoch: (
    campaignId: string,
    deliveryOperationId: string,
  ) => Promise<number>;
  readonly refundFormat: (
    input: TwoFormatRefundInput,
  ) => Promise<TwoFormatRefundResult>;
  readonly readFormatStatuses: (input: {
    campaignId: string;
    operationId: string;
    storeId?: string;
  }) => Promise<TwoFormatReadResult>;
}

export type JointFinalizeOutcome =
  | {
      readonly kind: "refunded";
      readonly formats: readonly TwoFormatFormat[];
      readonly idempotent: boolean;
      readonly campaignStatus: string | null;
    }
  | {
      readonly kind: "partial";
      readonly refunded: readonly TwoFormatFormat[];
      readonly pending: readonly TwoFormatFormat[];
      readonly code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode;
      readonly campaignStatus: null;
    }
  | {
      readonly kind: "delivery_required";
      readonly format: TwoFormatFormat;
      readonly storagePath: string;
    }
  | {
      readonly kind: "unavailable";
      readonly reason: "not_found" | "not_two_format" | "inconsistent" | "read_failed";
    }
  | {
      readonly kind: "blocked";
      readonly code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode;
      readonly formats: readonly TwoFormatFormat[];
      readonly outcomeRecorded: boolean;
      /** Estornos já efetivados, preservados mesmo quando o próximo é bloqueado. */
      readonly refunded: readonly TwoFormatFormat[];
    }
  | { readonly kind: "unknown"; readonly reason: string };

interface Candidate {
  readonly format: TwoFormatFormat;
  readonly view: TwoFormatFormatView;
  readonly deliveryOperationId: string;
}

interface Probed extends Candidate {
  readonly observedEpoch: number;
  readonly probe: JointSquareProbeResult | VerticalArtifactProbeResult;
}

function twoFormatErrorCode(error: unknown): TwoFormatDeliveryErrorCode | null {
  if (!(error instanceof Error) || error.name !== "TwoFormatDeliveryError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as TwoFormatDeliveryErrorCode) : null;
}

function creditErrorCode(error: unknown): CreditOperationErrorCode | null {
  if (!(error instanceof Error) || error.name !== "CreditOperationError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as CreditOperationErrorCode) : null;
}

/**
 * Códigos pertinentes do cliente de outcome do quadrado (`AttemptStartError`).
 * Lista FECHADA: os demais continuam `unknown` (nunca são promovidos a sucesso).
 */
const ATTEMPT_START_OUTCOME_CODES: readonly (
  | TwoFormatDeliveryErrorCode
  | CreditOperationErrorCode
)[] = ["operation_terminal", "operation_identity_conflict"];

function attemptStartOutcomeCode(error: unknown): string | null {
  if (!(error instanceof Error) || error.name !== "AttemptStartError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  if (typeof code !== "string") return null;
  return ATTEMPT_START_OUTCOME_CODES.includes(
    code as TwoFormatDeliveryErrorCode | CreditOperationErrorCode,
  )
    ? code
    : null;
}

function errorCode(
  error: unknown,
): TwoFormatDeliveryErrorCode | CreditOperationErrorCode {
  const known =
    twoFormatErrorCode(error) ?? creditErrorCode(error) ?? attemptStartOutcomeCode(error);
  return known === null
    ? "unknown"
    : (known as TwoFormatDeliveryErrorCode | CreditOperationErrorCode);
}

function durableStage(stage: JointFinalizeInput["stage"]): TwoStageStage {
  return stage === "base" ? "base" : "expansion";
}

const FORMAT_ORDER: readonly TwoFormatFormat[] = ["1:1", "9:16"];

function sortFormats(
  formats: readonly TwoFormatFormat[],
): readonly TwoFormatFormat[] {
  return [...formats].sort(
    (left, right) => FORMAT_ORDER.indexOf(left) - FORMAT_ORDER.indexOf(right),
  );
}

/** `absent` só conta como já estornado com `creditRefunded`; senão é indeterminado. */
function alreadyRefunded(view: TwoFormatFormatView): boolean {
  return view.state === "absent" && view.creditRefunded;
}

function blockedByRefusal(
  code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode,
  pending: readonly TwoFormatFormat[],
  outcomeRecorded: boolean,
  refunded: readonly TwoFormatFormat[] = [],
): JointFinalizeOutcome {
  return {
    kind: "blocked",
    code,
    formats: pending,
    outcomeRecorded,
    refunded: sortFormats(refunded),
  };
}

/**
 * Estorna apenas o formato comprovadamente ausente, com outcome confirmado.
 */
export async function finalizeJointFailure(
  input: JointFinalizeInput,
  deps: JointFinalizeDeps,
): Promise<JointFinalizeOutcome> {
  if (input.attemptToken !== undefined && deps.finish !== undefined) {
    try {
      await deps.finish({
        campaignId: input.campaignId,
        operationId: input.operationId,
        attemptToken: input.attemptToken,
        expectedStatus: "in_progress",
        status: "failed",
        failureClass: "definitive",
      });
    } catch {
      // Finish tardio não tem efeito; a finalidade é gravada abaixo.
    }
  }

  const read = await deps.readFormatStatuses({
    campaignId: input.campaignId,
    operationId: input.operationId,
    storeId: input.storeId,
  });
  if (read.kind !== "found") {
    return { kind: "unavailable", reason: read.kind };
  }

  const square = read.view.square;
  const vertical = read.view.vertical;
  const inScope: Array<{ format: TwoFormatFormat; view: TwoFormatFormatView }> =
    input.stage === "base"
      ? [
          { format: "9:16", view: vertical },
          { format: "1:1", view: square },
        ]
      : [{ format: "9:16", view: vertical }];

  const candidates: Candidate[] = [];
  const alreadyRefundedFormats: TwoFormatFormat[] = [];
  for (const item of inScope) {
    if (item.view.state === "delivered") {
      return blockedByRefusal(
        "delivered_not_refundable",
        [item.format],
        false,
        alreadyRefundedFormats,
      );
    }
    if (item.view.state === "unknown" || item.view.state === "unavailable") {
      return { kind: "unknown", reason: `format_${item.view.state}` };
    }
    if (alreadyRefunded(item.view)) {
      alreadyRefundedFormats.push(item.format);
      continue;
    }
    if (item.view.deliveryOperationId === null) {
      return blockedByRefusal(
        "delivery_link_missing",
        [item.format],
        false,
        alreadyRefundedFormats,
      );
    }
    candidates.push({
      format: item.format,
      view: item.view,
      deliveryOperationId: item.view.deliveryOperationId,
    });
  }

  // ---- unknown: nenhum estorno, apenas finalidade indeterminada confirmada ----
  if (input.outcomeKind === "unknown") {
    const everyScopeFormatRefunded = inScope.every((item) =>
      alreadyRefundedFormats.includes(item.format),
    );
    if (everyScopeFormatRefunded) {
      return {
        kind: "refunded",
        formats: sortFormats(alreadyRefundedFormats),
        idempotent: true,
        campaignStatus: null,
      };
    }
    if (alreadyRefundedFormats.length > 0) {
      // Crédito compartilhado já terminal e ainda há formato pendente: não se
      // regrava o outcome terminal nem se estorna; a pendência permanece unknown.
      return { kind: "unknown", reason: "outcome_unknown" };
    }
    const recorded = await recordControlOutcome(input, deps, "unknown");
    if (!recorded.ok) {
      return blockedByRefusal(
        recorded.code,
        candidates.map((candidate) => candidate.format),
        false,
        alreadyRefundedFormats,
      );
    }
    return { kind: "unknown", reason: "outcome_unknown" };
  }

  // ---- definitive: epoch + sonda por candidato, na ordem vertical → quadrado ----
  const probed: Probed[] = [];
  for (const candidate of candidates) {
    let observedEpoch: number;
    try {
      observedEpoch = await deps.getPublicationEpoch(
        input.campaignId,
        candidate.deliveryOperationId,
      );
    } catch (error) {
      return blockedByRefusal(
        errorCode(error),
        candidates.map((item) => item.format),
        false,
        alreadyRefundedFormats,
      );
    }
    const probe =
      candidate.format === "1:1"
        ? await deps.probeSquare({
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
          })
        : await deps.probeVertical({
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
          });
    probed.push({ ...candidate, observedEpoch, probe });
  }

  // Artefato íntegro: liquidação sem provider, sem outcome e sem estorno.
  const squareProbe = probed.find((item) => item.format === "1:1");
  if (squareProbe !== undefined && squareProbe.probe.kind === "integral") {
    return {
      kind: "delivery_required",
      format: "1:1",
      storagePath: squareProbe.probe.storagePath,
    };
  }
  const verticalProbe = probed.find((item) => item.format === "9:16");
  if (verticalProbe !== undefined && verticalProbe.probe.kind === "integral") {
    if (input.stage === "base") {
      // Base comprovadamente ausente com vertical presente é incoerente.
      return blockedByRefusal(
        "artifact_present",
        ["9:16"],
        false,
        alreadyRefundedFormats,
      );
    }
    return {
      kind: "delivery_required",
      format: "9:16",
      storagePath: verticalProbe.probe.storagePath,
    };
  }

  // Sonda indeterminada/adulterada ⇒ unknown confirmado, sem estorno.
  const indeterminate = probed.find(
    (item) => item.probe.kind === "invalid" || item.probe.kind === "indeterminate",
  );
  if (indeterminate !== undefined) {
    if (alreadyRefundedFormats.length > 0) {
      // A operação compartilhada já é terminal; não há outcome a regravar.
      return { kind: "unknown", reason: `probe_${indeterminate.probe.kind}` };
    }
    const recorded = await recordControlOutcome(input, deps, "unknown");
    if (!recorded.ok) {
      return blockedByRefusal(
        recorded.code,
        probed.map((item) => item.format),
        false,
        alreadyRefundedFormats,
      );
    }
    return { kind: "unknown", reason: `probe_${indeterminate.probe.kind}` };
  }

  // Todas as sondas são `absent`. Confirma os outcomes ANTES do primeiro refund.
  const refundable = probed.filter((item) => item.probe.kind === "absent");
  const pendingFormats = refundable.map((item) => item.format);
  let outcomeRecorded = false;

  const controlNeeded = alreadyRefundedFormats.length === 0;
  if (controlNeeded) {
    const control = await recordControlOutcome(input, deps, "failed");
    if (!control.ok) {
      return blockedByRefusal(
        control.code,
        pendingFormats,
        false,
        alreadyRefundedFormats,
      );
    }
  }

  const squareCandidate = refundable.find((item) => item.format === "1:1");
  if (squareCandidate !== undefined) {
    try {
      await deps.recordFormatOutcome({
        campaignId: input.campaignId,
        operationId: squareCandidate.deliveryOperationId,
        outcome: "failed",
        supportReference: input.supportReference ?? null,
      });
    } catch (error) {
      return blockedByRefusal(
        errorCode(error),
        pendingFormats,
        false,
        alreadyRefundedFormats,
      );
    }
  }
  outcomeRecorded = controlNeeded || squareCandidate !== undefined;

  // Refund só então, na ordem vertical → quadrado.
  const refunded: TwoFormatFormat[] = [...alreadyRefundedFormats];
  let campaignStatus: string | null = null;
  let everyRefundIdempotent = true;

  for (const candidate of refundable) {
    const pending = pendingFormats.filter(
      (format) => !refunded.includes(format),
    );
    let result: TwoFormatRefundResult;
    try {
      result = await deps.refundFormat({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        format: candidate.format,
        artKind: "absent",
        observedEpoch: candidate.observedEpoch,
        reason: "two_format_refund",
      });
    } catch (error) {
      const code = errorCode(error);
      if (refunded.length > 0) {
        return {
          kind: "partial",
          refunded: sortFormats(refunded),
          pending,
          code,
          campaignStatus: null,
        };
      }
      return blockedByRefusal(code, pending, outcomeRecorded, refunded);
    }

    if (!result.success) {
      // Recusa de negócio (ex.: delivered_not_refundable) é terminal: sem retry.
      // O progresso já efetivado é preservado na resposta.
      return blockedByRefusal(
        result.reason,
        pending,
        outcomeRecorded,
        refunded,
      );
    }

    refunded.push(candidate.format);
    campaignStatus = result.campaignStatus;
    everyRefundIdempotent = everyRefundIdempotent && result.idempotent;
  }

  return {
    kind: "refunded",
    formats: sortFormats(refunded),
    idempotent: everyRefundIdempotent,
    campaignStatus,
  };
}

async function recordControlOutcome(
  input: JointFinalizeInput,
  deps: JointFinalizeDeps,
  outcome: "failed" | "unknown",
): Promise<
  { readonly ok: true } | { readonly ok: false; readonly code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode }
> {
  let result: RecordOutcomeResult;
  try {
    result = await deps.recordOutcome({
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage: durableStage(input.stage),
      outcome,
      supportReference: input.supportReference ?? null,
    });
  } catch (error) {
    return { ok: false, code: errorCode(error) };
  }
  if (!result.success) {
    return {
      ok: false,
      code: isFinancialCode(result.reason) ? result.reason : "unknown",
    };
  }
  if (
    result.outcome !== outcome ||
    result.stage !== durableStage(input.stage)
  ) {
    return { ok: false, code: "operation_identity_conflict" };
  }
  return { ok: true };
}

function isFinancialCode(
  value: string,
): value is TwoFormatDeliveryErrorCode | CreditOperationErrorCode {
  return REFUSAL_CODES.has(value);
}

/**
 * Motivos que podem chegar como recusa do outcome. Os demais caem em
 * `unknown` (nunca são promovidos a sucesso).
 */
const REFUSAL_CODES: ReadonlySet<string> = new Set<string>([
  "operation_terminal",
  "operation_identity_conflict",
  "operation_not_found",
  "operation_in_progress",
  "publication_in_progress",
  "stale_publication",
  "evidence_stale",
  "finality_not_recorded",
  "delivered_not_refundable",
  "invalid_transition",
  "delivery_link_missing",
  "credit_operation_missing",
  "absent_not_confirmed",
  "artifact_present",
  "insufficient_evidence",
  "shared_operation_not_final",
  "invalid_envelope",
  "unknown",
]);
