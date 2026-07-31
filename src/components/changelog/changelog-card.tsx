import { Card } from "@/components/ui/card";
import { formatChangelogDate } from "@/lib/changelog/format-date";
import { renderMarkdown } from "@/lib/changelog/render-markdown";
import type {
  ChangelogCategory,
  ChangelogEntry,
} from "@/lib/changelog/types";

const CATEGORY_LABEL: Record<ChangelogCategory, string> = {
  feature: "Nova funcionalidade",
  improvement: "Melhoria",
  fix: "Correção",
};

const CATEGORY_BADGE_CLASSES: Record<ChangelogCategory, string> = {
  feature: "bg-accent-green/10 text-accent-green border-accent-green/20",
  improvement: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  fix: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
};

interface ChangelogCardProps {
  entry: ChangelogEntry;
}

export function ChangelogCard({ entry }: ChangelogCardProps) {
  const { frontmatter } = entry;

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium font-heading ${CATEGORY_BADGE_CLASSES[frontmatter.category]}`}
        >
          {CATEGORY_LABEL[frontmatter.category]}
        </span>
        {frontmatter.milestone && (
          <span className="text-xs text-text-muted font-body">
            {frontmatter.milestone}
          </span>
        )}
      </div>

      <h2 className="font-heading text-lg font-semibold text-text-primary">
        {frontmatter.title}
      </h2>

      <div className="mt-1 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-muted font-body">
          {formatChangelogDate(frontmatter.date)}
        </span>
        {frontmatter.importance === "major" && (
          <span className="text-xs font-semibold text-accent-green">
            Importante
          </span>
        )}
      </div>

      <div
        className="space-y-3 font-body text-sm text-text-secondary [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-text-secondary"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.body) }}
      />
    </Card>
  );
}
