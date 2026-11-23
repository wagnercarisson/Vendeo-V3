import "server-only";

import type { PrepareSquareResult } from "@/lib/campaign/square-preparation/types";

import type {
  FormatAdditionExecutionDeps,
  FormatAdditionOpeningDeps,
  OpenFormatAdditionInput,
  OpenFormatAdditionResult,
  PrepareAdditionSourceInput,
  PrepareAdditionSourceResult,
} from "./types";
import { openFormatAddition } from "./open-addition";

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
