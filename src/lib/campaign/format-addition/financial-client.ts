import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isEligibleImageQuality } from "@/lib/ai/image-model-pair";
import { isNineSixteenExpansionModel } from "@/lib/ai/nine-sixteen-expansion-model-config";
import { supabaseAdmin } from "@/lib/supabase/server";

import type {
  FrozenEconomics,
  FrozenExpansionSelection,
} from "./frozen-economics";
import { parseFrozenEconomics, toFormatAdditionRpcPayload } from "./frozen-economics";
import type { FormatAdditionSourceOrigin } from "./types";

/**
 * F62/62-03 — Cliente server-only das RPCs da adição de formato.
 *
 * Só aceita identidade segura e o congelado produzido no servidor. Não aceita
 * path, URL, preço, modelo, qualidade ou economia como campos avulsos do
 * chamador: a seleção/economia vêm de `FrozenEconomics` e são validadas antes
 * da RPC. Cada RPC tem allowlist PRÓPRIA de motivos de negócio; motivo de outra
 * RPC, envelope incompleto ou resposta ambígua é `invalid_envelope`. Erro de
 * transporte NUNCA vira sucesso/estorno presumido.
 */

export type FormatAdditionClientErrorCode =
  | "invalid_envelope"
  | "identity_mismatch"
  | "invalid_input"
  | "missing_publication_token"
  | "invalid_publication_token"
  | "transport_error"
  | "unknown"
  | FormatAdditionBusinessReason;

export class FormatAdditionClientError extends Error {
  readonly code: FormatAdditionClientErrorCode;
  readonly detail: string | null;

  constructor(code: FormatAdditionClientErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "FormatAdditionClientError";
    this.code = code;
    this.detail = detail ?? null;
  }
}

const OPEN_REASONS = [
  "source_origin_invalid",
  "source_operation_required",
  "legacy_source_operation_forbidden",
  "source_checksum_invalid",
  "invalid_selection",
  "invalid_selection_origin",
  "invalid_selection_model",
  "invalid_selection_quality",
  "invalid_selection_config_version",
  "invalid_frozen_economics",
  "invalid_frozen_pricing",
  "invalid_frozen_pricing_version",
  "invalid_frozen_economic_values",
  "invalid_frozen_captured_at",
  "campaign_not_found",
  "campaign_not_ready",
  "format_not_square",
  "operation_identity_conflict",
  "source_identity_conflict",
  "source_artifact_missing",
  "source_artifact_invalid",
  "source_path_missing",
  "source_operation_artifact_mismatch",
  "source_path_mismatch",
  "source_provenance_mismatch",
  "primary_operation_missing",
  "primary_operation_not_delivered",
  "operation_open_failed",
  "operation_origin_conflict",
] as const;
export type FormatAdditionOpenReason = (typeof OPEN_REASONS)[number];

const DELIVER_REASONS = [
  "missing_publication_token",
  "campaign_not_found",
  "format_addition_not_found",
  "operation_identity_conflict",
  "vertical_artifact_missing",
  "vertical_artifact_invalid",
  "vertical_provenance_invalid",
  "credit_operation_missing",
  "operation_terminal",
  "delivery_identity_conflict",
  "invalid_transition",
  "stale_publication",
] as const;
export type FormatAdditionDeliverReason = (typeof DELIVER_REASONS)[number];

const REFUND_REASONS = [
  "missing_observed_epoch",
  "missing_reason",
  "campaign_not_found",
  "format_addition_not_found",
  "operation_identity_conflict",
  "delivered_not_refundable",
  "credit_operation_missing",
  "operation_terminal",
  "invalid_transition",
  "evidence_stale",
  "vertical_artifact_present",
  "operation_unknown",
  "finality_not_recorded",
  "operation_in_progress",
  "publication_in_progress",
  "refund_failed",
] as const;
export type FormatAdditionRefundReason = (typeof REFUND_REASONS)[number];

export type FormatAdditionBusinessReason =
  | FormatAdditionOpenReason
  | FormatAdditionDeliverReason
  | FormatAdditionRefundReason;

const KNOWN_ERROR_CODES: readonly string[] = [
  ...OPEN_REASONS,
  ...DELIVER_REASONS,
  ...REFUND_REASONS,
  "invalid_envelope",
  "identity_mismatch",
  "invalid_input",
  "missing_publication_token",
  "invalid_publication_token",
  "transport_error",
  "unknown",
].sort((left, right) => right.length - left.length);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

const SOURCE_ORIGINS = ["new_flow_1_1", "legacy_campaign"] as const;

export interface FormatAdditionOpenInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly sourceOrigin: FormatAdditionSourceOrigin;
  readonly sourceOperationId: string | null;
  readonly sourceRegistrationOperationId: string;
  readonly sourceArtifactId: string;
  readonly sourceChecksumSha256: string;
  readonly frozen: FrozenEconomics;
}

export interface FormatAdditionDeliverInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  /** Token adquirido pelo chamador ANTES desta chamada. */
  readonly publicationToken: string | null;
}

export interface FormatAdditionRefundInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly observedEpoch: number;
  readonly reason: string;
}

export type FormatAdditionLinkState = "open" | "delivered" | "refunded";

export type FormatAdditionOpenResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly state: FormatAdditionLinkState;
      readonly operationId: string;
      readonly sourceOrigin: FormatAdditionSourceOrigin;
      readonly sourceRegistrationOperationId: string;
      readonly squareArtifactId: string;
      readonly requestId: string;
      readonly credits: 1;
      readonly selection: FrozenExpansionSelection;
    }
  | { readonly success: false; readonly reason: FormatAdditionOpenReason };

export type FormatAdditionDeliverResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly state: "delivered";
      readonly operationId: string;
    }
  | { readonly success: false; readonly reason: FormatAdditionDeliverReason };

export type FormatAdditionRefundResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly state: "refunded";
      readonly operationId: string;
    }
  | { readonly success: false; readonly reason: FormatAdditionRefundReason };

function invalidEnvelope(detail: string): FormatAdditionClientError {
  return new FormatAdditionClientError("invalid_envelope", detail);
}

function invalidInput(detail: string): FormatAdditionClientError {
  return new FormatAdditionClientError("invalid_input", detail);
}

function identityMismatch(detail: string): FormatAdditionClientError {
  return new FormatAdditionClientError("identity_mismatch", detail);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalidEnvelope("empty_rpc_response");
  }
  return value as Record<string, unknown>;
}

function booleanField(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw invalidEnvelope(`invalid_${key}`);
  return value;
}

function uuidField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (!isUuid(value)) throw invalidEnvelope(`invalid_${key}`);
  return value;
}

function stateField(
  value: unknown,
  allowed: readonly FormatAdditionLinkState[],
): FormatAdditionLinkState {
  if (
    typeof value !== "string" ||
    !(allowed as readonly string[]).includes(value)
  ) {
    throw invalidEnvelope("invalid_state");
  }
  return value as FormatAdditionLinkState;
}

function closedReason<T extends string>(
  record: Record<string, unknown>,
  allowed: readonly T[],
): T {
  const reason = record.reason;
  if (typeof reason !== "string" || !allowed.includes(reason as T)) {
    throw invalidEnvelope("invalid_business_reason");
  }
  return reason as T;
}

function parseSelectionPayload(value: unknown): FrozenExpansionSelection {
  const record = asRecord(value);
  const model = record.model;
  if (typeof model !== "string" || !isNineSixteenExpansionModel(model)) {
    throw invalidEnvelope("invalid_selection_model");
  }
  const quality = record.quality;
  if (typeof quality !== "string" || !isEligibleImageQuality(quality)) {
    throw invalidEnvelope("invalid_selection_quality");
  }
  if (!isUuid(record.configVersionId)) {
    throw invalidEnvelope("invalid_selection_config_version");
  }
  if (record.selectionOrigin !== "configured") {
    throw invalidEnvelope("invalid_selection_origin");
  }
  return Object.freeze({
    model,
    quality,
    configVersionId: record.configVersionId.toLowerCase(),
    selectionOrigin: "configured" as const,
  });
}

function sameSelection(
  left: FrozenExpansionSelection,
  right: FrozenExpansionSelection,
): boolean {
  return (
    left.model === right.model &&
    left.quality === right.quality &&
    left.configVersionId === right.configVersionId &&
    left.selectionOrigin === right.selectionOrigin
  );
}

function assertOpenInput(input: FormatAdditionOpenInput): FrozenEconomics {
  if (
    !isUuid(input.storeId) ||
    !isUuid(input.campaignId) ||
    !isUuid(input.operationId) ||
    !isUuid(input.requestId) ||
    !isUuid(input.sourceRegistrationOperationId) ||
    !isUuid(input.sourceArtifactId)
  ) {
    throw identityMismatch("invalid_identifier");
  }
  if (!(SOURCE_ORIGINS as readonly string[]).includes(input.sourceOrigin)) {
    throw invalidInput("invalid_source_origin");
  }
  if (input.sourceOrigin === "new_flow_1_1" && !isUuid(input.sourceOperationId)) {
    throw identityMismatch("source_operation_required");
  }
  if (input.sourceOrigin === "legacy_campaign" && input.sourceOperationId !== null) {
    throw invalidInput("legacy_source_operation_forbidden");
  }
  if (!CHECKSUM_PATTERN.test(input.sourceChecksumSha256)) {
    throw invalidInput("invalid_source_checksum");
  }

  const parsed = parseFrozenEconomics(input.frozen.selection, {
    pricingVersionId: input.frozen.pricingVersionId,
    pricing: input.frozen.pricing,
    usdBrlRateAtGeneration: input.frozen.usdBrlRateAtGeneration,
    creditValueBrlAtGeneration: input.frozen.creditValueBrlAtGeneration,
    capturedAt: input.frozen.capturedAt,
  });
  if (!parsed.ok) throw invalidInput(parsed.detail ?? parsed.reason);
  return parsed.frozen;
}

function assertDeliverInput(input: FormatAdditionDeliverInput): string {
  if (
    !isUuid(input.storeId) ||
    !isUuid(input.campaignId) ||
    !isUuid(input.operationId)
  ) {
    throw identityMismatch("invalid_identifier");
  }
  if (typeof input.publicationToken !== "string" || input.publicationToken.trim() === "") {
    throw new FormatAdditionClientError(
      "missing_publication_token",
      "publication_token_required",
    );
  }
  if (!isUuid(input.publicationToken)) {
    throw new FormatAdditionClientError(
      "invalid_publication_token",
      "publication_token_not_uuid",
    );
  }
  return input.publicationToken;
}

function assertRefundInput(input: FormatAdditionRefundInput): void {
  if (
    !isUuid(input.storeId) ||
    !isUuid(input.campaignId) ||
    !isUuid(input.operationId)
  ) {
    throw identityMismatch("invalid_identifier");
  }
  if (!Number.isInteger(input.observedEpoch) || input.observedEpoch < 0) {
    throw invalidInput("invalid_observed_epoch");
  }
  if (typeof input.reason !== "string" || input.reason.trim() === "") {
    throw invalidInput("missing_reason");
  }
}

function parseOpenResult(
  data: unknown,
  input: FormatAdditionOpenInput,
  frozen: FrozenEconomics,
): FormatAdditionOpenResult {
  const record = asRecord(data);
  if (record.success === false) {
    return { success: false, reason: closedReason(record, OPEN_REASONS) };
  }
  if (record.success !== true) throw invalidEnvelope("incomplete_open_envelope");

  const idempotent = booleanField(record, "idempotent");
  const state = stateField(record.state, ["open", "delivered", "refunded"]);
  const operationId = uuidField(record, "operationId");
  const sourceOrigin = record.sourceOrigin;
  if (
    typeof sourceOrigin !== "string" ||
    !(SOURCE_ORIGINS as readonly string[]).includes(sourceOrigin)
  ) {
    throw invalidEnvelope("invalid_source_origin");
  }
  const sourceRegistrationOperationId = uuidField(
    record,
    "sourceRegistrationOperationId",
  );
  const squareArtifactId = uuidField(record, "squareArtifactId");
  const requestId = uuidField(record, "requestId");
  if (record.credits !== 1) throw invalidEnvelope("invalid_credits");
  const selection = parseSelectionPayload(record.selection);

  if (!idempotent) {
    if (state !== "open") throw invalidEnvelope("new_open_not_open");
    if (operationId !== input.operationId) {
      throw invalidEnvelope("open_operation_identity_mismatch");
    }
    if (requestId !== input.requestId) {
      throw invalidEnvelope("open_request_identity_mismatch");
    }
    if (sourceOrigin !== input.sourceOrigin) {
      throw invalidEnvelope("open_source_origin_mismatch");
    }
    if (sourceRegistrationOperationId !== input.sourceRegistrationOperationId) {
      throw invalidEnvelope("open_registration_identity_mismatch");
    }
    if (squareArtifactId !== input.sourceArtifactId) {
      throw invalidEnvelope("open_artifact_identity_mismatch");
    }
    if (!sameSelection(selection, frozen.selection)) {
      throw invalidEnvelope("open_selection_mismatch");
    }
  }

  return Object.freeze({
    success: true as const,
    idempotent,
    state,
    operationId,
    sourceOrigin: sourceOrigin as FormatAdditionSourceOrigin,
    sourceRegistrationOperationId,
    squareArtifactId,
    requestId,
    credits: 1 as const,
    selection,
  });
}

function parseDeliverResult(
  data: unknown,
  operationId: string,
): FormatAdditionDeliverResult {
  const record = asRecord(data);
  if (record.success === false) {
    return { success: false, reason: closedReason(record, DELIVER_REASONS) };
  }
  if (record.success !== true) throw invalidEnvelope("incomplete_deliver_envelope");
  const idempotent = booleanField(record, "idempotent");
  const state = stateField(record.state, ["delivered"]);
  const returnedOperationId = uuidField(record, "operationId");
  if (returnedOperationId !== operationId) {
    throw invalidEnvelope("deliver_operation_identity_mismatch");
  }
  return Object.freeze({
    success: true as const,
    idempotent,
    state: state as "delivered",
    operationId: returnedOperationId,
  });
}

function parseRefundResult(
  data: unknown,
  operationId: string,
): FormatAdditionRefundResult {
  const record = asRecord(data);
  if (record.success === false) {
    return { success: false, reason: closedReason(record, REFUND_REASONS) };
  }
  if (record.success !== true) throw invalidEnvelope("incomplete_refund_envelope");
  const idempotent = booleanField(record, "idempotent");
  const state = stateField(record.state, ["refunded"]);
  const returnedOperationId = uuidField(record, "operationId");
  if (returnedOperationId !== operationId) {
    throw invalidEnvelope("refund_operation_identity_mismatch");
  }
  return Object.freeze({
    success: true as const,
    idempotent,
    state: state as "refunded",
    operationId: returnedOperationId,
  });
}

function mapError(message: string | null | undefined): FormatAdditionClientError {
  const text = message ?? "";
  for (const code of KNOWN_ERROR_CODES) {
    if (text.includes(code)) {
      return new FormatAdditionClientError(
        code as FormatAdditionClientErrorCode,
        text || code,
      );
    }
  }
  return new FormatAdditionClientError("transport_error", text || "transport_error");
}

export class FormatAdditionFinancialClient {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async open(input: FormatAdditionOpenInput): Promise<FormatAdditionOpenResult> {
    const frozen = assertOpenInput(input);
    const payload = toFormatAdditionRpcPayload(frozen);
    const { data, error } = await this.client.rpc("campaign_format_add_open", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_request_id: input.requestId,
      p_source_origin: input.sourceOrigin,
      p_source_operation_id: input.sourceOperationId,
      p_source_registration_operation_id: input.sourceRegistrationOperationId,
      p_source_artifact_id: input.sourceArtifactId,
      p_source_checksum_sha256: input.sourceChecksumSha256,
      p_selection: payload.selection,
      p_frozen_economics: payload.frozenEconomics,
    });
    if (error) throw mapError(error.message);
    return parseOpenResult(data, input, frozen);
  }

  async deliver(
    input: FormatAdditionDeliverInput,
  ): Promise<FormatAdditionDeliverResult> {
    const publicationToken = assertDeliverInput(input);
    const { data, error } = await this.client.rpc("campaign_format_add_deliver", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_publication_token: publicationToken,
    });
    if (error) throw mapError(error.message);
    return parseDeliverResult(data, input.operationId);
  }

  async refund(
    input: FormatAdditionRefundInput,
  ): Promise<FormatAdditionRefundResult> {
    assertRefundInput(input);
    const { data, error } = await this.client.rpc("campaign_format_add_refund", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_observed_epoch: input.observedEpoch,
      p_reason: input.reason.trim(),
    });
    if (error) throw mapError(error.message);
    return parseRefundResult(data, input.operationId);
  }
}

/** Tipos de erro de negócio exportados para allowlists/testes. */
export const FORMAT_ADDITION_OPEN_REASONS = OPEN_REASONS;
export const FORMAT_ADDITION_DELIVER_REASONS = DELIVER_REASONS;
export const FORMAT_ADDITION_REFUND_REASONS = REFUND_REASONS;
