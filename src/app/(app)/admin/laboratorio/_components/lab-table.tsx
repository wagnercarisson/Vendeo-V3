import type { ReactNode } from "react";

/**
 * Tabela nativa do laboratório (F48.1, D12/DV-5).
 *
 * Primitivo **local** — `src/components/ui/` permanece intocado nesta fase. Usa
 * `<table>`/`<thead>`/`<tbody>` semânticos: o consumidor passa os `<th scope="col">`
 * em `head` e as linhas `<tr>` em `children`. Dados numéricos/hash ficam em
 * `font-mono` no próprio consumidor. Rolagem horizontal em telas estreitas.
 */

interface LabTableProps {
  head: ReactNode;
  children: ReactNode;
  caption?: string;
  className?: string;
}

export function LabTable({
  head,
  children,
  caption,
  className = "",
}: LabTableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-border bg-bg-surface ${className}`}
    >
      <table className="w-full border-collapse text-left text-sm">
        {caption && (
          <caption className="px-3 py-2 text-left text-xs text-text-muted font-body">
            {caption}
          </caption>
        )}
        <thead>
          <tr className="bg-bg-elevated/60">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
