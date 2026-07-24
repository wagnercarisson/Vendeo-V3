"use client";

import { ExternalLink, Loader2, Check } from "lucide-react";
import { useState } from "react";
import { LegalDocumentViewer } from "./legal-document-viewer";

interface ContractDocumentInfo {
  label: string;
  version: string;
  url: string;
}

interface ContractAcceptanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
  contractDocuments: ContractDocumentInfo[];
}

export function ContractAcceptanceModal({
  open,
  onOpenChange,
  onConfirm,
  contractDocuments,
}: ContractAcceptanceModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const success = await onConfirm();
      if (success) {
        setChecked(false);
        onOpenChange(false);
      } else {
        setError("Não foi possível registrar sua aceitação. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setChecked(false);
    setError(null);
    onOpenChange(false);
  };

  const checkboxText = contractDocuments
    .map((d) => `${d.label} ${d.version}`)
    .join(" e a ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onPointerDown={submitting ? undefined : handleClose}
    >
      <div
        className="bg-bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <h2 className="text-lg font-heading font-bold text-text-primary">
            Termos de Uso e Política de Uso Aceitável
          </h2>
          <p className="text-xs text-text-muted mt-1 space-x-2">
            {contractDocuments.map((d) => (
              <span key={d.label}>{d.label}: {d.version}</span>
            ))}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6 text-sm text-text-secondary font-body">
          {contractDocuments.map((doc) => (
            <section key={doc.label}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-heading font-semibold text-text-primary">
                  {doc.label}
                </h3>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80 text-xs"
                >
                  Abrir em nova aba <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <LegalDocumentViewer
                url={doc.url}
                title={doc.label}
                version={doc.version}
              />
            </section>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 pb-0 shrink-0">
            <p className="text-xs text-accent-red bg-accent-red/10 rounded-lg px-3 py-2">
              {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 rounded border-border-light accent-accent-blue shrink-0"
            />
            <span className="text-sm text-text-primary font-body">
              Li e aceito integralmente {checkboxText}.
            </span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!checked || submitting}
              className="flex-1 px-4 py-2.5 bg-accent-blue text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Aceitar termos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
