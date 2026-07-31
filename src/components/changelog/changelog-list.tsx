import type { ChangelogEntry } from "@/lib/changelog/types";
import { ChangelogCard } from "./changelog-card";

interface ChangelogListProps {
  entries: ChangelogEntry[];
}

/**
 * Lista de ChangelogCard na ordem recebida (já ordenada por data DESC no
 * server). Array vazio renderiza estado tratado — não lança.
 */
export function ChangelogList({ entries }: ChangelogListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-text-muted font-body">
        Nenhuma novidade por enquanto.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {entries.map((entry) => (
        <ChangelogCard key={entry.frontmatter.id} entry={entry} />
      ))}
    </div>
  );
}
