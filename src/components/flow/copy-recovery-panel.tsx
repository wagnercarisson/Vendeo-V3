"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  LifeBuoy,
  Loader2,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { NewFlowCopyRecoveryState } from "@/lib/campaign/display";

/**
 * F56.2b2a (B2.1 / Plano 04, UI-SPEC §Surface / §Interaction / §Copywriting) —
 * Superfície de RECUPERAÇÃO de copy no resultado persistido.
 *
 * Componente client PRESENTACIONAL (G-NA): NÃO importa `product-1-1`; recebe a
 * view e os callbacks por props (como `resolution-form.tsx` da b1b). Renderiza os
 * 7 estados com badge/ícone/cor EXATOS da UI-SPEC, a CTA secundária condicional
 * `Gerar os textos novamente`, os contadores auto/manual (JetBrains Mono 12px), a
 * contagem REPORTADA pelo servidor (`aguardando`) e o aviso de escopo.
 *
 * Regras duras: a falha de copy é SEMPRE amber (nunca vermelho); `interrompida`
 * NUNCA usa spinner; a CTA fica `disabled` + `aria-disabled="true"` em
 * `ativa`/`aguardando`/`indeterminada` e no limite manual; NÃO se promete
 * continuidade/retomada automática.
 */

export interface CopyRecoveryPanelProps {
  readonly state: NewFlowCopyRecoveryState;
  readonly autoAttempts: number;
  readonly manualAttempts: number;
  /** Espera REPORTADA pelo servidor (ms) — a UI apenas reflete (sem inferência). */
  readonly waitRemainingMs: number;
  /** Habilita o CTA manual (estado permite + há manual restante). */
  readonly canRetry: boolean;
  readonly onRecover: () => void;
  /** Re-verificação query-only do estado (ação do `indeterminada`). */
  readonly onVerify?: () => void;
  readonly supportEmail?: string;
}

const MANUAL_LIMIT = 3;
const SCOPE_NOTICE =
  "Isso gera apenas os textos. A imagem da campanha não muda e nenhum crédito adicional é usado.";
const MANUAL_LIMIT_MESSAGE =
  "Você atingiu o limite de tentativas. Fale com o suporte para continuar.";

type Tone = "green" | "blue" | "amber";

const badgeClasses: Record<Tone, string> = {
  green: "bg-accent-green/10 text-accent-green",
  blue: "bg-accent-blue/10 text-accent-blue",
  amber: "bg-accent-amber/10 text-accent-amber",
};

const bannerClasses: Record<Tone, string> = {
  green: "border-accent-green/30 bg-accent-green/10",
  blue: "border-accent-blue/30 bg-accent-blue/10",
  amber: "border-accent-amber/30 bg-accent-amber/10",
};

const bannerIconClasses: Record<Tone, string> = {
  green: "text-accent-green",
  blue: "text-accent-blue",
  amber: "text-accent-amber",
};

const feedbackTextClasses: Record<Tone, string> = {
  green: "text-accent-green",
  blue: "text-accent-blue",
  amber: "text-accent-amber",
};

interface StatePresentation {
  readonly tone: Tone;
  readonly badge: string;
  readonly feedback: string;
  /** `true` quando o estado bloqueia o CTA (`ativa`/`aguardando`/`indeterminada`). */
  readonly blocked: boolean;
  readonly showSpinner: boolean;
}

function presentState(
  state: NewFlowCopyRecoveryState,
  secondsRemaining: number,
): StatePresentation {
  switch (state) {
    case "concluida":
      return {
        tone: "green",
        badge: "Textos prontos",
        feedback: "Textos prontos.",
        blocked: true,
        showSpinner: false,
      };
    case "ativa":
      return {
        tone: "blue",
        badge: "Gerando os textos...",
        feedback: "Gerando os textos...",
        blocked: true,
        showSpinner: true,
      };
    case "aguardando":
      return {
        tone: "blue",
        badge: "Nova tentativa em andamento",
        feedback: `Nova tentativa em ${secondsRemaining}s...`,
        blocked: true,
        showSpinner: false,
      };
    case "indeterminada":
      return {
        tone: "amber",
        badge: "Não foi possível verificar agora",
        feedback: "Não foi possível verificar agora. Tente novamente em instantes.",
        blocked: true,
        showSpinner: false,
      };
    case "falha_definitiva":
      return {
        tone: "amber",
        badge: "Não dá para tentar automaticamente",
        feedback: "Não foi possível gerar os textos automaticamente.",
        blocked: false,
        showSpinner: false,
      };
    case "falha":
      return {
        tone: "amber",
        badge: "Não conseguimos gerar os textos",
        feedback: "Não conseguimos gerar os textos desta campanha.",
        blocked: false,
        showSpinner: false,
      };
    case "interrompida":
      return {
        tone: "amber",
        badge: "Recuperação interrompida",
        feedback: "A recuperação foi interrompida. Você pode tentar novamente.",
        blocked: false,
        showSpinner: false,
      };
  }
}

function StateIcon({ state, tone }: { state: NewFlowCopyRecoveryState; tone: Tone }) {
  const cls = `h-5 w-5 shrink-0 mt-0.5 ${bannerIconClasses[tone]}`;
  if (state === "ativa") return <Loader2 className={`${cls} animate-spin`} aria-hidden="true" />;
  if (state === "concluida") return <Check className={cls} aria-hidden="true" />;
  if (state === "falha_definitiva") return <ShieldAlert className={cls} aria-hidden="true" />;
  if (state === "aguardando") return <Clock className={cls} aria-hidden="true" />;
  return <AlertTriangle className={cls} aria-hidden="true" />;
}

export function CopyRecoveryPanel({
  state,
  autoAttempts,
  manualAttempts,
  waitRemainingMs,
  canRetry,
  onRecover,
  onVerify,
  supportEmail,
}: CopyRecoveryPanelProps) {
  const secondsRemaining = Math.max(0, Math.ceil(waitRemainingMs / 1000));
  const presentation = presentState(state, secondsRemaining);
  const manualLimitReached = manualAttempts >= MANUAL_LIMIT;
  // CTA desabilitado em estados bloqueantes OU no limite manual / sem permissão.
  const ctaDisabled = presentation.blocked || !canRetry || manualLimitReached;
  const showSupport = Boolean(
    supportEmail && (manualLimitReached || state === "falha_definitiva"),
  );

  return (
    <Card>
      <section aria-labelledby="copy-recovery-heading" className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <h2
            id="copy-recovery-heading"
            className="text-sm font-medium uppercase tracking-wider text-text-muted font-heading"
          >
            Copy da campanha
          </h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-heading ${badgeClasses[presentation.tone]}`}
          >
            {presentation.badge}
          </span>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={`w-full rounded-lg border px-4 py-4 ${bannerClasses[presentation.tone]}`}
        >
          <div className="flex items-start gap-3">
            <StateIcon state={state} tone={presentation.tone} />
            <div className="flex-1 space-y-3">
              <p
                className={`text-sm font-body ${feedbackTextClasses[presentation.tone]}`}
              >
                {presentation.feedback}
              </p>

              {state === "aguardando" && (
                <p
                  role="timer"
                  aria-live="off"
                  className="font-mono text-xs text-text-secondary"
                >
                  {secondsRemaining}s
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="font-mono text-xs text-text-secondary">
          Tentativas automáticas: {autoAttempts} de {MANUAL_LIMIT}
        </p>
        <p className="font-mono text-xs text-text-secondary">
          Tentativas manuais: {manualAttempts} de {MANUAL_LIMIT}
        </p>

        <p className="text-sm text-text-muted font-body">{SCOPE_NOTICE}</p>

        {manualLimitReached && (
          <p className="text-sm text-accent-amber font-body">{MANUAL_LIMIT_MESSAGE}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRecover}
            disabled={ctaDisabled}
            aria-disabled={ctaDisabled ? "true" : undefined}
            className={ctaDisabled ? "cursor-not-allowed" : undefined}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Gerar os textos novamente
          </Button>

          {state === "indeterminada" && onVerify && (
            <Button variant="ghost" size="sm" onClick={onVerify}>
              Verificar novamente
            </Button>
          )}

          {showSupport && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                window.location.href = `mailto:${supportEmail}`;
              }}
            >
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
              Falar com o suporte
            </Button>
          )}
        </div>
      </section>
    </Card>
  );
}
