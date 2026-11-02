import { ChangelogAnnouncement } from "@/components/changelog/changelog-announcement";
import type { ChangelogEntry } from "@/lib/changelog/types";
import type { DashboardMessages } from "@/lib/i18n/dashboard";

interface DashboardNewsProps {
  entry: ChangelogEntry | null;
  excerpt: string | null;
  labels: DashboardMessages["news"];
}

/**
 * Wrapper server do anúncio compacto de novidades (F58).
 *
 * Renderiza quando existe entry com `announcement !== "none"`. O trecho pode
 * ser `null`: nesse caso título, data e ações permanecem. Nenhum corpo markdown
 * é propagado e `lastSeenId` não é alterado.
 */
export function DashboardNews({ entry, excerpt, labels }: DashboardNewsProps) {
  if (!entry || entry.frontmatter.announcement === "none") return null;

  return (
    <section aria-label={labels.sectionLabel}>
      <ChangelogAnnouncement
        entry={entry}
        compact
        excerpt={excerpt}
        labels={{
          view: labels.view,
          close: labels.close,
          dialogLabel: labels.sectionLabel,
        }}
      />
    </section>
  );
}
