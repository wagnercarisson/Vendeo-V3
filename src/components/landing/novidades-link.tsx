"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChangelogList } from "@/components/changelog/changelog-list";
import type { ChangelogEntry } from "@/lib/changelog/types";

interface NovidadesLinkProps {
  entries: ChangelogEntry[];
  variant: "prominent" | "footer";
}

/**
 * Link "Novidades" da landing pública que abre um MODAL sobre a própria
 * landing (sem rota nova) com as entradas do changelog resolvidas no server.
 *
 * - `variant="prominent"`: destaque de maior contraste abaixo do card de
 *   acesso (min-h 44px, accent-green, foco anelado).
 * - `variant="footer"`: discreto, no grupo Termos/Privacidade do rodapé.
 *
 * Acessibilidade (padrão credit-cta.tsx): Esc fecha, foco vai ao primeiro
 * interativo (botão ×) ao abrir, volta ao trigger ao fechar, backdrop click
 * fecha, `role="dialog"` + `aria-modal="true"`.
 */
export function NovidadesLink({ entries, variant }: NovidadesLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstInteractiveRef = useRef<HTMLButtonElement>(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      setTimeout(() => firstInteractiveRef.current?.focus(), 0);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={
          variant === "prominent"
            ? "inline-flex min-h-[44px] cursor-pointer items-center rounded-lg font-heading font-semibold text-accent-green hover:underline focus:ring-2 focus:ring-accent-green focus:outline-none"
            : "cursor-pointer text-sm text-text-muted transition-colors hover:text-text-primary"
        }
      >
        Novidades
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-novidades-title"
            className="w-full max-w-2xl rounded-xl border border-border bg-bg-elevated p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="landing-novidades-title"
                className="font-heading text-lg font-semibold"
              >
                Novidades
              </h2>
              <button
                ref={firstInteractiveRef}
                type="button"
                onClick={close}
                aria-label="Fechar novidades"
                className="flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-lg text-text-secondary transition-colors duration-200 hover:bg-bg-elevated hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
              >
                ×
              </button>
            </div>
            <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1">
              <ChangelogList entries={entries} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
