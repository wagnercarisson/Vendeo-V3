/**
 * F59 — Estimativa vertical conservadora e orçamento da prova de provider.
 *
 * Módulo PURO: sem I/O, sem rede, sem leitura de ambiente, sem preço hardcoded
 * por modelo. O custo unitário (`image_unit_usd`) é INJETADO pelo chamador.
 *
 * A estimativa vertical é DEFINIDA ANTES da primeira chamada paga:
 *   estimado = image_unit_usd × 2,5
 * onde 2,5 = 2,25 (razão de área 1152×2048 / 1024×1024) + 0,25 de margem de
 * segurança. É PROVISÓRIA e conservadora, sujeita a calibração na prova
 * (`59-02-VERTICAL-ESTIMATE-CALIBRATION.md`); não é custo real.
 */

export const VERTICAL_PRICING_VERSION = "f59-vertical-9-16-v1" as const;

/** 1152 × 2048 = 2.359.296 px; 1024 × 1024 = 1.048.576 px ⇒ 2,25. */
export const VERTICAL_PIXEL_AREA_RATIO = 2.25 as const;

/**
 * PROVISÓRIO e conservador = 2,25 (razão de área) + 0,25 (margem de segurança).
 * Sujeito a calibração na prova de provider; NÃO é custo real.
 */
export const VERTICAL_COST_MULTIPLIER = 2.5 as const;

export interface VerticalEstimateInput {
  readonly model: string;
  readonly quality: string;
  readonly imageUnitUsd: number | null | undefined;
}

export interface VerticalEstimateAvailable {
  readonly available: true;
  readonly estimatedUsd: number;
  readonly multiplier: typeof VERTICAL_COST_MULTIPLIER;
  readonly pixelAreaRatio: typeof VERTICAL_PIXEL_AREA_RATIO;
  readonly pricingVersion: typeof VERTICAL_PRICING_VERSION;
}

export interface VerticalEstimateUnavailable {
  readonly available: false;
  readonly reason: "vertical_estimate_missing";
}

export type VerticalEstimate =
  | VerticalEstimateAvailable
  | VerticalEstimateUnavailable;

export class VerticalEstimateMissingError extends Error {
  readonly code = "vertical_estimate_missing" as const;

  constructor() {
    super("vertical_estimate_missing");
    this.name = "VerticalEstimateMissingError";
  }
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function isValidUnitCost(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Fail-closed: sem `image_unit_usd` finito e positivo NÃO há estimativa vertical.
 * Nunca cai na estimativa de 1024×1024 nem inventa valor.
 */
export function estimateVerticalCall(
  input: VerticalEstimateInput,
): VerticalEstimate {
  if (!isValidUnitCost(input.imageUnitUsd)) {
    return Object.freeze({
      available: false as const,
      reason: "vertical_estimate_missing" as const,
    });
  }

  return Object.freeze({
    available: true as const,
    estimatedUsd: round6(input.imageUnitUsd * VERTICAL_COST_MULTIPLIER),
    multiplier: VERTICAL_COST_MULTIPLIER,
    pixelAreaRatio: VERTICAL_PIXEL_AREA_RATIO,
    pricingVersion: VERTICAL_PRICING_VERSION,
  });
}

/** Lança erro tipado quando a estimativa vertical não existe. */
export function assertVerticalEstimate(
  estimate: VerticalEstimate,
): VerticalEstimateAvailable {
  if (!estimate.available) throw new VerticalEstimateMissingError();
  return estimate;
}

export type ProofStopReason = "proof_budget_exceeded" | "cost_unknown" | null;

export interface ProofBudget {
  readonly capUsd: number;
  readonly plannedCalls: number;
  readonly remainingUsd: number;
  readonly executedCalls: number;
  readonly pendingCalls: number;
  readonly totalChargedUsd: number;
  readonly deviationUsd: number;
  readonly unknownCalls: number;
  readonly costUnverifiedCalls: number;
  readonly retryCalls: number;
  readonly fallbackCalls: number;
  readonly requiresReconciliation: boolean;
  readonly stopReason: ProofStopReason;
  readonly exhausted: boolean;
}

export interface ProofBudgetCallInput {
  readonly estimatedUsd: number;
  readonly providerReportedUsd?: number | null;
  readonly calculatedFromUsageUsd?: number | null;
  readonly target: string;
  readonly isRetry?: boolean;
  readonly costVerified?: boolean;
}

export interface ProofUnknownOutcomeInput {
  readonly estimatedUsd: number;
  readonly target: string;
}

export type ProofAffordability =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "proof_budget_exceeded" };

function requirePositiveEstimate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new VerticalEstimateMissingError();
  }
  return value;
}

function knownCost(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function highestKnownCost(input: ProofBudgetCallInput): number {
  const estimated = requirePositiveEstimate(input.estimatedUsd);
  const candidates = [
    estimated,
    knownCost(input.providerReportedUsd),
    knownCost(input.calculatedFromUsageUsd),
  ].filter((value): value is number => value !== null);
  return round6(Math.max(...candidates));
}

function pendingCallsFor(plannedCalls: number, executedCalls: number): number {
  return Math.max(0, plannedCalls - executedCalls);
}

export function createProofBudget(input: {
  readonly capUsd: number;
  readonly plannedCalls: number;
}): ProofBudget {
  if (!Number.isFinite(input.capUsd) || input.capUsd <= 0) {
    throw new Error("invalid_proof_budget_cap");
  }
  if (
    !Number.isInteger(input.plannedCalls) ||
    input.plannedCalls < 0
  ) {
    throw new Error("invalid_proof_budget_planned_calls");
  }

  const capUsd = round6(input.capUsd);
  return Object.freeze({
    capUsd,
    plannedCalls: input.plannedCalls,
    remainingUsd: capUsd,
    executedCalls: 0,
    pendingCalls: input.plannedCalls,
    totalChargedUsd: 0,
    deviationUsd: 0,
    unknownCalls: 0,
    costUnverifiedCalls: 0,
    retryCalls: 0,
    fallbackCalls: 0,
    requiresReconciliation: false,
    stopReason: null,
    exhausted: false,
  });
}

/** Checagem puramente monetária (unknown/reconciliação é outro gate). */
export function canAfford(
  budget: ProofBudget,
  amountUsd: number,
): ProofAffordability {
  if (
    !Number.isFinite(amountUsd) ||
    amountUsd <= 0 ||
    budget.remainingUsd < amountUsd
  ) {
    return Object.freeze({
      ok: false as const,
      reason: "proof_budget_exceeded" as const,
    });
  }
  return Object.freeze({ ok: true as const });
}

/**
 * Gate combinado antes de cada chamada: reconciliação pendente bloqueia;
 * em seguida, saldo insuficiente bloqueia e marca a parada.
 */
export function remainingBudgetBlocks(
  budget: ProofBudget,
  amountUsd: number,
): Exclude<ProofStopReason, null> | null {
  if (budget.requiresReconciliation || budget.stopReason === "cost_unknown") {
    return "cost_unknown";
  }
  if (!canAfford(budget, amountUsd).ok) return "proof_budget_exceeded";
  return null;
}

/**
 * Registra uma chamada EXECUTADA e cobra o MAIOR custo conhecido contra o teto.
 * Retry/fallback também contam como chamada executada.
 */
export function recordCall(
  budget: ProofBudget,
  input: ProofBudgetCallInput,
): ProofBudget {
  const chargedUsd = highestKnownCost(input);
  const executedCalls = budget.executedCalls + 1;
  const remainingUsd = round6(Math.max(0, budget.remainingUsd - chargedUsd));
  const costUnverified = input.costVerified === false;
  const stopReason: ProofStopReason = budget.stopReason
    ?? (costUnverified
      ? "cost_unknown"
      : remainingUsd <= 0
        ? "proof_budget_exceeded"
        : null);

  return Object.freeze({
    ...budget,
    remainingUsd,
    executedCalls,
    pendingCalls: pendingCallsFor(budget.plannedCalls, executedCalls),
    totalChargedUsd: round6(budget.totalChargedUsd + chargedUsd),
    deviationUsd: round6(
      budget.deviationUsd + (chargedUsd - input.estimatedUsd),
    ),
    costUnverifiedCalls:
      budget.costUnverifiedCalls + (costUnverified ? 1 : 0),
    retryCalls: budget.retryCalls + (input.isRetry === true ? 1 : 0),
    fallbackCalls: budget.fallbackCalls + (input.target === "fallback" ? 1 : 0),
    requiresReconciliation: budget.requiresReconciliation || costUnverified,
    stopReason,
    exhausted: remainingUsd <= 0,
  });
}

/**
 * Resultado desconhecido (timeout/abort/sem usage): cobra a estimativa
 * conservadora, exige reconciliação, PARA a prova e nunca faz retry cego.
 */
export function recordUnknownOutcome(
  budget: ProofBudget,
  input: ProofUnknownOutcomeInput,
): ProofBudget {
  const chargedUsd = round6(requirePositiveEstimate(input.estimatedUsd));
  const executedCalls = budget.executedCalls + 1;
  const remainingUsd = round6(Math.max(0, budget.remainingUsd - chargedUsd));

  return Object.freeze({
    ...budget,
    remainingUsd,
    executedCalls,
    pendingCalls: pendingCallsFor(budget.plannedCalls, executedCalls),
    totalChargedUsd: round6(budget.totalChargedUsd + chargedUsd),
    unknownCalls: budget.unknownCalls + 1,
    requiresReconciliation: true,
    stopReason: "cost_unknown" as const,
    exhausted: remainingUsd <= 0,
  });
}
