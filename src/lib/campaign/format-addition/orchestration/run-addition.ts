import "server-only";

import type { PrepareSquareResult } from "@/lib/campaign/square-preparation/types";

import type {
  FormatAdditionExecutionDeps,
  FormatAdditionOpeningDeps,
  FormatAdditionRunResult,
  OpenFormatAdditionInput,
  OpenFormatAdditionResult,
  PrepareAdditionSourceInput,
  PrepareAdditionSourceResult,
  RunFormatAdditionInput,
} from "./types";
import { openFormatAddition } from "./open-addition";
import { continueFormatAddition } from "./resume-addition";

/**
 * F62/62-04 (Tasks 1–2) — entrada pública do orquestrador dedicado.
 *
 * Nesta altura implementa SOMENTE abertura/replay. As Tasks 3–4 (preparação,
 * expansão, entrega, falha/unknown) permanecem bloqueadas até o Review Stop
 * intermediário ser aprovado.
 */
export async function runFormatAdditionOpening(
  input: OpenFormatAdditionInput,
  deps: FormatAdditionOpeningDeps,
): Promise<OpenFormatAdditionResult> {
  return openFormatAddition(input, deps);
}

/**
 * Fluxo completo das Tasks 1–4: abertura/replay → preparação direta →
 * expansão com congelado → entrega ou falha/unknown. A retomada reutiliza o
 * vínculo durável e nunca recaptura economia nem reserva outro crédito.
 */
export async function runFormatAddition(
  input: RunFormatAdditionInput,
  deps: FormatAdditionOpeningDeps & FormatAdditionExecutionDeps,
): Promise<FormatAdditionRunResult> {
  const opened = await openFormatAddition(input, deps);
  if (!opened.ok) {
    return Object.freeze({
      ok: false as const,
      code: opened.code,
      reason: opened.reason,
      ...(opened.detail === undefined ? {} : { detail: opened.detail }),
    });
  }

  if (opened.kind === "replay" && opened.state === "delivered") {
    return Object.freeze({
      ok: true as const,
      kind: "delivered" as const,
      operationId: opened.operationId,
      requestId: opened.requestId,
      idempotent: true,
    });
  }
  if (opened.kind === "replay" && opened.state === "refunded") {
    return Object.freeze({
      ok: true as const,
      kind: "refunded" as const,
      operationId: opened.operationId,
      requestId: opened.requestId,
    });
  }

  // C3: replay `unknown` NÃO encerra: a continuação reconcilia o artefato,
  // confirma entrega sem nova chamada paga ou permanece unknown sem estorno.
  return continueFormatAddition(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: opened.operationId,
      requestId: opened.requestId,
      authorization: input.authorization,
      deadlineAtMs: input.deadlineAtMs,
      allowNewPaidStep: input.allowNewPaidStep,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
    deps,
  );
}

function detailOf(result: Exclude<PrepareSquareResult, { kind: "prepared" }>): string | undefined {
  if ("detail" in result && typeof result.detail === "string") {
    return result.detail;
  }
  if ("reason" in result && typeof result.reason === "string") {
    return result.reason;
  }
  return undefined;
}

/**
 * Chamada DIRETA da preparação com fonte e destino distintos: a fonte é a
 * identidade estável de registro (`source_registration_operation_id`) e o
 * destino é o `operationId` da adição. Não usa `runPreparationStep`.
 */
export async function prepareAdditionSource(
  input: PrepareAdditionSourceInput,
  deps: { readonly prepare: FormatAdditionExecutionDeps["prepare"] },
): Promise<PrepareAdditionSourceResult> {
  const result = await deps.prepare({
    source: {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.sourceRegistrationOperationId,
      role: "square_original",
    },
    preparedOperationId: input.operationId,
    authorization: input.authorization,
  });

  if (result.kind === "prepared") {
    return Object.freeze({ ok: true as const, result });
  }
  return Object.freeze({
    ok: false as const,
    reason: result.kind,
    ...(detailOf(result) === undefined ? {} : { detail: detailOf(result) }),
  });
}
