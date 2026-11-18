/**
 * F60.7 Subfatia B — abertura conjunta (serviço injetável).
 *
 * Duas responsabilidades separadas por `mode`:
 * - `mode: "new"`: operação NOVA. A `selection` deve vir do preflight
 *   administrativo aprovado; o chamador é responsável por executá-lo.
 * - `mode: "replay"`: reenvio equivalente. Usa a `frozenSelection` persistida
 *   na operação; NÃO lê configuração administrativa e NÃO chama preflight.
 *
 * Em ambos os modos o serviço valida o contrato PERSISTIDO antes de qualquer
 * RPC e delega a abertura à autoridade única. Ele não reserva crédito, não
 * gera identidade financeira e não faz I/O de banco: o cliente é injetado.
 *
 * Identidade: `operationId` é a identidade de CONTROLE e a identidade
 * financeira do vertical; `squareDeliveryId` é a identidade financeira do
 * quadrado. As duas nunca se cruzam. O `squareDeliveryId` vem do chamador e
 * deve ser estável por operação (reutilizado em replay/reload).
 */

import {
  isNineSixteenConfigVersionId,
  isNineSixteenExpansionModel,
} from "@/lib/ai/nine-sixteen-expansion-model-config";
import { isEligibleImageQuality } from "@/lib/ai/image-model-pair";

import { classifyTwoFormatCampaign } from "../contracts";
import type {
  TwoFormatCreditStatus,
  TwoFormatDeliveryErrorCode,
  TwoFormatDeliveryStep,
  TwoFormatFrozenSelection,
  TwoFormatOpenInput,
  TwoFormatOpenReason,
  TwoFormatOpenResult,
  TwoFormatSelectionInput,
} from "../joint-financial-client";

interface JointOpenIdentity {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly squareDeliveryId: string;
  /** Snapshot PERSISTIDO da campanha; nunca um snapshot do cliente. */
  readonly inputSnapshot: unknown;
}

export type JointOpenInput =
  | (JointOpenIdentity & {
      readonly mode: "new";
      /** Seleção aprovada pelo preflight administrativo. */
      readonly selection: TwoFormatSelectionInput;
    })
  | (JointOpenIdentity & {
      readonly mode: "replay";
      /** Seleção congelada lida da operação persistida. */
      readonly frozenSelection: TwoFormatSelectionInput;
    });

export type JointOpenOutcome =
  | {
      readonly kind: "opened";
      readonly idempotent: boolean;
      readonly squareDeliveryId: string;
      readonly verticalDeliveryOperationId: string;
      readonly frozenSelection: TwoFormatFrozenSelection;
      readonly steps: readonly TwoFormatDeliveryStep[];
      readonly creditStatus: TwoFormatCreditStatus;
      readonly squareCreditStatus: TwoFormatCreditStatus;
    }
  | { readonly kind: "business"; readonly reason: TwoFormatOpenReason }
  | { readonly kind: "contract_invalid"; readonly reason: string }
  | { readonly kind: "failed"; readonly code: TwoFormatDeliveryErrorCode };

export interface JointOpenDeps {
  readonly openJointDelivery: (
    input: TwoFormatOpenInput,
  ) => Promise<TwoFormatOpenResult>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Reconhece o erro tipado do cliente sem importar o módulo de servidor em
 * runtime. O código é preservado como veio da autoridade.
 */
function deliveryErrorCode(
  error: unknown,
): TwoFormatDeliveryErrorCode | null {
  if (!(error instanceof Error) || error.name !== "TwoFormatDeliveryError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as TwoFormatDeliveryErrorCode) : null;
}

/**
 * Reutiliza os predicados vigentes de modelo/qualidade/versão. Não há lista
 * própria de elegibilidade; o cliente continua sendo a última barreira.
 */
function asSelection(value: unknown): TwoFormatSelectionInput | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const model = record.model;
  const quality = record.quality;
  const configVersionId = record.configVersionId;
  if (typeof model !== "string" || !isNineSixteenExpansionModel(model)) {
    return null;
  }
  if (typeof quality !== "string" || !isEligibleImageQuality(quality)) {
    return null;
  }
  if (!isNineSixteenConfigVersionId(configVersionId)) return null;
  return Object.freeze({ model, quality, configVersionId });
}

/**
 * Valida o snapshot persistido e abre a operação conjunta pela autoridade
 * única. Nunca lança: falhas viram `failed`/`contract_invalid`/`business`.
 */
export async function openJointOperation(
  input: JointOpenInput,
  deps: JointOpenDeps,
): Promise<JointOpenOutcome> {
  if (
    !isUuid(input.storeId) ||
    !isUuid(input.campaignId) ||
    !isUuid(input.operationId) ||
    !isUuid(input.squareDeliveryId)
  ) {
    return { kind: "failed", code: "identity_mismatch" };
  }

  if (input.squareDeliveryId === input.operationId) {
    return { kind: "failed", code: "delivery_identity_conflict" };
  }

  const rawSelection =
    input.mode === "new" ? input.selection : input.frozenSelection;
  const selection = asSelection(rawSelection);
  if (selection === null) {
    return { kind: "failed", code: "operation_config_conflict" };
  }

  const classification = classifyTwoFormatCampaign(input.inputSnapshot);
  if (classification.kind === "not_two_format") {
    return { kind: "contract_invalid", reason: "not_two_format" };
  }
  if (classification.kind === "inconsistent") {
    return { kind: "contract_invalid", reason: classification.reason };
  }

  let result: TwoFormatOpenResult;
  try {
    result = await deps.openJointDelivery({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      squareDeliveryId: input.squareDeliveryId,
      selection,
    });
  } catch (error) {
    const code = deliveryErrorCode(error);
    return { kind: "failed", code: code ?? "unknown" };
  }

  if (!result.success) {
    return { kind: "business", reason: result.reason };
  }

  return Object.freeze({
    kind: "opened" as const,
    idempotent: result.idempotent,
    squareDeliveryId: result.squareDeliveryId,
    verticalDeliveryOperationId: result.verticalDeliveryOperationId,
    frozenSelection: result.frozenSelection,
    steps: result.steps,
    creditStatus: result.creditStatus,
    squareCreditStatus: result.squareCreditStatus,
  });
}
