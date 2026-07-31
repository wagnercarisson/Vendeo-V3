import { Sparkles } from "lucide-react";

import { ChangelogList } from "@/components/changelog/changelog-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  getAllEntries,
  getLatestAnnouncement,
} from "@/lib/changelog/get-changelog";
import { NovidadesClient } from "./novidades-client";

export default async function NovidadesPage() {
  const entries = await getAllEntries();
  const latestAnnouncement = await getLatestAnnouncement();

  const latestEntryId = entries[0]?.frontmatter.id ?? null;
  const latestAnnouncementId =
    latestAnnouncement?.frontmatter.id ?? undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novidades"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Novidades" },
        ]}
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhuma novidade por enquanto"
          description="Quando o Vendeo lançar algo novo, você verá aqui."
        />
      ) : (
        <ChangelogList entries={entries} />
      )}
      <NovidadesClient
        latestEntryId={latestEntryId}
        latestAnnouncementId={latestAnnouncementId}
      />
    </div>
  );
}
