"use client";

import { ExternalLink, Loader2, Check } from "lucide-react";
import { useState } from "react";
import { LegalDocumentViewer } from "./legal-document-viewer";

interface LegalDocumentInfo {
  label: string;
  version: string;
  url: string;
}

interface PrivacyAcknowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
  policyDocument: LegalDocumentInfo;
}

export function PrivacyAcknowledgeModal({
  open,
  onOpenChange,
  onConfirm,
  policyDocument,
}: PrivacyAcknowledgeModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [documentError, setDocumentError] = useState(false);

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
        setError("Não foi possível registrar sua ciência. Tente novamente.");
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

  const handleDocumentLoad = (loaded: boolean) => {
    setDocumentLoaded(loaded);
    if (!loaded) setDocumentError(true);
  };

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
            {policyDocument.label}
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Versão {policyDocument.version}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4 text-sm text-text-secondary font-body">
          <a
            href={policyDocument.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80 text-xs"
          >
            Abrir {policyDocument.label} em nova aba <ExternalLink className="h-3 w-3" />
          </a>

          <LegalDocumentViewer
            url={policyDocument.url}
            title={policyDocument.label}
            version={policyDocument.version}
          />
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
              Li e declaro ciência integral da {policyDocument.label} {policyDocument.version}.
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
              Confirmar ciência
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
