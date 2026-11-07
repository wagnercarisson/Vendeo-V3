"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LabTable } from "../../../_components/lab-table";

/**
 * Histórico de expansões da loja (quick 261107-qvo). Reutiliza a listagem de
 * linhagens da bancada e filtra `operation === "expand"`.
 */

interface ExpandHistoryRun {
  id: string;
  status: string;
  attemptOfRunId: string | null;
  createdAt: string;
  finishedAt: string | null;
  operation: string | null;
  promptVersion: string | null;
  size: string | null;
  estimatedCostUsd: number | null;
}

interface ExpandLineage {
  rootId: string;
  runs: ExpandHistoryRun[];
}

interface BenchExpandHistoryPanelProps {
  storeId: string;
  refreshKey: number;
  selectedRunId?: string | null;
  onOpen: (runId: string) => void;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

export function BenchExpandHistoryPanel({
  storeId,
  refreshKey,
  selectedRunId = null,
  onOpen,
}: BenchExpandHistoryPanelProps) {
  const [runs, setRuns] = useState<ExpandHistoryRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/admin/laboratorio/bancada/runs?storeId=${encodeURIComponent(storeId)}`,
      { method: "GET" },
    )
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          lineages?: ExpandLineage[];
        };
        if (cancelled) return;
        if (!response.ok || !Array.isArray(data.lineages)) {
          setError("Não foi possível carregar o histórico de expansões.");
        } else {
          const all = data.lineages.flatMap((lineage) => lineage.runs);
          setRuns(
            all
              .filter((run) => run.operation === "expand")
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Não foi possível carregar o histórico de expansões.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, refreshKey]);

  return (
    <section
      data-testid="bench-expand-history-panel"
      className="space-y-3 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-expand-history-title"
    >
      <h2
        id="bench-expand-history-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Histórico de expansões
      </h2>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-text-secondary font-body">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando o histórico…
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-accent-red font-body">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {!loading && !error && runs.length === 0 && (
        <p className="text-sm text-text-secondary font-body">
          Nenhuma expansão registrada para esta loja.
        </p>
      )}

      {runs.length > 0 && (
        <LabTable
          caption="Expansões registradas"
          head={
            <>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Data
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Status
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Prompt
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Tamanho
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Ação
              </th>
            </>
          }
        >
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-border">
              <td className="px-3 py-2 text-xs text-text-secondary">
                {formatDate(run.createdAt)}
              </td>
              <td className="px-3 py-2 text-xs text-text-secondary">{run.status}</td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {run.promptVersion ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {run.size ?? "—"}
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid={`bench-expand-open-${run.id}`}
                  onClick={() => onOpen(run.id)}
                >
                  {selectedRunId === run.id ? "Selecionado" : "Abrir"}
                </Button>
              </td>
            </tr>
          ))}
        </LabTable>
      )}
    </section>
  );
}
