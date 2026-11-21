"use client";

/**
 * F61 — Chips COMPARTILHADOS de apresentação dos formatos `1:1` e `9:16`.
 *
 * Sempre renderiza os dois formatos na ordem canônica, com nome, rótulo de
 * estado, ícone e uma explicação acessível (hover/foco/toque). O único estado
 * local é a explicação aberta/fechada; NÃO há fetch, Storage, server action,
 * geração, reserva ou qualquer efeito mutável.
 *
 * Lista/dashboard: sem `hrefs` ⇒ chips informativos. Detalhe: `href` SOMENTE
 * para formato `delivered`.
 */

import { useId, useState, type FocusEvent, type ReactElement } from "react";
import {
  Check,
  CircleHelp,
  CircleSlash,
  Loader2,
  Undo2,
  type LucideIcon,
} from "lucide-react";

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
}

const FORMAT_ORDER: readonly CampaignFormatKey[] = ["1:1", "9:16"];

const BASE_CHIP_CLASS =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

function stateClasses(entry: CampaignFormatPresentationEntry): string {
  switch (entry.state) {
    case "delivered":
      return "text-accent-green bg-accent-green/10 border-accent-green/30";
    case "processing":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "absent":
      return "text-text-muted bg-bg-elevated border-border";
    case "unknown":
    case "unavailable":
      return "border-dashed border-border text-text-muted";
  }
}

function activeClasses(entry: CampaignFormatPresentationEntry): string {
  return entry.active ? "ring-2 ring-accent-green" : "";
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

function StateIcon({
  entry,
}: {
  readonly entry: CampaignFormatPresentationEntry;
}): ReactElement {
  let Icon: LucideIcon = CircleSlash;
  if (entry.state === "delivered") Icon = Check;
  else if (entry.state === "processing") Icon = Loader2;
  else if (entry.state === "unknown") Icon = CircleHelp;
  else if (entry.state === "absent" && entry.refunded) Icon = Undo2;
  return <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />;
}

function FormatChip({
  formatKey,
  entry,
  messages,
  href,
}: {
  readonly formatKey: CampaignFormatKey;
  readonly entry: CampaignFormatPresentationEntry;
  readonly messages: CampaignFormatPresentationMessages;
  readonly href: string | undefined;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const explanationId = useId();
  const name = messages.formats[formatKey].name;
  const visible = open || (!dismissed && (hovered || focused));
  const chipClass = [
    BASE_CHIP_CLASS,
    stateClasses(entry),
    activeClasses(entry),
  ]
    .filter(Boolean)
    .join(" ");
  const hasLink =
    typeof href === "string" && href.length > 0 && entry.state === "delivered";

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      setDismissed(true);
      return;
    }
    setOpen(true);
    setDismissed(false);
  };

  const handleFocus = (event: FocusEvent<HTMLLIElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setFocused(true);
    setDismissed(false);
  };

  const handleBlur = (event: FocusEvent<HTMLLIElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setFocused(false);
    setDismissed(false);
  };

  const chipContent = (
    <>
      <StateIcon entry={entry} />
      <span className="min-w-0 break-words">{name}</span>
      <span aria-hidden="true" className="text-text-muted">
        ·
      </span>
      <span className="min-w-0 break-words">{stateLabel(entry, messages)}</span>
      {entry.active ? (
        <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-xs font-semibold text-accent-green">
          {messages.activeLabel}
        </span>
      ) : null}
    </>
  );

  return (
    <li
      className="flex min-w-0 flex-wrap items-center gap-1"
      onMouseEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {hasLink ? (
        <a
          href={href}
          aria-current={entry.active ? "true" : undefined}
          className={chipClass}
        >
          {chipContent}
        </a>
      ) : (
        <span className={chipClass}>{chipContent}</span>
      )}

      <button
        type="button"
        aria-expanded={visible}
        aria-controls={explanationId}
        aria-label={`${messages.infoAria}: ${name}`}
        onClick={handleToggle}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-text-muted transition-colors duration-200 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep"
      >
        <CircleHelp aria-hidden="true" className="h-4 w-4" />
      </button>

      <p
        id={explanationId}
        role="note"
        hidden={!visible}
        className="w-full basis-full text-xs text-text-secondary font-body"
      >
        {explanation(entry, messages)}
      </p>
    </li>
  );
}

export function CampaignFormatChips({
  presentation,
  messages,
  hrefs,
}: CampaignFormatChipsProps): ReactElement {
  return (
    <ul
      aria-label={messages.groupLabel}
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      {FORMAT_ORDER.map((formatKey) => (
        <FormatChip
          key={formatKey}
          formatKey={formatKey}
          entry={presentation.formats[formatKey]}
          messages={messages}
          href={hrefs?.[formatKey]}
        />
      ))}
    </ul>
  );
}
