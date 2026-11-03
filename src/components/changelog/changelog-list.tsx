import type { ChangelogEntry } from "@/lib/changelog/types";
import { ChangelogCard, type ChangelogCardLabels } from "./changelog-card";

interface ChangelogListProps {
  entries: ChangelogEntry[];
  labels?: Partial<ChangelogCardLabels>;
  emptyLabel?: string;
}

const DEFAULT_EMPTY_LABEL = "Nenhuma novidade por enquanto.";

/**
 * Lista de ChangelogCard na ordem recebida (já ordenada por data DESC no
 * server). Array vazio renderiza estado tratado — não lança. Os rótulos são
 * opcionais e mantêm pt-BR como padrão para consumidores não traduzidos.
 */
export function ChangelogList({
  entries,
  labels,
  emptyLabel = DEFAULT_EMPTY_LABEL,
}: ChangelogListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-text-muted font-body">{emptyLabel}</div>
    );
  }

  return (
    <div className="space-y-6">
      {entries.map((entry) => (
        <ChangelogCard
          key={entry.frontmatter.id}
          entry={entry}
          labels={labels}
        />
      ))}
    </div>
  );
}
