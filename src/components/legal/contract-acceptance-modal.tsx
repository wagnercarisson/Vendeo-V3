"use client";

import { ExternalLink, Loader2, Check } from "lucide-react";
import { useState } from "react";

interface ContractAcceptanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
  termsVersion?: string;
  aupVersion?: string;
}

export function ContractAcceptanceModal({
  open,
  onOpenChange,
  onConfirm,
  termsVersion,
  aupVersion,
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
          {(termsVersion || aupVersion) && (
            <p className="text-xs text-text-muted mt-1">
              {termsVersion && <>Termos: v{termsVersion}</>}
              {termsVersion && aupVersion && <> &mdash; </>}
              {aupVersion && <>Uso Aceitável: v{aupVersion}</>}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto space-y-5 text-sm text-text-secondary font-body flex-1">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80 text-xs"
            >
              Abrir Termos de Uso em nova aba <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="/uso-aceitavel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80 text-xs"
            >
              Abrir Política de Uso Aceitável em nova aba <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Termos de Uso */}
          <section>
            <h3 className="font-heading font-semibold text-text-primary mb-2">Termos de Uso</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">1. Definições</h4>
                <p>Plataforma Vendeo: sistema SaaS de geração automatizada de campanhas visuais para redes sociais. Usuário: pessoa física ou jurídica cadastrada. Lojista: usuário que cria uma loja e utiliza os serviços de geração.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">2. Cadastro e Conta</h4>
                <p>O usuário deve criar uma conta com email e senha. É responsável pela confidencialidade de suas credenciais e por todas as atividades na conta. Declara ser maior de 18 anos ou ter autorização legal.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">3. Uso do Serviço</h4>
                <p>A plataforma gera campanhas visuais automatizadas. O lojista reconhece que as campanhas são geradas por IA e devem ser revisadas antes da publicação. É proibido gerar conteúdo que viole a Política de Uso Aceitável.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">4. Propriedade Intelectual</h4>
                <p>A plataforma é propriedade exclusiva do Vendeo. O conteúdo fornecido pelo usuário permanece de propriedade do usuário. O usuário concede ao Vendeo licença não exclusiva para processar seu conteúdo exclusivamente para prestação do serviço.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">5. Limitação de Responsabilidade</h4>
                <p>A plataforma é fornecida "no estado em que se encontra". O Vendeo não se responsabiliza pelo conteúdo gerado por IA. A responsabilidade máxima está limitada ao valor efetivamente pago nos 12 meses anteriores.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">6. Cancelamento</h4>
                <p>O usuário pode cancelar sua conta a qualquer momento. O Vendeo pode suspender ou cancelar o acesso em caso de violação dos termos. Após cancelamento, o conteúdo gerado não é mantido por prazo superior a 90 dias.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">7. Disposições Gerais</h4>
                <p>Estes termos são regidos pela legislação brasileira. Alterações serão comunicadas ao usuário. A aceitação dos termos é condição necessária para criação da loja e uso dos recursos de geração.</p>
              </div>
            </div>
          </section>

          {/* Uso Aceitável */}
          <section>
            <h3 className="font-heading font-semibold text-text-primary mb-2">Política de Uso Aceitável</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">1. Propósito</h4>
                <p>Esta política estabelece as regras para utilização da Plataforma Vendeo e complementa os Termos de Uso.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">2. Restrições de Conteúdo</h4>
                <p>É proibido gerar campanhas que contenham nudez, conteúdo sexual explícito, violência, discurso de ódio, atividades ilegais, plágio, desinformação, conteúdo enganoso ou conteúdo restrito a menores.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">3. Conduta Proibida</h4>
                <p>Não é permitido enviar spam, burlar sistemas de rate limit/autenticação/créditos, realizar engenharia reversa, usar bots ou scrapers, criar múltiplas contas para contornar restrições, ou compartilhar credenciais.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">4. Sanções</h4>
                <p>A violação pode resultar em advertência, suspensão temporária, cancelamento da conta ou da loja. Violações graves podem resultar em cancelamento imediato sem reembolso.</p>
              </div>
              <div>
                <h4 className="font-heading font-medium text-text-primary text-xs uppercase tracking-wide mb-1">5. Responsabilidade do Usuário</h4>
                <p>O lojista é o único responsável pelo conteúdo das campanhas geradas e publicadas, devendo garantir que cumprem o Código de Defesa do Consumidor e regulamentações do CONAR.</p>
              </div>
            </div>
          </section>
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
              Li e aceito os Termos de Uso e a Política de Uso Aceitável.
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
