"use client";

/**
 * Coluna lateral global de aceite legal do onboarding (F36) — D3.
 *
 * - Estado recebido via prop (`acceptance`) — este componente NÃO deriva
 *   estado internamente. A derivação via `getAcceptanceStatus` da F30
 *   (`current`→accepted, `outdated`→needs_reacceptance, `never`→pending)
 *   acontece no form/página (task 3 do 36-04).
 * - Desktop: coluna `lg:sticky top-6` dentro do grid (`grid grid-cols-1
 *   lg:grid-cols-5` — participa do layout).
 * - Mobile: bloco compacto no topo do painel ativo, sem sticky.
 * - CTA "Revisar e aceitar" ("Revisar aceite" no reaceite) abre o
 *   ContractAcceptanceModal da F30 via `onOpenModal()`; `aria-expanded`/
 *   `aria-pressed` sinalizam o gatilho (open opcional — controlado pelo form).
 * - Estado nunca é cor sozinha: badge com ícone + label + aria-label no card.
 */

import { AlertCircle, AlertTriangle, CheckCircle2, FileText, RefreshCw, Shield } from "lucide-react";

export type LegalAcceptanceState =
  | "pending"
  | "accepted"
  | "needs_reacceptance";

export interface LegalAcceptancePanelProps {
  /** Estado derivado da F30 (getAcceptanceStatus) — nunca derivado aqui. */
  acceptance: LegalAcceptanceState;
  /** Abre o ContractAcceptanceModal (wiring F30 — task 3). */
  onOpenModal: () => void;
  variant: "desktop-sticky-column" | "mobile-compact";
  /**
   * Estado aberto do modal (controlado pelo form) — alimenta `aria-expanded`
   * do CTA. Opcional: se omitido, o CTA usa `aria-expanded={false}`.
   */
  open?: boolean;
  /**
   * Id único do card (ex.: "aceite-legal" desktop / "aceite-legal-mobile").
   * O card é focável programaticamente (tabIndex={-1}) para foco/scroll ao
   * feedback de aceite pendente — fora da tab order.
   */
  panelId?: string;
}

const STATE_CONFIG: Record<
  LegalAcceptanceState,
  {
    label: string;
    description: string;
    badgeClasses: string;
    Icon: typeof CheckCircle2;
  }
> = {
  pending: {
    label: "Pendente",
    description:
      "Para liberar o Posicionamento da sua loja, revise e aceite os Termos de Uso e a Política de Uso Aceitável.",
    badgeClasses: "text-accent-amber bg-amber-900/20 border border-amber-700/30",
    Icon: AlertCircle,
  },
  accepted: {
    label: "Aceito",
    description:
      "Termos de Uso e Política de Uso Aceitável aceitos. Obrigado!",
    badgeClasses: "text-accent-green bg-green-900/20 border border-green-700/30",
    Icon: CheckCircle2,
  },
  needs_reacceptance: {
    label: "Reaceite necessário",
    description:
      "Os Termos de Uso foram atualizados. Para continuar usando o Vendeo, revise e reaceite.",
    badgeClasses: "text-accent-red bg-red-900/20 border border-red-700/30",
    Icon: AlertTriangle,
  },
};

export function LegalAcceptancePanel({
  acceptance,
  onOpenModal,
  variant,
  open,
  panelId,
}: LegalAcceptancePanelProps) {
  const config = STATE_CONFIG[acceptance];
  const StateIcon = config.Icon;
  const isMobile = variant === "mobile-compact";
  const showCta = acceptance !== "accepted";
  const ctaLabel =
    acceptance === "needs_reacceptance" ? "Revisar aceite" : "Revisar e aceitar";
  const CtaIcon = acceptance === "needs_reacceptance" ? RefreshCw : FileText;

  return (
    <div className={isMobile ? undefined : "lg:sticky lg:top-6"}>
      <section
        id={panelId}
        tabIndex={-1}
        aria-label={`Aceite legal — ${config.label}`}
        className={`bg-bg-surface border border-border rounded-xl ${
          isMobile ? "p-4" : "p-5"
        }`}
      >
        {isMobile ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Shield className="h-4 w-4 shrink-0 text-accent-green" />
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-heading font-medium ${config.badgeClasses}`}
              >
                <StateIcon className="h-3.5 w-3.5" />
                {config.label}
              </span>
            </div>
            {showCta && (
              <button
                type="button"
                onClick={onOpenModal}
                aria-haspopup="dialog"
                aria-expanded={open ?? false}
                className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 text-xs font-heading font-semibold text-white transition-all duration-200 cursor-pointer hover:brightness-110"
              >
                <CtaIcon className="h-3.5 w-3.5" />
                {ctaLabel}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0 text-accent-green" />
              <h2 className="text-sm font-heading font-semibold text-text-primary">
                Aceite Legal
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-heading font-medium ${config.badgeClasses}`}
              >
                <StateIcon className="h-3.5 w-3.5" />
                {config.label}
              </span>
            </div>

            <p className="text-xs font-body text-text-muted">
              {config.description}
            </p>

            {showCta && (
              <button
                type="button"
                onClick={onOpenModal}
                aria-haspopup="dialog"
                aria-expanded={open ?? false}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 text-sm font-heading font-semibold text-white transition-all duration-200 cursor-pointer hover:brightness-110"
              >
                <CtaIcon className="h-4 w-4" />
                {ctaLabel}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
