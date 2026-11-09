import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  ProductTwoStageOperationError,
  type AcquireStepRequest,
  type AcquireStepResult,
  type AttemptTarget,
  type FinishStepRequest,
  type FinishStepResult,
  type OpenOperationRequest,
  type OpenOperationResult,
  type RecordOutcomeRequest,
  type RecordOutcomeResult,
  type ResumeAction,
  type ResumeOperationRequest,
  type ResumeOperationResult,
  type StepState,
  type TwoStageReason,
  type TwoStageStage,
  type TwoStageStepStatus,
} from "./types";

const KNOWN_REASONS: readonly TwoStageReason[] = [
  "operation_terminal",
  "operation_unknown",
  "operation_in_progress",
  "attempt_limit_reached",
  "invalid_transition",
  "invalid_target",
  "operation_identity_conflict",
  "operation_origin_conflict",
  "operation_not_reserved",
  "operation_not_found",
];

const STAGES: readonly TwoStageStage[] = ["base", "expansion"];
const STEP_STATUSES: readonly TwoStageStepStatus[] = [
  "pending",
  "in_progress",
  "done",
  "failed",
  "abandoned",
];
const TARGETS: readonly AttemptTarget[] = ["primary", "fallback", "initial", "retry"];
const RESUME_ACTIONS: readonly ResumeAction[] = [
  "acquire_base",
  "acquire_expansion",
  "retry_base",
  "retry_expansion",
  "deliver",
  "wait",
  "blocked",
];

function mapError(message: string | undefined | null): ProductTwoStageOperationError {
  const text = message ?? "";
  for (const reason of KNOWN_REASONS) {
    if (text.includes(reason)) {
      return new ProductTwoStageOperationError(reason, text);
    }
  }
  return new ProductTwoStageOperationError("unknown", text || "unknown_error");
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ProductTwoStageOperationError("invalid_envelope", "empty_rpc_response");
  }
  return data as Record<string, unknown>;
}

function reasonOf(record: Record<string, unknown>): TwoStageReason {
  const reason = record.reason;
  if (typeof reason !== "string" || !KNOWN_REASONS.includes(reason as TwoStageReason)) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_reason");
  }
  return reason as TwoStageReason;
}

function stageOf(value: unknown): TwoStageStage {
  if (typeof value !== "string" || !STAGES.includes(value as TwoStageStage)) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_stage");
  }
  return value as TwoStageStage;
}

function targetOf(value: unknown): AttemptTarget {
  if (typeof value !== "string" || !TARGETS.includes(value as AttemptTarget)) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_target");
  }
  return value as AttemptTarget;
}

function stepOf(value: unknown): StepState {
  const record = asRecord(value);
  const stage = stageOf(record.stage);
  const status = record.status;
  if (typeof status !== "string" || !STEP_STATUSES.includes(status as TwoStageStepStatus)) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_step_status");
  }
  const attemptsUsed = record.attempts_used;
  if (typeof attemptsUsed !== "number" || !Number.isInteger(attemptsUsed) || attemptsUsed < 0) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_attempts_used");
  }
  const rawFailure = record.failure_class;
  const failureClass =
    rawFailure === null || rawFailure === undefined
      ? null
      : rawFailure === "transient" || rawFailure === "definitive" || rawFailure === "unknown"
        ? rawFailure
        : (() => {
            throw new ProductTwoStageOperationError("invalid_envelope", "invalid_failure_class");
          })();
  return Object.freeze({
    stage,
    status: status as TwoStageStepStatus,
    attemptsUsed,
    failureClass,
  });
}

export function parseOpenOperation(
  data: unknown,
  input: OpenOperationRequest,
): OpenOperationResult {
  const record = asRecord(data);
  if (record.success === false) return { success: false, reason: reasonOf(record) };
  if (record.success !== true) {
    throw new ProductTwoStageOperationError("invalid_envelope", "incomplete_open_envelope");
  }
  if (typeof record.idempotent !== "boolean") {
    throw new ProductTwoStageOperationError("invalid_envelope", "missing_idempotent");
  }
  if (record.campaign_id !== input.campaignId || record.operation_id !== input.operationId) {
    throw new ProductTwoStageOperationError("invalid_envelope", "open_identity_mismatch");
  }
  if (record.origin !== "9_16_two_stage") {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_origin");
  }
  if (typeof record.status !== "string" || record.status.trim() === "") {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_open_status");
  }
  if (!Array.isArray(record.steps) || record.steps.length !== 2) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_steps");
  }
  const steps = record.steps.map(stepOf);
  const stages = new Set(steps.map((step) => step.stage));
  if (stages.size !== 2 || !stages.has("base") || !stages.has("expansion")) {
    throw new ProductTwoStageOperationError("invalid_envelope", "duplicate_or_missing_step");
  }
  return Object.freeze({
    success: true,
    idempotent: record.idempotent,
    status: record.status,
    campaignId: input.campaignId,
    operationId: input.operationId,
    origin: "9_16_two_stage",
    steps: Object.freeze(steps),
  });
}

export function parseAcquireStep(
  data: unknown,
  input: AcquireStepRequest,
): AcquireStepResult {
  const record = asRecord(data);
  if (typeof record.acquired !== "boolean") {
    throw new ProductTwoStageOperationError("invalid_envelope", "missing_acquired");
  }
  if (record.acquired) {
    if (record.authorization !== "execute" || record.reason !== null) {
      throw new ProductTwoStageOperationError("invalid_envelope", "invalid_acquire_success");
    }
    const attemptToken = record.attempt_token;
    const attemptNumber = record.attempt_number;
    if (
      typeof attemptToken !== "string" ||
      attemptToken.trim() === "" ||
      typeof attemptNumber !== "number" ||
      !Number.isInteger(attemptNumber) ||
      attemptNumber < 1
    ) {
      throw new ProductTwoStageOperationError("invalid_envelope", "missing_attempt");
    }
    if (stageOf(record.stage) !== input.stage || targetOf(record.target) !== input.target) {
      throw new ProductTwoStageOperationError("invalid_envelope", "acquire_target_mismatch");
    }
    return Object.freeze({
      acquired: true,
      authorization: "execute",
      reason: null,
      attemptToken,
      attemptNumber,
      stage: input.stage,
      target: input.target,
    });
  }

  if (record.authorization !== "query_only") {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_query_only");
  }
  const reason = record.reason === null ? null : reasonOf(record);
  if (reason === null) {
    const attemptToken = record.attempt_token;
    const attemptNumber = record.attempt_number;
    if (
      typeof attemptToken !== "string" ||
      attemptToken.trim() === "" ||
      typeof attemptNumber !== "number" ||
      !Number.isInteger(attemptNumber) ||
      attemptNumber < 1 ||
      stageOf(record.stage) !== input.stage ||
      targetOf(record.target) !== input.target
    ) {
      throw new ProductTwoStageOperationError("invalid_envelope", "incomplete_replay");
    }
    return Object.freeze({
      acquired: false,
      authorization: "query_only",
      reason: null,
      attemptToken,
      attemptNumber,
      stage: input.stage,
      target: input.target,
    });
  }
  return Object.freeze({
    acquired: false,
    authorization: "query_only",
    reason,
  });
}

export function parseFinishStep(
  data: unknown,
  input: FinishStepRequest,
): FinishStepResult {
  const record = asRecord(data);
  if (record.success === false) return { success: false, reason: reasonOf(record) };
  if (record.success !== true || typeof record.idempotent !== "boolean") {
    throw new ProductTwoStageOperationError("invalid_envelope", "incomplete_finish_envelope");
  }
  const status = record.status;
  if (
    status !== "completed" &&
    status !== "failed" &&
    status !== "abandoned"
  ) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_finish_status");
  }
  if (status !== input.status) {
    throw new ProductTwoStageOperationError("invalid_envelope", "finish_status_mismatch");
  }
  const stage = stageOf(record.stage);
  const attemptNumber = record.attempt_number;
  if (typeof attemptNumber !== "number" || !Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_attempt_number");
  }
  return Object.freeze({
    success: true,
    idempotent: record.idempotent,
    status,
    stage,
    attemptNumber,
  });
}

export function parseRecordOutcome(
  data: unknown,
  input: RecordOutcomeRequest,
): RecordOutcomeResult {
  const record = asRecord(data);
  if (record.success === false) return { success: false, reason: reasonOf(record) };
  if (record.success !== true || typeof record.idempotent !== "boolean") {
    throw new ProductTwoStageOperationError("invalid_envelope", "incomplete_outcome_envelope");
  }
  if (record.outcome !== input.outcome || stageOf(record.stage) !== input.stage) {
    throw new ProductTwoStageOperationError("invalid_envelope", "outcome_mismatch");
  }
  if (!Object.prototype.hasOwnProperty.call(record, "support_reference")) {
    throw new ProductTwoStageOperationError("invalid_envelope", "missing_support_reference");
  }
  const supportReference = record.support_reference;
  if (supportReference !== null && supportReference !== undefined && typeof supportReference !== "string") {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_support_reference");
  }
  return Object.freeze({
    success: true,
    idempotent: record.idempotent,
    outcome: input.outcome,
    stage: input.stage,
    supportReference: (supportReference as string | null | undefined) ?? null,
  });
}

export function parseResumeOperation(data: unknown): ResumeOperationResult {
  const record = asRecord(data);
  if (record.success === false) {
    const reason = record.reason;
    if (reason === "operation_not_found") return { success: false, reason };
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_resume_reason");
  }
  if (record.success !== true) {
    throw new ProductTwoStageOperationError("invalid_envelope", "incomplete_resume_envelope");
  }
  if (record.origin !== "9_16_two_stage") {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_resume_origin");
  }
  if (typeof record.credit_status !== "string" || record.credit_status.trim() === "") {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_credit_status");
  }
  if (typeof record.unknown !== "boolean" || typeof record.failed_outcome !== "boolean") {
    throw new ProductTwoStageOperationError("invalid_envelope", "missing_resume_flags");
  }
  if (!Object.prototype.hasOwnProperty.call(record, "next_target")) {
    throw new ProductTwoStageOperationError("invalid_envelope", "missing_next_target");
  }
  const action = record.action;
  if (typeof action !== "string" || !RESUME_ACTIONS.includes(action as ResumeAction)) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_resume_action");
  }
  const nextTarget =
    record.next_target === null || record.next_target === undefined
      ? null
      : targetOf(record.next_target);
  const requiresTarget =
    action.startsWith("acquire_") || action.startsWith("retry_");
  if (requiresTarget && nextTarget === null) {
    throw new ProductTwoStageOperationError("invalid_envelope", "missing_next_target");
  }
  if (!requiresTarget && nextTarget !== null) {
    throw new ProductTwoStageOperationError("invalid_envelope", "unexpected_next_target");
  }
  const baseAttempts = record.base_attempts;
  const expansionAttempts = record.expansion_attempts;
  if (
    typeof baseAttempts !== "number" ||
    !Number.isInteger(baseAttempts) ||
    baseAttempts < 0 ||
    typeof expansionAttempts !== "number" ||
    !Number.isInteger(expansionAttempts) ||
    expansionAttempts < 0
  ) {
    throw new ProductTwoStageOperationError("invalid_envelope", "invalid_attempts");
  }
  const statusOf = (value: unknown, field: string): TwoStageStepStatus => {
    if (typeof value !== "string" || !STEP_STATUSES.includes(value as TwoStageStepStatus)) {
      throw new ProductTwoStageOperationError("invalid_envelope", field);
    }
    return value as TwoStageStepStatus;
  };
  return Object.freeze({
    success: true,
    action: action as ResumeAction,
    nextTarget,
    origin: "9_16_two_stage",
    creditStatus: record.credit_status,
    baseStatus: statusOf(record.base_status, "invalid_base_status"),
    baseAttempts,
    expansionStatus: statusOf(record.expansion_status, "invalid_expansion_status"),
    expansionAttempts,
    unknown: record.unknown,
    failedOutcome: record.failed_outcome,
  });
}

export class ProductTwoStageOperationClient {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async open(input: OpenOperationRequest): Promise<OpenOperationResult> {
    const { data, error } = await this.client.rpc("product_9_16_open_operation", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
    });
    if (error) throw mapError(error.message);
    return parseOpenOperation(data, input);
  }

  async acquire(input: AcquireStepRequest): Promise<AcquireStepResult> {
    const { data, error } = await this.client.rpc("product_9_16_acquire_step", {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_stage: input.stage,
      p_request_id: input.requestId,
      p_target: input.target,
    });
    if (error) throw mapError(error.message);
    return parseAcquireStep(data, input);
  }

  async finish(input: FinishStepRequest): Promise<FinishStepResult> {
    const { data, error } = await this.client.rpc("product_9_16_finish_step", {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_attempt_token: input.attemptToken,
      p_expected_status: input.expectedStatus,
      p_status: input.status,
      p_failure_class: input.failureClass ?? null,
    });
    if (error) throw mapError(error.message);
    return parseFinishStep(data, input);
  }

  async recordOutcome(input: RecordOutcomeRequest): Promise<RecordOutcomeResult> {
    const { data, error } = await this.client.rpc("product_9_16_record_outcome", {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_stage: input.stage,
      p_outcome: input.outcome,
      p_support_reference: input.supportReference ?? null,
    });
    if (error) throw mapError(error.message);
    return parseRecordOutcome(data, input);
  }

  async resume(input: ResumeOperationRequest): Promise<ResumeOperationResult> {
    const { data, error } = await this.client.rpc("product_9_16_resume_operation", {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
    });
    if (error) throw mapError(error.message);
    return parseResumeOperation(data);
  }
}
