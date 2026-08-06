/**
 * Estado por aba do onboarding (F36, D7) — função pura com prioridade fixa:
 * `pending_generation` > `blocked` > `draft` > `ready` > `saved`.
 *
 * Módulo puro: sem runtime de UI, sem ambiente de servidor (import de tipo apenas).
 * O reason de `pending_generation` (`fiscal_pending`) indica que a loja não
 * pode gerar campanha — navegação continua permitida (D2/D8).
 */

import type { StoreReadinessResult as StoreReadiness } from "@/lib/store-readiness";
import type { OnboardingTab, TabBlockReason } from "./tabs";

export type TabState =
  | "blocked"
  | "draft"
  | "saved"
  | "ready"
  | "pending_generation";

export interface TabStateContext {
  hasLocalEdits: boolean;
  isPersisted: boolean;
  unlocked: boolean;
  readiness: StoreReadiness;
}

/**
 * Estado por aba exposto à UI.
 *
 * `reason` é o motivo do `computeTabState` (ex.: `fiscal_pending` de
 * pending_generation). `unlockReason` é o motivo de desbloqueio quando a aba
 * NÃO está desbloqueada (D9) — mantido mesmo quando `pending_generation`
 * domina o estado (D7/D8: navegação livre, mas o gate de desbloqueio continua
 * visível no painel ativo).
 */
export interface TabStateRecord {
  state: TabState;
  reason?: TabBlockReason;
  unlockReason?: TabBlockReason;
}

export function computeTabState(
  _tab: OnboardingTab,
  ctx: TabStateContext,
): { state: TabState; reason?: TabBlockReason } {
  const readiness = ctx.readiness;

  // 1. pending_generation — cadastro fiscal pendente bloqueia GERAÇÃO (D8),
  //    domina qualquer outro estado, inclusive blocked (navegação livre).
  if (!readiness.ready && (readiness.missing ?? []).some((m) => m.item === "cadastro_fiscal")) {
    return { state: "pending_generation", reason: "fiscal_pending" };
  }

  // 2. blocked — aba não desbloqueada (motivo vem de computeTabUnlock)
  if (!ctx.unlocked) {
    return { state: "blocked" };
  }

  // 3. draft — há edições locais ainda não persistidas
  if (ctx.hasLocalEdits && !ctx.isPersisted) {
    return { state: "draft" };
  }

  // 4. ready — persistido e loja pronta (readiness RPC)
  if (ctx.isPersisted && readiness.ready) {
    return { state: "ready" };
  }

  // 5. saved — persistido mas loja ainda não pronta
  if (ctx.isPersisted) {
    return { state: "saved" };
  }

  // 6. fallback
  return { state: "blocked" };
}

export type { OnboardingTab, TabBlockReason } from "./tabs";
