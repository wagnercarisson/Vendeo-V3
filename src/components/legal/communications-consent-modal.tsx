"use client";

import { ExternalLink, Loader2, Check } from "lucide-react";
import { useState } from "react";

interface CommunicationsConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
}

export function CommunicationsConsentModal({
  open,
  onOpenChange,
  onConfirm,
}: CommunicationsConsentModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const success = await onConfirm();
      if (success) {
        setChecked(false);
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setChecked(false);
    onOpenChange(false);
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
            Comunicações Comerciais
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto space-y-4 text-sm text-text-secondary font-body flex-1">
          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80 text-xs"
          >
            Política de Privacidade <ExternalLink className="h-3 w-3" />
          </a>

          <div className="space-y-4">
            <p>
              Ao ativar as comunicações comerciais, você poderá receber:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Novidades e atualizações do Vendeo</li>
              <li>Ofertas e promoções especiais</li>
              <li>Conteúdos e dicas para suas campanhas</li>
              <li>Comunicações comerciais em geral</li>
            </ul>

            <div className="bg-bg-elevated border border-border rounded-lg p-4 space-y-2">
              <p className="font-heading font-semibold text-text-primary text-xs uppercase tracking-wide">Importante</p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>O consentimento é <strong>opcional</strong> — você pode usar o Vendeo normalmente sem ativar esta opção.</li>
                <li>A recusa não impede o uso do serviço nem afeta suas funcionalidades.</li>
                <li>Você pode <strong>revogar</strong> o consentimento a qualquer momento em /conta.</li>
                <li>Comunicações transacionais e operacionais necessárias ao funcionamento do serviço poderão continuar sendo enviadas independentemente desta escolha.</li>
              </ul>
            </div>
          </div>
        </div>

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
              Li as informações acima e autorizo o recebimento de comunicações comerciais do Vendeo.
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
              Ativar comunicações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
