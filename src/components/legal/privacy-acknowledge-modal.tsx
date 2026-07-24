"use client";

import { ExternalLink, Loader2, Check } from "lucide-react";
import { useState } from "react";

interface PrivacyAcknowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
  policyVersion?: string;
}

export function PrivacyAcknowledgeModal({
  open,
  onOpenChange,
  onConfirm,
  policyVersion,
}: PrivacyAcknowledgeModalProps) {
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
            Política de Privacidade
          </h2>
          {policyVersion && (
            <p className="text-xs text-text-muted mt-1">Versão {policyVersion}</p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto space-y-4 text-sm text-text-secondary font-body flex-1">
          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80 text-xs"
          >
            Abrir Política de Privacidade em nova aba <ExternalLink className="h-3 w-3" />
          </a>

          <div className="space-y-4">
            <section>
              <h3 className="font-heading font-semibold text-text-primary mb-1">1. Controlador e Contato</h3>
              <p>O Vendeo é o controlador dos dados pessoais tratados no âmbito da Plataforma. Dúvidas sobre esta Política podem ser enviadas para o email de suporte do Vendeo.</p>
            </section>

            <section>
              <h3 className="font-heading font-semibold text-text-primary mb-1">2. Dados Coletados</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Fornecidos pelo usuário:</strong> email, senha, nome da loja, segmento, cidade, estado, logotipo, informações de produto e oferta.</li>
                <li><strong>Coletados automaticamente:</strong> endereço IP, user agent, dados de uso, cookies essenciais.</li>
                <li><strong>Gerados pela plataforma:</strong> campanhas visuais, metadados de geração.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-heading font-semibold text-text-primary mb-1">3. Bases Legais (LGPD)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Operação do serviço — execução de contrato</li>
                <li>Comunicações transacionais — execução de contrato</li>
                <li>Prevenção a fraude — legítimo interesse</li>
                <li>Obrigação fiscal/regulatória — obrigação legal</li>
                <li>Comunicações comerciais — <strong>consentimento</strong></li>
              </ul>
            </section>

            <section>
              <h3 className="font-heading font-semibold text-text-primary mb-1">4. Finalidades do Tratamento</h3>
              <p>Os dados são tratados para operação da plataforma, geração de campanhas, controle de créditos, prevenção a fraudes, comunicações transacionais e, mediante consentimento, comunicações comerciais.</p>
            </section>

            <section>
              <h3 className="font-heading font-semibold text-text-primary mb-1">5. Compartilhamento com Terceiros</h3>
              <p>Compartilhamos dados com Supabase, OpenAI, Vercel e Anthropic/Gemini, limitado ao necessário para o serviço. Não vendemos dados pessoais.</p>
            </section>

            <section>
              <h3 className="font-heading font-semibold text-text-primary mb-1">6. Direitos do Titular (LGPD art. 18)</h3>
              <p>Você tem direito a confirmar, acessar, corrigir, anonimizar, portar, eliminar dados, revogar consentimento e opor-se ao tratamento com base em legítimo interesse.</p>
            </section>

            <section>
              <h3 className="font-heading font-semibold text-text-primary mb-1">7. Disposições Gerais</h3>
              <p>Esta Política pode ser atualizada. Alterações serão comunicadas ao usuário. É regida pela Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).</p>
            </section>
          </div>
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
              Li e declaro ciência da Política de Privacidade.
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
