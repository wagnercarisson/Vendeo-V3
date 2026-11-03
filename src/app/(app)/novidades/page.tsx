import { Sparkles } from "lucide-react";

import { ChangelogList } from "@/components/changelog/changelog-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageUser } from "@/lib/auth/require-user";
import {
  getAllEntries,
  getLatestAnnouncement,
} from "@/lib/changelog/get-changelog";
import { getNovidadesMessages } from "@/lib/i18n/novidades";
import type { SupportedUiLocale } from "@/lib/i18n/locales";
import { getUiRenderContext } from "@/lib/i18n/server";
import { NovidadesClient } from "./novidades-client";

export default async function NovidadesPage() {
  const user = await requirePageUser();

  const [entries, latestAnnouncement, ui] = await Promise.all([
    getAllEntries(),
    getLatestAnnouncement(),
    getUiRenderContext(user.userId),
  ]);

  const locale: SupportedUiLocale = ui.ok ? ui.locale : "pt-BR";
  const messages = getNovidadesMessages(locale);
  const lang = locale === "es-419" ? "es-419" : undefined;

  const latestEntryId = entries[0]?.frontmatter.id ?? null;
  const latestAnnouncementId =
    latestAnnouncement?.frontmatter.id ?? undefined;

  return (
    <div lang={lang} className="mx-auto max-w-3xl">
      <PageHeader
        title={messages.title}
        breadcrumbs={[
          { label: messages.breadcrumbHome, href: "/dashboard" },
          { label: messages.title },
        ]}
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={messages.emptyTitle}
          description={messages.emptyBody}
        />
      ) : (
        <ChangelogList
          entries={entries}
          labels={messages.card}
          emptyLabel={messages.listEmpty}
        />
      )}
      <NovidadesClient
        latestEntryId={latestEntryId}
        latestAnnouncementId={latestAnnouncementId}
      />
    </div>
  );
}
