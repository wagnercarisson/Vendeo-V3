"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface CreditCtaProps {
  variant: "zero" | "low" | "normal";
  supportEmail?: string;
}

export function CreditCta({ variant, supportEmail }: CreditCtaProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInteractiveRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null);

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

  if (variant === "normal") return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className={`inline-flex min-h-[44px] items-center rounded-lg px-6 py-2 text-sm font-semibold font-heading transition-all duration-200 ${
          variant === "zero"
            ? "bg-accent-green text-white hover:brightness-110"
            : "border border-accent-amber/50 text-accent-amber hover:bg-accent-amber/10"
        }`}
      >
        Solicitar créditos
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="credit-modal-title"
            className="rounded-xl border border-border bg-bg-surface p-6 max-w-md w-full mx-4 space-y-4"
          >
            <h3 id="credit-modal-title" className="text-lg font-semibold text-text-primary font-heading">
              Solicitar créditos
            </h3>
            {supportEmail ? (
              <div className="space-y-2">
                <p className="text-text-secondary text-sm font-body">
                  Envie um email para{" "}
                  <a
                    ref={firstInteractiveRef as React.RefObject<HTMLAnchorElement>}
                    href={`mailto:${supportEmail}`}
                    className="text-accent-green underline"
                  >
                    {supportEmail}
                  </a>{" "}
                  solicitando mais créditos. O time do Vendeo responderá em até 24h.
                </p>
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
                >
                  Enviar email
                </a>
              </div>
            ) : (
              <p className="text-text-secondary text-sm font-body">
                Entre em contato com o time do Vendeo para solicitar mais créditos.
                Responderemos em até 24h.
              </p>
            )}
            <button
              type="button"
              onClick={close}
              className="text-sm text-text-muted hover:text-text-primary underline transition-colors duration-200"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
