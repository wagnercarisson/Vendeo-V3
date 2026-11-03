import { Card } from "@/components/ui/card";
import { formatChangelogDate } from "@/lib/changelog/format-date";
import { renderMarkdown } from "@/lib/changelog/render-markdown";
import type {
  ChangelogCategory,
  ChangelogEntry,
} from "@/lib/changelog/types";

const CATEGORY_KEY: Record<
  ChangelogCategory,
  keyof ChangelogCardLabels
> = {
  feature: "categoryFeature",
  improvement: "categoryImprovement",
  fix: "categoryFix",
};

export interface ChangelogCardLabels {
  categoryFeature: string;
  categoryImprovement: string;
  categoryFix: string;
  important: string;
}

const DEFAULT_LABELS: ChangelogCardLabels = {
  categoryFeature: "Nova funcionalidade",
  categoryImprovement: "Melhoria",
  categoryFix: "Correção",
  important: "Importante",
};

const CATEGORY_BADGE_CLASSES: Record<ChangelogCategory, string> = {
  feature: "bg-accent-green/10 text-accent-green border-accent-green/20",
  improvement: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  fix: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
};

interface ChangelogCardProps {
  entry: ChangelogEntry;
  labels?: Partial<ChangelogCardLabels>;
}

export function ChangelogCard({ entry, labels }: ChangelogCardProps) {
  const { frontmatter } = entry;
  const text = { ...DEFAULT_LABELS, ...labels };

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium font-heading ${CATEGORY_BADGE_CLASSES[frontmatter.category]}`}
        >
          {text[CATEGORY_KEY[frontmatter.category]]}
        </span>
        {frontmatter.milestone && (
          <span lang="" className="text-xs text-text-muted font-body">
            {frontmatter.milestone}
          </span>
        )}
      </div>

      <h2
        lang="pt-BR"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        {frontmatter.title}
      </h2>

      <div className="mt-1 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-muted font-body">
          {formatChangelogDate(frontmatter.date)}
        </span>
        {frontmatter.importance === "major" && (
          <span className="text-xs font-semibold text-accent-green">
            {text.important}
          </span>
        )}
      </div>

      <div
        lang="pt-BR"
        className="space-y-3 font-body text-sm text-text-secondary [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-text-secondary"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.body) }}
      />
    </Card>
  );
}
