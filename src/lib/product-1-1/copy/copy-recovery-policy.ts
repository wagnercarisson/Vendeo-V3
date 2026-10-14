/**
 * F56.2b2a (B2.1 / B2A-D2/D3) — Política PURA de recuperação de copy do Produto
 * 1:1.
 *
 * Componente **puro** (sem I/O, sem relógio, sem banco, sem provider): DECIDE os
 * limites separados (3 automáticas + 3 manuais = teto 6), as **esperas** (5s
 * após a 1ª, 10s após a 2ª — FONTE ÚNICA em `copy-state.ts`) e a classificação
 * `transient × definitive`. A espera é **agendada** pela UI; a **verificação**
 * server-side da espera vive na aquisição atômica (`copy-acquisition-client.ts`,
 * Plano 06) — esta política apenas DECIDE.
 *
 * Regras (B2A-D2):
 *  - 1ª tentativa até `COPY_BUDGET_MS` (30s);
 *  - falha TRANSITÓRIA ⇒ esperar 5s ⇒ 2ª; nova transitória ⇒ esperar 10s ⇒ 3ª;
 *  - esgotadas as 3 automáticas ⇒ ação MANUAL + suporte;
 *  - falha DEFINITIVA ⇒ saída antecipada (SEM esperas e SEM nova automática);
 *  - o limite MANUAL é 3 INDEPENDENTE das automáticas (teto total 6);
 *  - cada CLIQUE manual inicia UMA tentativa e **não** reinicia o ciclo
 *    automático;
 *  - sucesso/entrega ENCERRA a recuperação.
 *
 * CHAMADA EFETIVA = TENTATIVA (lacuna 3): cada chamada efetiva ao provider
 * (primária OU fallback) é UMA tentativa identificada, adquirida ANTES da
 * chamada — NÃO existe fallback escondido dentro do mesmo acionamento e a
 * contabilidade é feita por AQUISIÇÃO, não por hook dentro da chamada.
 *
 * A classificação `retryable` (transitória × definitiva) é resolvida
 * SERVER-SIDE (`isRetryableError` de `@/lib/copy/errors`) — NUNCA inferida de
 * dado do cliente.
 */

import { COPY_BUDGET_MS, COPY_RECOVERY_WAITS_MS } from "./copy-state";

/**
 * FONTE ÚNICA das esperas (`copy-state.ts`, Plano 01): re-exportada aqui para
 * que os consumidores da política não redeclarem os literais `after1`/`after2`
 * (evita divergência 5s/10s e o ciclo de import `copy-state ↔
 * copy-recovery-policy`).
 */
export { COPY_RECOVERY_WAITS_MS };

/** B2A-D4 — classificação SERVER-SIDE da falha (nunca do cliente). */
export type CopyFailureClass = "transient" | "definitive";

/** B2A-D4 — origem da tentativa: automática (ciclo) ou manual (clique). */
export type CopyRecoveryKind = "auto" | "manual";

/** Teto de tentativas AUTOMÁTICAS por entrega. */
export const COPY_RECOVERY_AUTO_LIMIT = 3 as const;
/** Teto de tentativas MANUAIS por entrega (INDEPENDENTE das automáticas). */
export const COPY_RECOVERY_MANUAL_LIMIT = 3 as const;
/** Teto TOTAL por entrega: 3 automáticas + 3 manuais. */
export const COPY_RECOVERY_TOTAL_LIMIT = 6 as const;

/**
 * Orçamento por tentativa — reusa `COPY_BUDGET_MS` (30s, FONTE ÚNICA), sem
 * duplicar o literal.
 */
export const COPY_RECOVERY_BUDGET_MS = COPY_BUDGET_MS;

/** Próxima ação após uma falha classificada. */
export type CopyRecoveryAction = "next_auto" | "manual_with_support" | "definitive_exit";

/** Resultado puro da classificação de uma falha de tentativa. */
export interface CopyRecoveryDecision {
  readonly failureClass: CopyFailureClass;
  readonly action: CopyRecoveryAction;
  /** `true` quando nenhuma nova tentativa (auto/manual) é cabível. */
  readonly terminal: boolean;
  /** Origem da próxima tentativa (`null` quando não há automática seguinte). */
  readonly nextKind: CopyRecoveryKind | null;
  /** `attempt_seq` da próxima tentativa (`null` quando não há automática seguinte). */
  readonly nextAttemptSeq: number | null;
  /** Espera (ms) antes da próxima tentativa (`null` quando não há espera). */
  readonly nextWaitMs: number | null;
}

/** Motivo de RECUSA ao se tentar adquirir/agendar uma nova tentativa. */
export type CopyRecoveryRefusal =
  | "already_delivered"
  | "attempt_active"
  | "wait_not_elapsed"
  | "attempt_limit_reached";

/**
 * Estado agregado (resolvido SERVER-SIDE) usado pelos gatekeepers puros. Nenhum
 * campo é inferido de dado do cliente.
 */
export interface CopyRecoveryState {
  /** Copy `completed` COM conteúdo entregável (B2A-D1: encerra a recuperação). */
  readonly copyDelivered: boolean;
  /** Tentativa ATIVA confirmada pelo servidor (LEASE vigente). */
  readonly attemptActive: boolean;
  /** Espera server-side (5s/10s) já vencida. */
  readonly waitElapsed: boolean;
  readonly autoAttempts: number;
  readonly manualAttempts: number;
}

function decision(d: CopyRecoveryDecision): CopyRecoveryDecision {
  return Object.freeze(d);
}

/**
 * Espera (ms) antes da próxima tentativa, decidida pela política e lida da
 * FONTE ÚNICA (`COPY_RECOVERY_WAITS_MS.after1/after2`). Automáticas: 5s após a
 * 1ª, 10s após a 2ª. Manuais e ≥3ª automática: sem espera.
 */
export function copyRecoveryWaitMs(
  kind: CopyRecoveryKind,
  attemptSeq: number,
): number | null {
  if (kind !== "auto") return null;
  if (attemptSeq <= 1) return COPY_RECOVERY_WAITS_MS.after1;
  if (attemptSeq === 2) return COPY_RECOVERY_WAITS_MS.after2;
  return null;
}

/**
 * Classifica uma falha de tentativa e devolve a PRÓXIMA ação (B2A-D2).
 *
 *  - `retryable === false` (DEFINITIVA) ⇒ `definitive_exit` (sem esperas e sem
 *    nova automática — ação manual + suporte é ofertada pela UI);
 *  - `retryable === true` + automática com automáticas restantes ⇒ `next_auto`
 *    (5s após a 1ª, 10s após a 2ª);
 *  - `retryable === true` esgotadas as 3 automáticas ⇒ `manual_with_support`;
 *  - `retryable === true` MANUAL ⇒ `manual_with_support` (clique manual NÃO
 *    reinicia o ciclo automático).
 */
export function classifyCopyRecoveryFailure(input: {
  readonly retryable: boolean;
  readonly attemptSeq: number;
  readonly kind: CopyRecoveryKind;
}): CopyRecoveryDecision {
  if (!input.retryable) {
    return decision({
      failureClass: "definitive",
      action: "definitive_exit",
      terminal: false,
      nextKind: null,
      nextAttemptSeq: null,
      nextWaitMs: null,
    });
  }
  if (input.kind === "auto" && input.attemptSeq < COPY_RECOVERY_AUTO_LIMIT) {
    return decision({
      failureClass: "transient",
      action: "next_auto",
      terminal: false,
      nextKind: "auto",
      nextAttemptSeq: input.attemptSeq + 1,
      nextWaitMs: copyRecoveryWaitMs("auto", input.attemptSeq),
    });
  }
  return decision({
    failureClass: "transient",
    action: "manual_with_support",
    terminal: false,
    nextKind: null,
    nextAttemptSeq: null,
    nextWaitMs: null,
  });
}

/**
 * Gatekeeper PURO para adquirir uma NOVA tentativa automática. Devolve o motivo
 * de RECUSA (`null` quando permitido): copy já entregue, tentativa ATIVA (LEASE),
 * espera NÃO vencida, teto total (6) atingido ou teto automático (3) atingido.
 */
export function nextCopyRecoveryAttempt(state: CopyRecoveryState): CopyRecoveryRefusal | null {
  if (state.copyDelivered) return "already_delivered";
  if (state.attemptActive) return "attempt_active";
  if (!state.waitElapsed) return "wait_not_elapsed";
  if (state.autoAttempts + state.manualAttempts >= COPY_RECOVERY_TOTAL_LIMIT) {
    return "attempt_limit_reached";
  }
  if (state.autoAttempts >= COPY_RECOVERY_AUTO_LIMIT) return "attempt_limit_reached";
  return null;
}

/**
 * `true` quando um CLIQUE manual pode iniciar UMA tentativa: copy não entregue,
 * sem tentativa ATIVA, limite manual (3) não atingido e teto total (6) não
 * atingido.
 */
export function canRequestManualCopyRecovery(state: CopyRecoveryState): boolean {
  if (state.copyDelivered) return false;
  if (state.attemptActive) return false;
  if (state.manualAttempts >= COPY_RECOVERY_MANUAL_LIMIT) return false;
  if (state.autoAttempts + state.manualAttempts >= COPY_RECOVERY_TOTAL_LIMIT) return false;
  return true;
}
