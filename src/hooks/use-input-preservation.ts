"use client";

import { useCallback } from "react";

const DRAFT_KEY = "campaign_draft";

export function useInputPreservation<T extends object>() {
  const saveFormState = useCallback((state: T) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      console.warn("Failed to save form state to sessionStorage");
    }
  }, []);

  const restoreFormState = useCallback((): T | null => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      console.warn("Failed to restore form state from sessionStorage");
      return null;
    }
  }, []);

  const clearFormState = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { saveFormState, restoreFormState, clearFormState };
}
