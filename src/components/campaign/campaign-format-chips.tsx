"use client";

/**
 * F61 — Chips COMPARTILHADOS de apresentação dos formatos `1:1` e `9:16`.
 *
 * Sempre renderiza os dois formatos na ordem canônica. O texto VISÍVEL do chip é
 * apenas o nome do formato (“Quadrado 1:1”/“Vertical 9:16”); o estado completo
 * permanece no `role="group"` (nome acessível), na descrição estável `hidden`
 * (`aria-describedby`) e na ajuda flutuante.
 *
 * A ajuda vive em um popover `createPortal` para `document.body`, `position:
 * fixed`, criado somente após o mount (SSR/`renderToString` nunca acessa
 * `document`). Não altera altura do card, linha dos chips, posição da arte nem
 * largura do contêiner. A única interação local é abrir/fechar a explicação;
 * NÃO há fetch, Storage, server action, geração, reserva ou efeito mutável.
 *
 * Lista/dashboard: sem `hrefs` ⇒ chips informativos. Detalhe: `href` SOMENTE
 * para formato `delivered`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Loader2, Undo2, type LucideIcon } from "lucide-react";

import type {
  CampaignFormatKey,
  CampaignFormatPresentation,
  CampaignFormatPresentationEntry,
} from "@/lib/campaign/format-presentation";
import type { CampaignFormatPresentationMessages } from "@/lib/i18n/campaign-formats/messages";

export interface CampaignFormatChipsProps {
  readonly presentation: CampaignFormatPresentation;
  readonly messages: CampaignFormatPresentationMessages;
  readonly hrefs?: Partial<Record<CampaignFormatKey, string>>;
  /** Idioma da região flutuante (ex.: "es-419"); o portal vive fora do wrapper. */
  readonly helpLang?: string;
}

const FORMAT_ORDER: readonly CampaignFormatKey[] = ["1:1", "9:16"];

/** Altura mínima de 44 px (hit area) preservada mesmo com aparência compacta. */
const BASE_CHIP_CLASS =
  "inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

const ACTIVE_CLASS = "ring-1 ring-accent-green/40 bg-accent-green/15";

/** “?” compacto (sem círculo/borda grande) com alvo 44×44 px. */
const HELP_BUTTON_CLASS =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-200 hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

const POPOVER_CLASS =
  "z-50 overflow-y-auto rounded-lg border border-border bg-bg-surface p-3 text-xs font-body text-text-secondary shadow-lg";

const CLOSE_DELAY_MS = 120;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
const MAX_POPOVER_WIDTH = 320;

function stateClasses(entry: CampaignFormatPresentationEntry): string {
  switch (entry.state) {
    case "delivered":
      return "text-text-primary bg-accent-green/10 border-accent-green/30";
    case "processing":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "absent":
      return "text-text-secondary bg-bg-elevated border-border";
    case "unknown":
    case "unavailable":
      return "border-dashed border-border text-text-secondary";
  }
}

function stateLabel(
  entry: CampaignFormatPresentationEntry,
  messages: CampaignFormatPresentationMessages,
): string {
  if (entry.state === "absent") {
    if (entry.refunded) return messages.labels.refunded;
    return entry.reason === "not_requested"
      ? messages.labels.notRequested
      : messages.labels.notDelivered;
  }
  switch (entry.state) {
    case "delivered":
      return messages.labels.delivered;
    case "processing":
      return messages.labels.processing;
    case "unknown":
      return messages.labels.unknown;
    case "unavailable":
      return messages.labels.unavailable;
  }
}

function explanation(
  entry: CampaignFormatPresentationEntry,
  messages: CampaignFormatPresentationMessages,
): string {
  if (entry.state === "delivered") {
    return entry.active
      ? messages.explanations.deliveredActive
      : messages.explanations.delivered;
  }
  if (entry.state === "absent") {
    if (entry.refunded) return messages.explanations.refunded;
    return entry.reason === "not_requested"
      ? messages.explanations.notRequested
      : messages.explanations.notDelivered;
  }
  switch (entry.state) {
    case "processing":
      return messages.explanations.processing;
    case "unknown":
      return messages.explanations.unknown;
    case "unavailable":
      return messages.explanations.unavailable;
  }
}

/** Descrição estável (estado + explicação) usada no nó `hidden`. */
function descriptionText(
  entry: CampaignFormatPresentationEntry,
  messages: CampaignFormatPresentationMessages,
): string {
  return `${stateLabel(entry, messages)}. ${explanation(entry, messages)}`;
}

function groupAccessibleName(
  entry: CampaignFormatPresentationEntry,
  name: string,
  messages: CampaignFormatPresentationMessages,
): string {
  const state = stateLabel(entry, messages);
  return entry.active
    ? `${name}: ${state}, ${messages.activeLabel}`
    : `${name}: ${state}`;
}

/**
 * Indicador PEQUENO apenas para estados excepcionais. Entregue/ausente normais
 * não recebem ícone; nunca há frase longa dentro do chip.
 */
function StateIndicator({
  entry,
}: {
  readonly entry: CampaignFormatPresentationEntry;
}): ReactElement | null {
  let Icon: LucideIcon | null = null;
  if (entry.state === "processing") Icon = Loader2;
  else if (entry.state === "unknown" || entry.state === "unavailable")
    Icon = CircleHelp;
  else if (entry.state === "absent" && entry.refunded) Icon = Undo2;

  if (!Icon) return null;
  return <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
}

export function CampaignFormatChips({
  presentation,
  messages,
  hrefs,
  helpLang,
}: CampaignFormatChipsProps): ReactElement {
  const [mounted, setMounted] = useState(false);
  const [activeKey, setActiveKey] = useState<CampaignFormatKey | null>(null);
  const [pinnedKey, setPinnedKey] = useState<CampaignFormatKey | null>(null);

  const groupRefs = useRef<Partial<Record<CampaignFormatKey, HTMLDivElement | null>>>(
    {},
  );
  const buttonRefs = useRef<
    Partial<Record<CampaignFormatKey, HTMLButtonElement | null>>
  >({});
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverHoveredRef = useRef(false);
  const pinnedKeyRef = useRef<CampaignFormatKey | null>(null);
  const activeKeyRef = useRef<CampaignFormatKey | null>(null);
  const suppressFocusRef = useRef<Partial<Record<CampaignFormatKey, boolean>>>(
    {},
  );

  const popoverId = useId();
  const squareDescriptionId = useId();
  const verticalDescriptionId = useId();
  const descriptionIds: Record<CampaignFormatKey, string> = {
    "1:1": squareDescriptionId,
    "9:16": verticalDescriptionId,
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    pinnedKeyRef.current = pinnedKey;
  }, [pinnedKey]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeAll = useCallback(() => {
    clearCloseTimer();
    pinnedKeyRef.current = null;
    setPinnedKey(null);
    setActiveKey(null);
    popoverHoveredRef.current = false;
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    if (pinnedKeyRef.current !== null) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (pinnedKeyRef.current !== null) return;
      if (popoverHoveredRef.current) return;
      setActiveKey(null);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const openTransient = useCallback(
    (key: CampaignFormatKey) => {
      clearCloseTimer();
      // Uma ajuda fixada permanece aberta; hover/foco de outro chip não a troca.
      if (pinnedKeyRef.current !== null) return;
      setActiveKey(key);
    },
    [clearCloseTimer],
  );

  const handlePointerEnter = useCallback(
    (key: CampaignFormatKey) => {
      openTransient(key);
    },
    [openTransient],
  );

  const handlePointerLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleFocus = useCallback(
    (key: CampaignFormatKey) => {
      if (suppressFocusRef.current[key]) {
        suppressFocusRef.current[key] = false;
        return;
      }
      openTransient(key);
    },
    [openTransient],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) return;
      scheduleClose();
    },
    [scheduleClose],
  );

  const handleToggle = useCallback(
    (key: CampaignFormatKey) => {
      clearCloseTimer();
      if (pinnedKeyRef.current === key) {
        closeAll();
        return;
      }
      // Primeiro acionamento após hover/foco FIXA a ajuda; sem hover (toque),
      // abre. Segundo acionamento fecha (ramo acima).
      pinnedKeyRef.current = key;
      setPinnedKey(key);
      setActiveKey(key);
    },
    [clearCloseTimer, closeAll],
  );

  const handlePopoverEnter = useCallback(() => {
    clearCloseTimer();
    popoverHoveredRef.current = true;
  }, [clearCloseTimer]);

  const handlePopoverLeave = useCallback(() => {
    popoverHoveredRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  const positionPopover = useCallback(() => {
    const key = activeKeyRef.current;
    if (!key) return;
    const anchor = buttonRefs.current[key];
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(
      MAX_POPOVER_WIDTH,
      Math.max(160, viewportWidth - VIEWPORT_MARGIN * 2),
    );

    // `max-width` CSS permanece o contrato do JSX (`min(20rem, calc(100vw -
    // 1rem))`); aqui usamos a largura apenas para centralização/clamp.
    popover.style.maxHeight = `${Math.max(80, viewportHeight - VIEWPORT_MARGIN * 2)}px`;

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const height = popoverRect.height || 0;

    const spaceAbove =
      anchorRect.top - VIEWPORT_MARGIN - ANCHOR_GAP;
    const spaceBelow =
      viewportHeight - anchorRect.bottom - VIEWPORT_MARGIN - ANCHOR_GAP;
    const openAbove = spaceAbove > spaceBelow && spaceAbove > 0;
    const available = Math.max(80, openAbove ? spaceAbove : spaceBelow);
    popover.style.maxHeight = `${Math.min(height || available, available)}px`;

    const top = openAbove
      ? anchorRect.top - ANCHOR_GAP - Math.min(height, available)
      : anchorRect.bottom + ANCHOR_GAP;
    let left = anchorRect.left + anchorRect.width / 2 - width / 2;
    left = Math.min(
      Math.max(VIEWPORT_MARGIN, left),
      Math.max(VIEWPORT_MARGIN, viewportWidth - VIEWPORT_MARGIN - width),
    );

    const maxTop = Math.max(
      VIEWPORT_MARGIN,
      viewportHeight - VIEWPORT_MARGIN - Math.min(height, available),
    );

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(Math.min(Math.max(VIEWPORT_MARGIN, top), maxTop))}px`;
  }, []);

  // Reposiciona e mantém a ajuda dentro da viewport ENQUANTO aberta. Os
  // listeners são removidos ao fechar/desmontar.
  useEffect(() => {
    if (!mounted || activeKey === null) return;

    positionPopover();
    const reposition = () => positionPopover();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [mounted, activeKey, positionPopover]);

  // `Escape` fecha e devolve o foco ao “?”. A guarda de supressão impede que o
  // foco devolvido reabra a ajuda imediatamente.
  useEffect(() => {
    if (!mounted || activeKey === null) return;
    const key = activeKey;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      suppressFocusRef.current[key] = true;
      closeAll();
      const button = buttonRefs.current[key];
      if (button) button.focus();
      window.setTimeout(() => {
        suppressFocusRef.current[key] = false;
      }, 0);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mounted, activeKey, closeAll]);

  // Clique/toque fora fecha; clique dentro do chip ou do popover não fecha.
  useEffect(() => {
    if (!mounted || activeKey === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (FORMAT_ORDER.some((key) => groupRefs.current[key]?.contains(target))) {
        return;
      }
      if (popoverRef.current?.contains(target)) return;
      closeAll();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mounted, activeKey, closeAll]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const activeEntry = activeKey ? presentation.formats[activeKey] : null;

  return (
    <>
      <ul
        aria-label={messages.groupLabel}
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        {FORMAT_ORDER.map((formatKey) => {
          const entry = presentation.formats[formatKey];
          const name = messages.formats[formatKey].name;
          const href = hrefs?.[formatKey];
          const hasLink =
            typeof href === "string" &&
            href.length > 0 &&
            entry.state === "delivered";
          const isOpen = activeKey === formatKey;
          const descriptionId = descriptionIds[formatKey];
          const chipClass = [
            BASE_CHIP_CLASS,
            stateClasses(entry),
            entry.active ? ACTIVE_CLASS : "",
          ]
            .filter(Boolean)
            .join(" ");

          const chipContent = (
            <>
              <StateIndicator entry={entry} />
              <span className="min-w-0 break-words">{name}</span>
            </>
          );

          return (
            <li key={formatKey} className="min-w-0">
              <div
                ref={(node) => {
                  groupRefs.current[formatKey] = node;
                }}
                role="group"
                aria-label={groupAccessibleName(entry, name, messages)}
                aria-describedby={descriptionId}
                className="flex min-w-0 flex-wrap items-center gap-1"
                onMouseEnter={() => handlePointerEnter(formatKey)}
                onMouseLeave={handlePointerLeave}
                onFocus={() => handleFocus(formatKey)}
                onBlur={handleBlur}
              >
                {hasLink && href ? (
                  <a
                    href={href}
                    aria-current={entry.active ? "true" : undefined}
                    aria-describedby={descriptionId}
                    className={chipClass}
                  >
                    {chipContent}
                  </a>
                ) : (
                  <span aria-describedby={descriptionId} className={chipClass}>
                    {chipContent}
                  </span>
                )}

                <button
                  type="button"
                  ref={(node) => {
                    buttonRefs.current[formatKey] = node;
                  }}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? popoverId : undefined}
                  aria-label={`${messages.infoAria}: ${name}, ${stateLabel(entry, messages)}`}
                  onClick={() => handleToggle(formatKey)}
                  className={HELP_BUTTON_CLASS}
                >
                  <CircleHelp aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <p
                id={descriptionId}
                hidden
                className="text-xs font-body text-text-secondary"
              >
                {descriptionText(entry, messages)}
              </p>
            </li>
          );
        })}
      </ul>

      {mounted && activeEntry
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="note"
              lang={helpLang}
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                maxWidth: "min(20rem, calc(100vw - 1rem))",
                maxHeight: "calc(100vh - 1rem)",
              }}
              className={POPOVER_CLASS}
              onMouseEnter={handlePopoverEnter}
              onMouseLeave={handlePopoverLeave}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <p className="font-heading text-xs font-semibold text-text-primary">
                {messages.formats[activeKey as CampaignFormatKey].name}
              </p>
              <p className="mt-1">{descriptionText(activeEntry, messages)}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
