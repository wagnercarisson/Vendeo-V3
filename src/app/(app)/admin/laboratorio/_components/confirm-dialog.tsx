"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Diálogo de confirmação nativo do laboratório (F48.1, D12/D14/DV-5).
 *
 * Primitivo **local** — `src/components/ui/` permanece intocado nesta fase. Usa o
 * elemento `<dialog>` nativo com `role="dialog"`/`aria-modal`, foco inicial no
 * botão de confirmação, fechamento por `Esc` (`cancel`) e por clique no backdrop.
 * Enquanto `busy`, a confirmação fica desabilitada com spinner: nenhuma ação é
 * disparada duas vezes por duplo clique.
 *
 * A confirmação explícita é a barreira financeira da execução (D14): o painel de
 * execução só emite o `POST` depois que `onConfirm` é chamado por este diálogo.
 */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      } else {
        dialog.setAttribute("open", "");
      }
      confirmRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute("open");
        }
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-6 text-text-primary backdrop:bg-bg-deep/80"
    >
      <h2
        id={titleId}
        className="font-heading text-lg font-semibold text-text-primary"
      >
        {title}
      </h2>
      {description && (
        <div
          id={descriptionId}
          className="mt-3 space-y-2 text-sm text-text-secondary font-body"
        >
          {description}
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={busy}
          loading={busy}
          data-testid="lab-confirm-button"
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
