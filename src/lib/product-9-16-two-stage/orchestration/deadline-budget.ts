import {
  PRODUCT_1_1_GENERATION_DEADLINE_MS,
  deadlineAt,
  remainingBeforeDeadline,
  remainingBudget,
} from "@/lib/product-1-1/orchestration/deadline";

export type OrchestrationStep = "base" | "preparation" | "expansion" | "delivery";

export const STEP_FLOOR_MS: Readonly<Record<OrchestrationStep, number>> = Object.freeze({
  base: 15_000,
  preparation: 5_000,
  expansion: 15_000,
  delivery: 5_000,
});

export function computeInvocationDeadline(
  requestStartedAtMs: number,
  timeoutMs?: number,
): number {
  const baseDeadline = deadlineAt(
    requestStartedAtMs,
    PRODUCT_1_1_GENERATION_DEADLINE_MS,
  );
  if (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return baseDeadline;
  }
  return Math.min(baseDeadline, requestStartedAtMs + timeoutMs);
}

export function canAffordStep(
  nowMs: number,
  deadlineAtMs: number,
  step: OrchestrationStep,
): boolean {
  return remainingBeforeDeadline(nowMs, deadlineAtMs) >= STEP_FLOOR_MS[step];
}

export function remainingForStep(nowMs: number, deadlineAtMs: number): number {
  return remainingBudget(nowMs, deadlineAtMs);
}
