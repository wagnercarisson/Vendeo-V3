"use client";

import { useCallback } from "react";

/**
 * F56.2b2b (B2.2 / C4 / B2B-D9) — chaves de rascunho ESCOPADAS à campanha.
 *
 * Antes (b1b/F43): chave GLOBAL ÚNICA (`campaign_draft`). Isso misturava o
 * rascunho de campanhas diferentes. A B2.2 escopa à campanha-ORIGEM:
 * `campaign_draft:<campaignId>` / `campaign_draft_image:<campaignId>`.
 *
 * Compatibilidade: SEM origem (`scope` ausente/`null`) mantém exatamente a chave
 * LEGADA (`campaign_draft`/`campaign_draft_image`) — o caminho atual fica
 * byte-compatível. COM origem, SOMENTE a chave ESCOPADA daquela campanha é lida —
 * o rascunho de OUTRA campanha é IGNORADO.
 */
export const DRAFT_KEY = "campaign_draft";
export const IMAGE_DRAFT_KEY = "campaign_draft_image";

export function scopedDraftKey(scope?: string | null): string {
  return scope ? `${DRAFT_KEY}:${scope}` : DRAFT_KEY;
}

export function scopedImageDraftKey(scope?: string | null): string {
  return scope ? `${IMAGE_DRAFT_KEY}:${scope}` : IMAGE_DRAFT_KEY;
}

export function useInputPreservation<T extends object>() {
  const saveFormState = useCallback((state: T, scope?: string | null) => {
    try {
      sessionStorage.setItem(scopedDraftKey(scope), JSON.stringify(state));
    } catch {
      console.warn("Failed to save form state to sessionStorage");
    }
  }, []);

  const restoreFormState = useCallback((scope?: string | null): T | null => {
    try {
      const raw = sessionStorage.getItem(scopedDraftKey(scope));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      console.warn("Failed to restore form state from sessionStorage");
      return null;
    }
  }, []);

  const clearFormState = useCallback((scope?: string | null) => {
    try {
      sessionStorage.removeItem(scopedDraftKey(scope));
    } catch {
      // ignore
    }
  }, []);

  return { saveFormState, restoreFormState, clearFormState };
}
