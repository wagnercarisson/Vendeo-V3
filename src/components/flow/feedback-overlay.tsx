"use client";

import { useEffect, useRef, useCallback } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type FeedbackOverlayProps = {
  message: string | null;
  type: "error" | "success";
  onDismiss: () => void;
  focusSelector?: string;
};

export function FeedbackOverlay({ message, type, onDismiss, focusSelector }: FeedbackOverlayProps) {
  const prevActiveElement = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (message && type === "error") {
      prevActiveElement.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
    return () => {
      if (focusSelector) {
        const target = document.querySelector<HTMLElement>(focusSelector);
        target?.focus();
      } else if (prevActiveElement.current && typeof prevActiveElement.current.focus === "function") {
        prevActiveElement.current.focus();
      }
      prevActiveElement.current = null;
    };
  }, [message, type, focusSelector]);

  useEffect(() => {
    if (message && type === "success") {
      dismissTimerRef.current = setTimeout(handleDismiss, 5000);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [message, type, handleDismiss]);

  useEffect(() => {
    if (!message || type !== "error") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [message, type, handleDismiss]);

  if (!message) return null;

  if (type === "error") {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Erro"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onPointerDown={handleDismiss}
      >
        <div
          className="bg-bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-accent-red shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-body">{message}</p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleDismiss}
              autoFocus
              className="min-h-[44px] px-4 py-2 bg-accent-blue text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-full mx-4"
    >
      <div className="flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3 shadow-lg">
        <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
        <p className="text-accent-green text-sm font-body flex-1">{message}</p>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-text-muted hover:text-text-primary transition-colors duration-200 shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
