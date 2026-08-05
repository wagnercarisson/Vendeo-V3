/**
 * Rascunho persistente do onboarding de loja (F36, D5) — localStorage com TTL 24h
 * e chaves escopadas por usuário.
 *
 * Por que `localStorage` (e não `sessionStorage`, como em use-input-preservation):
 * o rascunho precisa sobreviver a fechar a aba, alternar de app e ao browser
 * descarregar a página no mobile — abandono real de beta testers. O TTL de 24h
 * evita que um draft velho seja "ressuscitado" na próxima visita.
 *
 * Escopo por usuário (T-36-07): chave `vendeo:store_draft:${userId}:new` antes do
 * 1º save, `vendeo:store_draft:${userId}:${storeId}` depois — drafts de contas
 * diferentes nunca colidem. `clearAllDrafts` limpa todas as chaves no logout.
 *
 * Módulo puro de storage (não é hook): funções de módulo com try/catch +
 * console.warn (padrão use-input-preservation).
 */

import type { FormData } from "@/components/flow/use-store-form";

/** 24h a partir da última edição (updatedAt). Expirado → ignorado e removido no restore. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface StoreDraft {
  userId: string;
  storeId: string | null;
  /** Partial por design — draft pode existir antes do 1º save (loja ainda não criada). */
  fields: Partial<FormData>;
  updatedAt: number;
}

const DRAFT_KEY_PREFIX = "vendeo:store_draft:";

/** `vendeo:store_draft:${userId}:new` (storeId null) | `vendeo:store_draft:${userId}:${storeId}` */
export function draftKey(userId: string, storeId: string | null): string {
  return storeId
    ? `${DRAFT_KEY_PREFIX}${userId}:${storeId}`
    : `${DRAFT_KEY_PREFIX}${userId}:new`;
}

export function saveDraft(draft: StoreDraft): void {
  try {
    const payload: StoreDraft = { ...draft, updatedAt: Date.now() };
    localStorage.setItem(
      draftKey(payload.userId, payload.storeId),
      JSON.stringify(payload),
    );
  } catch (error) {
    console.warn("Failed to save store draft to localStorage", error);
  }
}

export function restoreDraft(userId: string, storeId: string | null): StoreDraft | null {
  const key = draftKey(userId, storeId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoreDraft;

    // LW-03: updatedAt ausente/não-finito → tratado como expirado (nunca ressuscita)
    if (!Number.isFinite(parsed.updatedAt)) {
      localStorage.removeItem(key);
      return null;
    }

    // D5: expirado → ignorado e removido (draft velho nunca ressuscita)
    if (Date.now() - parsed.updatedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch (error) {
    // T-36-06: JSON corrompido → null, não crash
    console.warn("Failed to restore store draft from localStorage", error);
    return null;
  }
}

export function clearDraft(userId: string, storeId?: string): void {
  try {
    localStorage.removeItem(draftKey(userId, storeId ?? null));
  } catch {
    // ignore
  }
}

/** Remove todas as chaves com prefixo `vendeo:store_draft:` — usado no logout. */
export function clearAllDrafts(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn("Failed to clear store drafts from localStorage", error);
  }
}
