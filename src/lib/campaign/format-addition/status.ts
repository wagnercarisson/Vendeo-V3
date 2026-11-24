import type { FormatAdditionRunResult } from "./orchestration/types";

export const AUTHORIZATION_DENIAL_CODES: ReadonlySet<string> = new Set([
  "missing_authorization",
  "stage_not_enabling",
  "instance_mismatch",
  "scope_mismatch",
  "stage_scope_mismatch",
  "stage_environment_mismatch",
  "revoked",
  "expired",
  "flag_not_applicable_off",
]);

/**
 * F62-08 — status HTTP coerente com o código produzido pelo opening gate.
 * Saldo, rate limit e autorização não podem cair no 409 genérico por envelope.
 */
export function statusForRun(result: FormatAdditionRunResult): number {
  if (result.ok) {
    return result.kind === "processing" ? 202 : 200;
  }
  if (result.code === "gate_blocked") {
    if (result.reason === "rate_limit_exceeded") return 429;
    if (result.reason === "insufficient_credits") return 402;
    if (
      result.reason === "addition_disabled" ||
      result.reason === "engine_disabled" ||
      result.reason === "legal_blocked" ||
      result.reason === "store_not_ready"
    ) {
      return 403;
    }
    return 409;
  }
  if (
    result.code === "insufficient_credits" ||
    result.reason === "balance_below_one"
  ) {
    return 402;
  }
  if (
    result.code === "rate_limit_exceeded" ||
    result.reason === "rate_limit_exceeded"
  ) {
    return 429;
  }
  if (
    result.code === "addition_disabled" ||
    result.code === "engine_disabled" ||
    result.code === "legal_blocked" ||
    result.code === "store_not_ready"
  ) {
    return 403;
  }
  if (
    AUTHORIZATION_DENIAL_CODES.has(result.code) ||
    AUTHORIZATION_DENIAL_CODES.has(result.reason)
  ) {
    return 403;
  }
  if (
    result.code === "authorization_unavailable" ||
    result.code === "authorization_resolver_not_configured" ||
    result.code === "gate_read_failed" ||
    result.code === "read_failure" ||
    result.code === "flags_unavailable"
  ) {
    return 503;
  }
  if (
    result.code === "rpc_failed" ||
    result.code === "durable_context_read_failed"
  ) {
    return 503;
  }
  return 409;
}
