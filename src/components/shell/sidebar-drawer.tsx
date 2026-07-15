"use client";

import { useEffect, useRef, useLayoutEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { Sidebar } from "./sidebar";
import type { RefObject } from "react";

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function SidebarDrawer({ isOpen, onClose, toggleButtonRef }: SidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const originalOverflowRef = useRef<string>("");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        toggleButtonRef?.current?.focus();
        return;
      }
      const panel = panelRef.current;
      if (!panel || e.key !== "Tab") return;
      const focusable = panel.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    },
    [onClose, toggleButtonRef],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      const panel = panelRef.current;
      if (panel) {
        const focusable = panel.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusable.length > 0) {
          focusable[0]?.focus();
        }
      }
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  useLayoutEffect(() => {
    if (isOpen) {
      originalOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = originalOverflowRef.current;
      originalOverflowRef.current = "";
    }
    return () => {
      document.body.style.overflow = originalOverflowRef.current;
    };
  }, [isOpen]);

  return (
    <>
      {isOpen && (
        <button
          onClick={() => {
            onClose();
            toggleButtonRef?.current?.focus();
          }}
          className="fixed inset-0 z-40 bg-black/50"
          aria-label="Fechar menu"
          tabIndex={-1}
        />
      )}

      <div
        ref={panelRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className={`fixed left-0 top-0 z-50 h-full w-72 max-w-[280px] border-r border-border bg-bg-surface transition-transform ${
          reducedMotion ? "duration-0" : "duration-300"
        } ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => {
            onClose();
            toggleButtonRef?.current?.focus();
          }}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="p-4">
          <span className="mb-6 mt-2 block text-lg font-bold text-text-primary font-heading">
            Vendeo
          </span>
          <Sidebar isDrawer onNavigate={onClose} />
        </div>
      </div>
    </>
  );
}
