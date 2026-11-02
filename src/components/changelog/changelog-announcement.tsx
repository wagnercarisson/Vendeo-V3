"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useChangelogState } from "@/hooks/use-changelog-state";
import { formatChangelogDate } from "@/lib/changelog/format-date";
import { renderMarkdown } from "@/lib/changelog/render-markdown";
import type { ChangelogEntry } from "@/lib/changelog/types";

interface ChangelogAnnouncementLabels {
  view?: string;
  close?: string;
  dialogLabel?: string;
  badgeLabel?: string;
}

/**
 * No modo compacto o cliente recebe apenas os metadados do frontmatter; o
 * corpo markdown só é exigido no modo completo.
 */
export type ChangelogAnnouncementEntry =
  | ChangelogEntry
  | { frontmatter: ChangelogEntry["frontmatter"] };

interface ChangelogAnnouncementProps {
  entry: ChangelogAnnouncementEntry | null;
  compact?: boolean;
  excerpt?: string | null;
  labels?: ChangelogAnnouncementLabels;
}

/**
 * Anúncio contextual (D4): card discreto (padrão) ou modal (exceção) exibido
 * apenas quando `announcement !== "none"` e `isAnnouncementVisible(id)`.
 * "Ver novidades" → /novidades; × → dismissAnnouncement (não altera
 * lastSeenId). Entry null/none → null (não quebra).
 *
 * Modo compacto (F58): título, data e trecho editorial em texto React puro —
 * nunca `renderMarkdown`/`dangerouslySetInnerHTML`. `lang="pt-BR"` apenas no
 * título e no trecho; rótulos e ações permanecem no idioma da interface.
 */
export function ChangelogAnnouncement({
  entry,
  compact = false,
  excerpt = null,
  labels,
}: ChangelogAnnouncementProps) {
  const { dismissAnnouncement, isAnnouncementVisible } = useChangelogState();

  if (!entry || entry.frontmatter.announcement === "none") return null;
  if (!isAnnouncementVisible(entry.frontmatter.id)) return null;

  const isModal = entry.frontmatter.announcement === "modal";

  const dismiss = () => dismissAnnouncement(entry.frontmatter.id);

  const viewLabel = labels?.view ?? "Ver novidades";
  const closeLabel = labels?.close ?? "Fechar anúncio";
  const dialogLabel = labels?.dialogLabel ?? entry.frontmatter.title;

  if (compact) {
    const compactExcerpt = typeof excerpt === "string" ? excerpt.trim() : "";

    const compactContent = (
      <div className="min-w-0">
        {labels?.badgeLabel && (
          <span className="mb-2 inline-flex items-center rounded-md bg-accent-green/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-green font-heading">
            {labels.badgeLabel}
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <h2
            lang="pt-BR"
            className="font-heading text-xl font-semibold leading-tight text-text-primary line-clamp-2"
          >
            {entry.frontmatter.title}
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label={closeLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-200 hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 whitespace-nowrap text-xs text-text-secondary font-body">
          {formatChangelogDate(entry.frontmatter.date)}
        </p>
        {compactExcerpt !== "" && (
          <p
            lang="pt-BR"
            className="mt-2 break-words text-sm leading-normal text-text-secondary font-body"
          >
            {compactExcerpt}
          </p>
        )}
        <div className="mt-3">
          <Link
            href="/novidades"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep cursor-pointer"
          >
            {viewLabel}
          </Link>
        </div>
      </div>
    );

    if (isModal) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            className="w-full max-w-[480px] rounded-xl border border-border bg-bg-elevated p-6 shadow-xl"
          >
            {compactContent}
          </div>
        </div>
      );
    }

    return <Card className="p-4">{compactContent}</Card>;
  }

  if (!("body" in entry)) return null;
  const fullBody = entry.body;

  const closeButton = (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Fechar anúncio"
      className="flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-lg text-text-secondary transition-colors duration-200 hover:bg-bg-elevated hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none cursor-pointer"
    >
      ×
    </button>
  );

  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-text-primary">
          {entry.frontmatter.title}
        </h2>
        {closeButton}
      </div>
      <p className="mt-0.5 text-xs text-text-muted font-body">
        {formatChangelogDate(entry.frontmatter.date)}
      </p>
      <div
        className="mt-3 space-y-3 font-body text-sm text-text-secondary [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-text-secondary"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(fullBody) }}
      />
      <div className="mt-4">
        <Link
          href="/novidades"
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-green hover:underline focus:ring-2 focus:ring-accent-blue focus:outline-none cursor-pointer"
        >
          Ver novidades
        </Link>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={entry.frontmatter.title}
          className="w-full max-w-[480px] rounded-xl border border-border bg-bg-elevated p-6 shadow-xl"
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <Card className="mb-6 p-4 sm:p-6">
      <div className="flex items-start gap-4">{content}</div>
    </Card>
  );
}
