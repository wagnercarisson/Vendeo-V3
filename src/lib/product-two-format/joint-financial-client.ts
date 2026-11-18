import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isEligibleImageQuality } from "@/lib/ai/image-model-pair";
import {
  isNineSixteenConfigVersionId,
  isNineSixteenExpansionModel,
} from "@/lib/ai/nine-sixteen-expansion-model-config";
import { supabaseAdmin } from "@/lib/supabase/server";

import {
  TWO_FORMAT_CONTRACT_VERSION,
  type TwoFormatArtifactRole,
  type TwoFormatFormat,
} from "./types";

/**
 * Cliente server-only das quatro RPCs conjuntas (F60.7 / Subfatia A).
 *
 * ORDEM DE PUBLICAÇÃO (vinculante, verificada por teste contratual):
 *   1. o artefato canônico já está persistido e verificado no bucket interno;
 *   2. o chamador adquire o token de publicação com `beginPublication` na
 *      identidade correta (a identidade financeira do formato entregue);
 *   3. este cliente invoca a RPC de entrega por formato, que na MESMA transação
 *      transita o estado financeiro e reprojeta a campanha.
 *
 * O cliente NUNCA faz upload, NUNCA copia bytes, NUNCA cria segunda arte e
 * NUNCA confirma a operação financeira por conta própria: a transição de estado
 * financeiro acontece dentro da RPC conjunta. Sem token não há chamada.
 *
 * Envelopes são lidos como união fechada: sucesso exige as chaves e identidades
 * exatas, versão de contrato exata, status conhecidos e flags booleanas. Falha
 * de vínculo/finalidade levantada no banco é exceção — ela NUNCA é aceita como
 * rejeição de negócio (`success: false`): vira `invalid_envelope`.
 *
 * Este módulo não lê configuração/catálogo vigentes: na abertura ele apenas
 * compara a seleção congelada devolvida com a seleção solicitada.
 */

/** Códigos estáveis de falha do contrato conjunto (rejeição e exceção). */
export type TwoFormatDeliveryErrorCode =
  | "invalid_envelope"
  | "identity_mismatch"
  | "missing_publication_token"
  | "unsupported_format"
  | "delivery_identity_conflict"
  | "joint_contract_required"
  | "operation_origin_conflict"
  | "operation_config_conflict"
  | "operation_identity_conflict"
  | "campaign_store_mismatch"
  | "delivery_link_missing"
  | "delivery_link_incomplete"
  | "credit_operation_missing"
  | "artifact_incompatible"
  | "artifact_present"
  | "insufficient_evidence"
  | "evidence_stale"
  | "absent_not_confirmed"
  | "operation_terminal"
  | "delivered_not_refundable"
  | "invalid_transition"
  | "campaign_not_found"
  | "operation_not_found"
  | "publication_not_owner"
  | "publication_in_progress"
  | "finality_not_recorded"
  | "operation_in_progress"
  | "credit_reservation_failed"
  | "square_credit_reservation_failed"
  | "delivery_links_inconsistent"
  | "shared_operation_not_final"
  | "unknown";

/** Erro tipado do contrato conjunto, com código estável e detalhe seguro. */
export class TwoFormatDeliveryError extends Error {
  readonly code: TwoFormatDeliveryErrorCode;
  readonly detail: string | null;

  constructor(code: TwoFormatDeliveryErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "TwoFormatDeliveryError";
    this.code = code;
    this.detail = detail ?? null;
  }
}

/**
 * Motivos devolvidos como rejeição de negócio (`success: false`). Qualquer
 * outro motivo é tratado como envelope inválido: em especial as falhas que o
 * SQL levanta como exceção nunca são aceitas aqui.
 */
const RETURNED_REASONS = [
  "joint_contract_required",
  "operation_config_conflict",
  "operation_identity_conflict",
  "campaign_store_mismatch",
  "delivery_link_missing",
  "delivery_link_incomplete",
  "credit_operation_missing",
  "artifact_incompatible",
  "artifact_present",
  "insufficient_evidence",
  "evidence_stale",
  "absent_not_confirmed",
  "operation_terminal",
  "delivered_not_refundable",
  "invalid_transition",
  "campaign_not_found",
  "unsupported_format",
] as const;

export type TwoFormatBusinessReason = (typeof RETURNED_REASONS)[number];

/** Códigos mapeados a partir de mensagens de erro do PostgREST. */
const ERROR_CODES: readonly TwoFormatDeliveryErrorCode[] = [
  "invalid_envelope",
  "identity_mismatch",
  "missing_publication_token",
  "unsupported_format",
  "delivery_identity_conflict",
  "joint_contract_required",
  "operation_origin_conflict",
  "operation_config_conflict",
  "operation_identity_conflict",
  "campaign_store_mismatch",
  "delivery_link_missing",
  "delivery_link_incomplete",
  "credit_operation_missing",
  "artifact_incompatible",
  "artifact_present",
  "insufficient_evidence",
  "evidence_stale",
  "absent_not_confirmed",
  "operation_terminal",
  "delivered_not_refundable",
  "invalid_transition",
  "campaign_not_found",
  "publication_not_owner",
  "publication_in_progress",
  "finality_not_recorded",
  "operation_in_progress",
  "credit_reservation_failed",
  "square_credit_reservation_failed",
  "delivery_links_inconsistent",
  "shared_operation_not_final",
  "operation_not_found",
];

/**
 * Códigos ordenados do mais longo para o mais curto: sem isso,
 * `square_credit_reservation_failed` seria lido como
 * `credit_reservation_failed` (substring) e o código estável seria perdido.
 */
const ERROR_CODES_BY_SPECIFICITY = [...ERROR_CODES].sort(
  (left, right) => right.length - left.length,
);

const CREDIT_STATUSES = ["reserved", "art_uploaded", "delivered", "refunded"] as const;

export type TwoFormatCreditStatus = (typeof CREDIT_STATUSES)[number];

const DELIVERY_STAGES = ["base", "expansion"] as const;
export type TwoFormatDeliveryStage = (typeof DELIVERY_STAGES)[number];

const DELIVERY_STEP_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "failed",
  "abandoned",
] as const;
export type TwoFormatDeliveryStepStatus = (typeof DELIVERY_STEP_STATUSES)[number];

const FAILURE_CLASSES = ["transient", "definitive", "unknown"] as const;
export type TwoFormatFailureClass = (typeof FAILURE_CLASSES)[number];

export interface TwoFormatDeliveryStep {
  readonly stage: TwoFormatDeliveryStage;
  readonly status: TwoFormatDeliveryStepStatus;
  readonly attemptsUsed: number;
  readonly failureClass: TwoFormatFailureClass | null;
}

/** Seleção de expansão congelada na operação (nunca lida do catálogo atual). */
export interface TwoFormatFrozenSelection {
  readonly model: string;
  readonly quality: string;
  readonly configVersionId: string;
  readonly origin: "configured";
}

export interface TwoFormatSelectionInput {
  readonly model: string;
  readonly quality: string;
  readonly configVersionId: string;
}

export interface TwoFormatOpenInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly squareDeliveryId: string;
  readonly selection: TwoFormatSelectionInput;
}

export interface TwoFormatDeliverInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly format: TwoFormatFormat;
  /** Token adquirido pelo chamador ANTES desta chamada. Obrigatório. */
  readonly publicationToken: string | null;
}

export interface TwoFormatRefundInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly format: TwoFormatFormat;
  /** Indeterminação nunca é convertida em ausência: apenas `absent`. */
  readonly artKind: "absent";
  /** Frescor observado ANTES da sonda de ausência. */
  readonly observedEpoch: number;
  readonly reason: string;
}

export type TwoFormatOpenResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly campaignId: string;
      readonly operationId: string;
      readonly squareDeliveryId: string;
      readonly verticalDeliveryOperationId: string;
      readonly contractVersion: typeof TWO_FORMAT_CONTRACT_VERSION;
      readonly frozenSelection: TwoFormatFrozenSelection;
      readonly creditStatus: TwoFormatCreditStatus;
      readonly squareCreditStatus: TwoFormatCreditStatus;
      readonly steps: readonly TwoFormatDeliveryStep[];
    }
  | { readonly success: false; readonly reason: TwoFormatBusinessReason };

export type TwoFormatDeliverResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly campaignId: string;
      readonly operationId: string;
      readonly format: TwoFormatFormat;
      readonly deliveryOperationId: string;
      readonly artifactRole: TwoFormatArtifactRole;
      readonly creditStatus: "delivered";
      readonly campaignStatus: string;
      readonly storagePath: string | null;
      readonly preferredFormat: TwoFormatFormat | null;
      readonly projected: boolean;
      readonly alreadyProjected: boolean;
    }
  | { readonly success: false; readonly reason: TwoFormatBusinessReason };

export type TwoFormatRefundResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly campaignId: string;
      readonly operationId: string;
      readonly format: TwoFormatFormat;
      readonly deliveryOperationId: string;
      readonly artifactRole: TwoFormatArtifactRole;
      readonly creditStatus: "refunded";
      readonly campaignStatus: string;
      readonly storagePath: string | null;
      readonly preferredFormat: TwoFormatFormat | null;
      readonly projected: boolean;
      readonly alreadyProjected: boolean;
    }
  | { readonly success: false; readonly reason: TwoFormatBusinessReason };

export type TwoFormatProjectResult =
  | {
      readonly success: true;
      readonly campaignId: string;
      readonly projected: boolean;
      readonly alreadyProjected: boolean;
      readonly campaignStatus: string;
      readonly storagePath: string | null;
      readonly preferredFormat: TwoFormatFormat | null;
    }
  | { readonly success: false; readonly reason: TwoFormatBusinessReason };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_BY_FORMAT: Readonly<Record<TwoFormatFormat, TwoFormatArtifactRole>> = Object.freeze({
  "1:1": "square_original",
  "9:16": "vertical",
});

function invalidEnvelope(detail: string): TwoFormatDeliveryError {
  return new TwoFormatDeliveryError("invalid_envelope", detail);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isFormat(value: unknown): value is TwoFormatFormat {
  return value === "1:1" || value === "9:16";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalidEnvelope("empty_rpc_response");
  }
  return value as Record<string, unknown>;
}

function closedReason(record: Record<string, unknown>): TwoFormatBusinessReason {
  const reason = record.reason;
  if (
    typeof reason !== "string" ||
    !(RETURNED_REASONS as readonly string[]).includes(reason)
  ) {
    throw invalidEnvelope("invalid_business_reason");
  }
  return reason as TwoFormatBusinessReason;
}

function booleanField(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw invalidEnvelope(`invalid_${key}`);
  return value;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidEnvelope(`invalid_${key}`);
  }
  return value;
}

function nullableStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw invalidEnvelope(`invalid_${key}`);
  return value;
}

function creditStatusOf(value: unknown): TwoFormatCreditStatus {
  if (
    typeof value !== "string" ||
    !(CREDIT_STATUSES as readonly string[]).includes(value)
  ) {
    throw invalidEnvelope("invalid_credit_status");
  }
  return value as TwoFormatCreditStatus;
}

function formatField(value: unknown): TwoFormatFormat {
  if (!isFormat(value)) {
    throw new TwoFormatDeliveryError("unsupported_format", "unsupported_format");
  }
  return value;
}

function preferredFormatOf(value: unknown): TwoFormatFormat | null {
  if (value === null || value === undefined) return null;
  if (!isFormat(value)) throw invalidEnvelope("invalid_preferred_format");
  return value;
}

function stepsOf(value: unknown): readonly TwoFormatDeliveryStep[] {
  if (!Array.isArray(value)) throw invalidEnvelope("invalid_steps");
  return Object.freeze(
    value.map((entry) => {
      const record = asRecord(entry);
      const stage = record.stage;
      if (
        typeof stage !== "string" ||
        !(DELIVERY_STAGES as readonly string[]).includes(stage)
      ) {
        throw invalidEnvelope("invalid_step_stage");
      }
      const status = record.status;
      if (
        typeof status !== "string" ||
        !(DELIVERY_STEP_STATUSES as readonly string[]).includes(status)
      ) {
        throw invalidEnvelope("invalid_step_status");
      }
      const attemptsUsed = record.attempts_used;
      if (
        typeof attemptsUsed !== "number" ||
        !Number.isInteger(attemptsUsed) ||
        attemptsUsed < 0
      ) {
        throw invalidEnvelope("invalid_attempts_used");
      }
      const rawFailure = record.failure_class;
      let failureClass: TwoFormatFailureClass | null = null;
      if (rawFailure !== null && rawFailure !== undefined) {
        if (
          typeof rawFailure !== "string" ||
          !(FAILURE_CLASSES as readonly string[]).includes(rawFailure)
        ) {
          throw invalidEnvelope("invalid_failure_class");
        }
        failureClass = rawFailure as TwoFormatFailureClass;
      }
      return Object.freeze({
        stage: stage as TwoFormatDeliveryStage,
        status: status as TwoFormatDeliveryStepStatus,
        attemptsUsed,
        failureClass,
      });
    }),
  );
}

function frozenSelectionOf(record: Record<string, unknown>): TwoFormatFrozenSelection {
  const model = record.expansion_model;
  if (typeof model !== "string" || !isNineSixteenExpansionModel(model)) {
    throw invalidEnvelope("invalid_expansion_model");
  }
  const quality = record.expansion_quality;
  if (typeof quality !== "string" || !isEligibleImageQuality(quality)) {
    throw invalidEnvelope("invalid_expansion_quality");
  }
  const configVersionId = record.expansion_config_version_id;
  if (!isNineSixteenConfigVersionId(configVersionId)) {
    throw invalidEnvelope("invalid_expansion_config_version_id");
  }
  if (record.expansion_selection_origin !== "configured") {
    throw invalidEnvelope("invalid_expansion_selection_origin");
  }
  return Object.freeze({
    model,
    quality,
    configVersionId,
    origin: "configured" as const,
  });
}

function assertSelectionMatches(
  frozen: TwoFormatFrozenSelection,
  requested: TwoFormatSelectionInput,
): void {
  if (
    frozen.model !== requested.model ||
    frozen.quality !== requested.quality ||
    frozen.configVersionId !== requested.configVersionId
  ) {
    throw new TwoFormatDeliveryError(
      "operation_config_conflict",
      "frozen_selection_divergent",
    );
  }
}

function assertOpenInput(input: TwoFormatOpenInput): void {
  if (
    !isUuid(input.storeId) ||
    !isUuid(input.campaignId) ||
    !isUuid(input.operationId) ||
    !isUuid(input.squareDeliveryId)
  ) {
    throw new TwoFormatDeliveryError("identity_mismatch", "invalid_identifier");
  }
  if (input.squareDeliveryId === input.operationId) {
    throw new TwoFormatDeliveryError(
      "delivery_identity_conflict",
      "square_delivery_must_differ_from_control_identity",
    );
  }
  if (!isNineSixteenExpansionModel(input.selection.model)) {
    throw new TwoFormatDeliveryError(
      "operation_config_conflict",
      "invalid_expansion_model",
    );
  }
  if (!isEligibleImageQuality(input.selection.quality)) {
    throw new TwoFormatDeliveryError(
      "operation_config_conflict",
      "invalid_expansion_quality",
    );
  }
  if (!isNineSixteenConfigVersionId(input.selection.configVersionId)) {
    throw new TwoFormatDeliveryError(
      "operation_config_conflict",
      "invalid_expansion_config_version_id",
    );
  }
}

function assertPublicationToken(token: string | null): string {
  if (typeof token !== "string" || token.trim() === "") {
    throw new TwoFormatDeliveryError(
      "missing_publication_token",
      "publication_token_required",
    );
  }
  return token;
}

function parseOpenResult(data: unknown, input: TwoFormatOpenInput): TwoFormatOpenResult {
  const record = asRecord(data);
  if (record.success === false) return { success: false, reason: closedReason(record) };
  if (record.success !== true) throw invalidEnvelope("incomplete_open_envelope");

  if (record.contract_version !== TWO_FORMAT_CONTRACT_VERSION) {
    throw invalidEnvelope("invalid_contract_version");
  }
  if (
    record.campaign_id !== input.campaignId ||
    record.operation_id !== input.operationId ||
    record.square_delivery_id !== input.squareDeliveryId
  ) {
    throw invalidEnvelope("open_identity_mismatch");
  }
  if (record.vertical_delivery_operation_id !== input.operationId) {
    throw invalidEnvelope("vertical_identity_mismatch");
  }

  const idempotent = booleanField(record, "idempotent");
  const frozenSelection = frozenSelectionOf(record);
  assertSelectionMatches(frozenSelection, input.selection);
  const creditStatus = creditStatusOf(record.status);
  const squareCreditStatus = creditStatusOf(record.square_status);
  const steps = stepsOf(record.steps);

  return Object.freeze({
    success: true as const,
    idempotent,
    campaignId: input.campaignId,
    operationId: input.operationId,
    squareDeliveryId: input.squareDeliveryId,
    verticalDeliveryOperationId: input.operationId,
    contractVersion: TWO_FORMAT_CONTRACT_VERSION,
    frozenSelection,
    creditStatus,
    squareCreditStatus,
    steps,
  });
}

function parseFormatDeliveryResult(
  data: unknown,
  input: TwoFormatDeliverInput,
): TwoFormatDeliverResult {
  const record = asRecord(data);
  if (record.success === false) return { success: false, reason: closedReason(record) };
  if (record.success !== true) throw invalidEnvelope("incomplete_deliver_envelope");

  if (
    record.campaign_id !== input.campaignId ||
    record.operation_id !== input.operationId ||
    record.format !== input.format
  ) {
    throw invalidEnvelope("deliver_identity_mismatch");
  }

  const deliveryOperationId = stringField(record, "delivery_operation_id");
  const expectedRole = ROLE_BY_FORMAT[input.format];
  if (record.artifact_role !== expectedRole) {
    throw invalidEnvelope("artifact_role_mismatch");
  }
  const usesControlIdentity = deliveryOperationId === input.operationId;
  if (input.format === "9:16" && !usesControlIdentity) {
    throw invalidEnvelope("vertical_delivery_identity_mismatch");
  }
  if (input.format === "1:1" && usesControlIdentity) {
    throw invalidEnvelope("square_delivery_identity_mismatch");
  }

  const creditStatus = creditStatusOf(record.credit_status);
  if (creditStatus !== "delivered") {
    throw invalidEnvelope("non_delivered_credit_on_success");
  }

  const idempotent = booleanField(record, "idempotent");
  const campaignStatus = stringField(record, "campaign_status");
  const storagePath = nullableStringField(record, "storage_path");
  const preferredFormat = preferredFormatOf(record.preferred_format);
  const projected = booleanField(record, "projected");
  const alreadyProjected = booleanField(record, "already_projected");

  return Object.freeze({
    success: true as const,
    idempotent,
    campaignId: input.campaignId,
    operationId: input.operationId,
    format: input.format,
    deliveryOperationId,
    artifactRole: expectedRole,
    creditStatus: "delivered" as const,
    campaignStatus,
    storagePath,
    preferredFormat,
    projected,
    alreadyProjected,
  });
}

function parseRefundResult(
  data: unknown,
  input: TwoFormatRefundInput,
): TwoFormatRefundResult {
  const record = asRecord(data);
  if (record.success === false) return { success: false, reason: closedReason(record) };
  if (record.success !== true) throw invalidEnvelope("incomplete_refund_envelope");

  if (
    record.campaign_id !== input.campaignId ||
    record.operation_id !== input.operationId ||
    record.format !== input.format
  ) {
    throw invalidEnvelope("refund_identity_mismatch");
  }

  const deliveryOperationId = stringField(record, "delivery_operation_id");
  const expectedRole = ROLE_BY_FORMAT[input.format];
  if (record.artifact_role !== expectedRole) {
    throw invalidEnvelope("artifact_role_mismatch");
  }
  const usesControlIdentity = deliveryOperationId === input.operationId;
  if (input.format === "9:16" && !usesControlIdentity) {
    throw invalidEnvelope("vertical_delivery_identity_mismatch");
  }
  if (input.format === "1:1" && usesControlIdentity) {
    throw invalidEnvelope("square_delivery_identity_mismatch");
  }

  const creditStatus = creditStatusOf(record.credit_status);
  if (creditStatus !== "refunded") {
    throw invalidEnvelope("non_refunded_credit_on_success");
  }

  const idempotent = booleanField(record, "idempotent");
  const campaignStatus = stringField(record, "campaign_status");
  const storagePath = nullableStringField(record, "storage_path");
  const preferredFormat = preferredFormatOf(record.preferred_format);
  const projected = booleanField(record, "projected");
  const alreadyProjected = booleanField(record, "already_projected");

  return Object.freeze({
    success: true as const,
    idempotent,
    campaignId: input.campaignId,
    operationId: input.operationId,
    format: input.format,
    deliveryOperationId,
    artifactRole: expectedRole,
    creditStatus: "refunded" as const,
    campaignStatus,
    storagePath,
    preferredFormat,
    projected,
    alreadyProjected,
  });
}

function parseProjectResult(
  data: unknown,
  campaignId: string,
): TwoFormatProjectResult {
  const record = asRecord(data);
  if (record.success === false) return { success: false, reason: closedReason(record) };
  if (record.success !== true) throw invalidEnvelope("incomplete_project_envelope");

  if (record.campaign_id !== campaignId) {
    throw invalidEnvelope("project_identity_mismatch");
  }

  const projected = booleanField(record, "projected");
  const alreadyProjected = booleanField(record, "already_projected");
  const campaignStatus = stringField(record, "campaign_status");
  const storagePath = nullableStringField(record, "storage_path");
  const preferredFormat = preferredFormatOf(record.preferred_format);

  return Object.freeze({
    success: true as const,
    campaignId,
    projected,
    alreadyProjected,
    campaignStatus,
    storagePath,
    preferredFormat,
  });
}

function mapError(message: string | undefined | null): TwoFormatDeliveryError {
  const text = message ?? "";
  for (const code of ERROR_CODES_BY_SPECIFICITY) {
    if (text.includes(code)) return new TwoFormatDeliveryError(code, text || code);
  }
  return new TwoFormatDeliveryError("unknown", text || "unknown_error");
}

export class TwoFormatJointFinancialClient {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  /**
   * Abertura conjunta: valida a seleção localmente e adquire as duas reservas
   * de 1 crédito na mesma transação. Não lê configuração/catálogo.
   */
  async openJointDelivery(input: TwoFormatOpenInput): Promise<TwoFormatOpenResult> {
    assertOpenInput(input);
    const { data, error } = await this.client.rpc("product_two_format_open_delivery", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_square_delivery_id: input.squareDeliveryId,
      p_expansion_model: input.selection.model,
      p_expansion_quality: input.selection.quality,
      p_expansion_config_version_id: input.selection.configVersionId,
    });
    if (error) throw mapError(error.message);
    return parseOpenResult(data, input);
  }

  /**
   * Entrega por formato: exige o token JÁ adquirido pelo chamador e delega à
   * RPC única que transita o estado financeiro e reprojeta a campanha.
   */
  async deliverFormat(input: TwoFormatDeliverInput): Promise<TwoFormatDeliverResult> {
    const format = formatField(input.format);
    const publicationToken = assertPublicationToken(input.publicationToken);
    const { data, error } = await this.client.rpc("product_two_format_deliver_format", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_format: format,
      p_publication_token: publicationToken,
    });
    if (error) throw mapError(error.message);
    return parseFormatDeliveryResult(data, { ...input, format });
  }

  /**
   * Estorno por formato: só com evidência comprovada de ausência e frescor
   * observado ANTES da sonda. O `observedEpoch` vem de
   * `product_1_1_get_publication_epoch` lido pelo chamador ANTES da sonda de
   * ausência; ler depois não provaria frescor.
   */
  async refundFormat(input: TwoFormatRefundInput): Promise<TwoFormatRefundResult> {
    const format = formatField(input.format);
    if (input.artKind !== "absent") {
      throw new TwoFormatDeliveryError("insufficient_evidence", "art_kind_not_absent");
    }
    if (!Number.isInteger(input.observedEpoch) || input.observedEpoch < 0) {
      throw new TwoFormatDeliveryError("insufficient_evidence", "invalid_observed_epoch");
    }
    const { data, error } = await this.client.rpc("product_two_format_refund_format", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_format: format,
      p_art_kind: input.artKind,
      p_observed_epoch: input.observedEpoch,
      p_reason: input.reason,
    });
    if (error) throw mapError(error.message);
    return parseRefundResult(data, { ...input, format });
  }

  /** Reparo idempotente da projeção, sem duplicar entrega nem cobrança. */
  async projectCampaign(input: { readonly campaignId: string }): Promise<TwoFormatProjectResult> {
    const { data, error } = await this.client.rpc("product_two_format_project_campaign", {
      p_campaign_id: input.campaignId,
    });
    if (error) throw mapError(error.message);
    return parseProjectResult(data, input.campaignId);
  }
}
