"use client";

/**
 * Container ARIA tabs do onboarding de loja (F36) — D10/D11.
 *
 * - Estrutura WAI-ARIA: role="tablist" / role="tab" / role="tabpanel"
 *   com aria-selected, aria-controls e aria-labelledby (D11).
 * - Roving tabindex: apenas a aba ativa é tabulável; ArrowLeft/ArrowRight
 *   (ordem circular de TAB_ORDER), Home e End movem o foco (D11).
 * - Estado de cada aba exposto via aria-label (nunca cor sozinha); o motivo
 *   do bloqueio aparece APENAS no painel ativo (aria-describedby), nunca no
 *   botão da aba (D10).
 * - Região aria-live="polite" anuncia troca de aba/estado (D11).
 * - Variante mobile-compact: labels curtos (labelMobile), badge discreto
 *   (ponto no canto), botão "Continuar" fixo no rodapé do container e
 *   touch targets >= 44px (F22).
 *
 * Este componente é presentacional: NÃO deriva estado — recebe `tabs`,
 * `activeTab`, `states` e `onTabChange` via props (o estado por aba vem do
 * `useOnboardingTabs` da 36-03 / `computeTabState` da 36-02).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Lock,
} from "lucide-react";
import { TAB_ORDER } from "@/lib/store-onboarding/tabs";
import type {
  OnboardingTab,
  OnboardingTabDef,
  TabBlockReason,
} from "@/lib/store-onboarding/tabs";
import type { TabState } from "@/lib/store-onboarding/tab-state";

export interface StoreTabsProps {
  /** Defs das abas (tipicamente ONBOARDING_TABS) — ordem de renderização. */
  tabs: OnboardingTabDef[];
  /** Aba ativa (controlada pelo form/hook — não estado interno). */
  activeTab: OnboardingTab;
  /** Estado por aba (computeTabState) — drive de badges/aria-label. */
  states: Record<
    OnboardingTab,
    { state: TabState; reason?: TabBlockReason }
  >;
  /** Dispara troca de aba (clique, Enter/Space e "Continuar" no mobile). */
  onTabChange: (tab: OnboardingTab) => void;
  variant: "desktop" | "mobile-compact";
  /** Conteúdo do painel ativo (renderizado dentro do tabpanel do StoreTabs). */
  children?: ReactNode;
}

/** Rótulo de estado exibido no aria-label de cada aba (D11 — nunca cor sozinha). */
const STATE_LABEL: Record<TabState, string> = {
  blocked: "Bloqueada",
  draft: "Alterações não salvas",
  saved: "Salva",
  ready: "Pronta",
  pending_generation: "Pendente para gerar",
};

/** Badge compacto da variante desktop (D10 — nunca o texto completo do motivo). */
const DESKTOP_BADGE: Record<
  TabState,
  { text: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  blocked: {
    text: "Bloqueada",
    classes: "text-text-muted bg-bg-elevated border border-border-light",
    Icon: Lock,
  },
  draft: {
    text: "Não salvo",
    classes: "text-accent-amber bg-amber-900/20 border border-amber-700/30",
    Icon: Circle,
  },
  saved: {
    text: "Salva ✓",
    classes: "text-accent-green bg-green-900/20 border border-green-700/30",
    Icon: CheckCircle2,
  },
  ready: {
    text: "Pronta",
    classes: "text-accent-green bg-green-900/20 border border-green-700/30",
    Icon: CheckCircle2,
  },
  pending_generation: {
    text: "Pendente",
    classes: "text-accent-amber bg-amber-900/20 border border-amber-700/30",
    Icon: AlertCircle,
  },
};

/** Ponto discreto da variante mobile (canto do botão) — decorativo (aria-hidden). */
const MOBILE_DOT: Record<TabState, string> = {
  blocked: "bg-text-disabled",
  draft: "bg-accent-amber",
  saved: "bg-accent-green",
  ready: "bg-accent-green",
  pending_generation: "bg-accent-amber",
};

/** Texto do motivo exibido no painel ativo (D10 — nunca no botão da aba). */
const REASON_TEXT: Record<TabBlockReason, string> = {
  needs_legal_acceptance:
    "Esta etapa exige o aceite legal dos Termos de Uso e da Política de Uso Aceitável.",
  needs_tone_of_voice:
    "Defina o tom de voz na aba anterior para liberar esta etapa.",
  needs_store_created:
    "Salve os dados básicos da loja para liberar esta etapa.",
  fiscal_pending:
    "Cadastro fiscal pendente. A navegação está livre, mas a geração de campanhas é liberada após o CNPJ.",
};

const GENERIC_BLOCK_TEXT =
  "Esta etapa ainda não está liberada. Complete os passos anteriores.";

export function StoreTabs({
  tabs,
  activeTab,
  states,
  onTabChange,
  variant,
  children,
}: StoreTabsProps) {
  const isMobile = variant === "mobile-compact";

  const activeDef = tabs.find((t) => t.id === activeTab);
  const activeState =
    states[activeTab] ?? { state: "blocked" as TabState };
  const activeStateLabel =
    STATE_LABEL[activeState.state] ?? "Sem estado";

  const tabRefs = useRef<
    Partial<Record<OnboardingTab, HTMLButtonElement | null>>
  >({});

  // Região aria-live (D11): anuncia troca de aba/estado.
  const announcement = `Aba ${activeDef?.label ?? activeTab} — ${activeStateLabel}`;
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    if (announcement !== announced) {
      setAnnounced(announcement);
    }
  }, [announcement, announced]);

  /** Roving tabindex: ArrowLeft/ArrowRight circular, Home/End — move foco, não seleciona. */
  const handleTablistKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (currentIndex === -1) return;

      let nextIndex = -1;
      if (e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % TAB_ORDER.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = TAB_ORDER.length - 1;
      } else {
        return;
      }

      e.preventDefault();
      const nextTab = TAB_ORDER[nextIndex];
      const nextButton = tabRefs.current[nextTab];
      if (nextButton) {
        nextButton.focus();
      }
    },
    [activeTab],
  );

  /** Enter/Space selecionam a aba (o clique cobre o mouse; keydown cobre teclado). */
  const handleTabKeyDown = useCallback(
    (tab: OnboardingTab) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onTabChange(tab);
      }
    },
    [onTabChange],
  );

  const currentIndex = TAB_ORDER.indexOf(activeTab);
  const nextTabId =
    currentIndex !== -1 && currentIndex < TAB_ORDER.length - 1
      ? TAB_ORDER[currentIndex + 1]
      : undefined;
  const prevTabId =
    currentIndex > 0 ? TAB_ORDER[currentIndex - 1] : undefined;
  const nextDef = tabs.find((t) => t.id === nextTabId);
  const prevDef = tabs.find((t) => t.id === prevTabId);

  const blockedReason = activeState.reason
    ? REASON_TEXT[activeState.reason]
    : GENERIC_BLOCK_TEXT;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Abas da loja"
        onKeyDown={handleTablistKeyDown}
        className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const tabState = states[tab.id] ?? {
            state: "blocked" as TabState,
          };
          const stateLabel =
            STATE_LABEL[tabState.state] ?? "Sem estado";
          const badge = DESKTOP_BADGE[tabState.state];
          const BadgeIcon = badge.Icon;
          const isBlocked = tabState.state === "blocked";
          // O motivo do bloqueio vive no painel ativo — aria-describedby só
          // aponta quando este botão É o painel ativo (deep-link bloqueado).
          const describedBy =
            isBlocked && isActive ? `reason-${tab.id}` : undefined;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              aria-label={`${tab.label} — ${stateLabel}`}
              aria-describedby={describedBy}
              tabIndex={isActive ? 0 : -1}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={handleTabKeyDown(tab.id)}
              className={`relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-heading font-medium transition-colors duration-200 cursor-pointer ${
                isActive
                  ? "bg-bg-elevated text-text-primary border border-border-light"
                  : "text-text-muted border border-transparent hover:bg-bg-elevated/60 hover:text-text-primary"
              }`}
            >
              <span>{isMobile ? tab.labelMobile : tab.label}</span>

              {isMobile ? (
                <span
                  aria-hidden="true"
                  className={`absolute right-2 top-2 h-2 w-2 rounded-full ${
                    MOBILE_DOT[tabState.state]
                  }`}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-heading font-medium border ${badge.classes}`}
                >
                  <BadgeIcon className="h-3 w-3" />
                  {badge.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="mt-6 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
      >
        {/* Motivo do bloqueio no painel ATIVO (D10) — alvo de aria-describedby */}
        {activeState.state === "blocked" && (
          <div
            id={`reason-${activeTab}`}
            className="mb-4 flex items-start gap-3 rounded-lg border border-amber-700/30 bg-amber-900/20 px-4 py-3"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" />
            <div>
              <p className="text-sm font-heading font-semibold text-accent-amber">
                Etapa bloqueada
              </p>
              <p className="mt-0.5 text-xs font-body text-text-secondary">
                {blockedReason}
              </p>
            </div>
          </div>
        )}

        {children}

        {/* Barra "Continuar" fixa no rodapé do container (mobile compacto — D10/F22) */}
        {isMobile && (
          <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-border bg-bg-deep/95 px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => prevTabId && onTabChange(prevTabId)}
              disabled={!prevTabId}
              aria-label={
                prevDef
                  ? `Voltar para ${prevDef.labelMobile}`
                  : undefined
              }
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors duration-200 cursor-pointer hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => nextTabId && onTabChange(nextTabId)}
              disabled={!nextTabId}
              aria-label={
                nextDef
                  ? `Continuar para ${nextDef.labelMobile}`
                  : undefined
              }
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 text-sm font-heading font-semibold text-white transition-all duration-200 cursor-pointer hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {nextDef ? `Continuar: ${nextDef.labelMobile}` : "Continuar"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Região aria-live (D11) — anúncio de troca de aba/estado para leitores de tela */}
      <span className="sr-only" aria-live="polite">
        {announced}
      </span>
    </div>
  );
}
