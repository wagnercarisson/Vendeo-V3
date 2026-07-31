"use client";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { useChangelogState } from "@/hooks/use-changelog-state";
import { formatChangelogDate } from "@/lib/changelog/format-date";
import { renderMarkdown } from "@/lib/changelog/render-markdown";
import type { ChangelogEntry } from "@/lib/changelog/types";

interface ChangelogAnnouncementProps {
  entry: ChangelogEntry | null;
}

/**
 * Anúncio contextual (D4): card discreto (padrão) ou modal (exceção) exibido
 * apenas quando `announcement !== "none"` e `isAnnouncementVisible(id)`.
 * "Ver novidades" → /novidades; × → dismissAnnouncement (não altera
 * lastSeenId). Entry null/none → null (não quebra).
 */
export function ChangelogAnnouncement({ entry }: ChangelogAnnouncementProps) {
  const { dismissAnnouncement, isAnnouncementVisible } = useChangelogState();

  if (!entry || entry.frontmatter.announcement === "none") return null;
  if (!isAnnouncementVisible(entry.frontmatter.id)) return null;

  const isModal = entry.frontmatter.announcement === "modal";

  const dismiss = () => dismissAnnouncement(entry.frontmatter.id);

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
        dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.body) }}
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
