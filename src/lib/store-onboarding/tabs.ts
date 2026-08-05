/**
 * Máquina de abas do onboarding de loja (F36) — definição tipada das 3 abas
 * e desbloqueio progressivo via função pura (D1/D8/D9).
 *
 * Módulo puro: sem runtime de UI, sem ambiente de servidor, sem imports de side-effect.
 * CNPJ NUNCA bloqueia navegação (D8) — o desbloqueio considera apenas
 * dados da loja + aceite legal + tom de voz.
 */

export type OnboardingTab = "dados" | "posicionamento" | "direcao-visual";

/** Ordem das abas no fluxo (D1) — também usada como fonte da união `OnboardingTab`. */
export const TAB_ORDER: OnboardingTab[] = [
  "dados",
  "posicionamento",
  "direcao-visual",
];

export type TabBlockReason =
  | "needs_legal_acceptance"
  | "needs_tone_of_voice"
  | "needs_store_created"
  | "fiscal_pending";

export interface OnboardingTabDef {
  id: OnboardingTab;
  label: string;
  labelMobile: string;
}

/**
 * Labels das abas (D10).
 * `labelMobile` é APENAS display no mobile compacto (Dados/Perfil/Visual).
 * O `id` permanece `posicionamento`/`direcao-visual` — usado em query param
 * (?tab=), testes e analytics. Nunca criar um segundo vocabulário.
 */
export const ONBOARDING_TABS: OnboardingTabDef[] = [
  { id: "dados", label: "Dados", labelMobile: "Dados" },
  { id: "posicionamento", label: "Posicionamento", labelMobile: "Perfil" },
  { id: "direcao-visual", label: "Direção Visual", labelMobile: "Visual" },
];

export interface TabUnlockContext {
  name: string;
  segment: string;
  legalAccepted: boolean;
  storeId: string | null;
  toneOfVoice: string;
  hasVisualDirection: boolean;
}

/**
 * Desbloqueio progressivo das abas (D1/D8/D9):
 * - `dados` → sempre desbloqueada (aberta por padrão)
 * - `posicionamento` → exige aceite legal + mínimo (name/segment) + loja criada
 * - `direcao-visual` → exige loja criada + tom de voz; `hasVisualDirection`
 *   faz bypass (loja existente com direção visual nasce com a aba ③ aberta)
 * - Tab inválida → fallback seguro bloqueado
 */
export function computeTabUnlock(
  tab: OnboardingTab,
  ctx: TabUnlockContext,
): { unlocked: boolean; reason?: TabBlockReason } {
  if (tab === "dados") {
    return { unlocked: true };
  }

  if (tab === "posicionamento") {
    if (!ctx.legalAccepted) {
      return { unlocked: false, reason: "needs_legal_acceptance" };
    }
    if (!ctx.name.trim() || !ctx.segment || !ctx.storeId) {
      return { unlocked: false, reason: "needs_store_created" };
    }
    return { unlocked: true };
  }

  if (tab === "direcao-visual") {
    if (ctx.hasVisualDirection) {
      return { unlocked: true };
    }
    if (!ctx.storeId) {
      return { unlocked: false, reason: "needs_store_created" };
    }
    if (!ctx.toneOfVoice.trim()) {
      return { unlocked: false, reason: "needs_tone_of_voice" };
    }
    return { unlocked: true };
  }

  // Tab inválida (não pertence a TAB_ORDER) — fallback seguro
  return { unlocked: false, reason: "needs_store_created" };
}

/** Guard para parsing de `?tab=` (36-04) — true apenas para os 3 valores válidos. */
export function isOnboardingTab(value: string): value is OnboardingTab {
  return (TAB_ORDER as readonly string[]).includes(value);
}
