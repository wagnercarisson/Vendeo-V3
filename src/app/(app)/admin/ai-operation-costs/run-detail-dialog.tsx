"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type {
  EconomicValueSource,
  OperationRunDetail,
  OperationRunEvent,
} from "@/lib/ai-cost/operation-runs-service";
import { formatDateTimeBR } from "@/lib/formatters";
import { CostBadge } from "./cost-badge";

function formatBRL(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUsd(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `US$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR");
}

/**
 * Rótulo de origem do valor por evento (D8) — a UI apenas exibe a origem que
 * vem do service; nunca infere:
 *   economic_parameter_fallback → "parâmetro atual" (fallback em leitura)
 *   backfilled_*               → "reconstruído"
 *   captured/null              → "capturado" (snapshot real da geração)
 */
function eventOriginLabel(source: EconomicValueSource | null): string {
  if (source === "economic_parameter_fallback") return "parâmetro atual";
  if (source !== null && source.startsWith("backfilled")) return "reconstruído";
  return "capturado";
}

interface RunDetailDialogProps {
  operationRunId: string;
  onClose: () => void;
}

/**
 * Drilldown call-level de uma entrega (D4) — fetch ao GET
 * /api/admin/ai-operation-runs/[operationRunId] sob demanda (clique).
 * Placeholder F38.3 (D7) no cabeçalho do run: "Custo estimado Vendeo" /
 * "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente".
 */
export function RunDetailDialog({
  operationRunId,
  onClose,
}: RunDetailDialogProps) {
  const [detail, setDetail] = useState<OperationRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/admin/ai-operation-runs/${operationRunId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Erro ${res.status}`);
        }
        const body = (await res.json()) as OperationRunDetail;
        if (!cancelled) setDetail(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar o detalhe",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [operationRunId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes da entrega ${operationRunId}`}
      data-testid="run-detail-dialog"
    >
      <div className="mt-8 w-full max-w-4xl rounded-lg border border-border bg-bg-surface p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Detalhe da entrega</h3>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{operationRunId}</span>
              {detail?.run?.createdAt
                ? ` — ${formatDateTimeBR(detail.run.createdAt)}`
                : ""}
            </p>
            {detail?.run && (
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <p>
                  Custo estimado Vendeo:{" "}
                  {detail.run.custoBrl !== null
                    ? formatBRL(detail.run.custoBrl)
                    : "—"}
                </p>
                {detail.run.creditosDebitados !== null && (
                  <>
                    <p>{`Créditos: bruto ${formatNumber(detail.run.creditosDebitados)} · estorno ${formatNumber(detail.run.creditosEstornados)} · líquido ${formatNumber(detail.run.creditosLiquidos)}`}</p>
                    <p>{`Receita estimada ${formatBRL(detail.run.receitaEstimadaBrl)} · Resultado estimado ${formatBRL(detail.run.resultadoEstimadoBrl)}`}</p>
                    {/* Origem do valor (D8/T-38.2.1-15) — do service; fallback nunca sem marcação */}
                    {detail.run.creditValueSource === "economic_parameter_fallback" && (
                      <p>Origem: estimado de parâmetro atual (fallback)</p>
                    )}
                    {detail.run.creditValueSource.startsWith("backfilled") && (
                      <p>Origem: reconstruído de histórico</p>
                    )}
                  </>
                )}
                <p>Custo reconciliado provider: ainda indisponível</p>
                <p>Diferença: pendente</p>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar detalhe"
            className="rounded-md border border-border p-1 text-muted-foreground hover:bg-bg-elevated"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando detalhes…
          </p>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && detail && (
          <EventTable events={detail.events} />
        )}
        {!loading && !error && detail && detail.events.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma chamada registrada para esta entrega.
          </p>
        )}
      </div>
    </div>
  );
}

function EventTable({ events }: { events: OperationRunEvent[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-bg-surface text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Etapa</th>
            <th className="px-3 py-2 font-medium">Provider/Model</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Tokens</th>
            <th className="px-3 py-2 font-medium">Duração</th>
            <th className="px-3 py-2 font-medium">Custo (USD)</th>
            <th className="px-3 py-2 font-medium">Custo (BRL)</th>
            <th className="px-3 py-2 font-medium">Câmbio</th>
            <th className="px-3 py-2 font-medium">Text/Image</th>
            <th className="px-3 py-2 font-medium">Confiança</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {events.map((event, i) => (
            <tr key={i} data-testid={`event-row-${i}`}>
              <td className="px-3 py-2">{event.generationType ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {event.provider && event.model
                  ? `${event.provider}/${event.model}`
                  : (event.provider ?? event.model ?? "—")}
              </td>
              <td className="px-3 py-2">{event.status ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {formatNumber(event.totalTokens)}
                {event.imageTokens ? ` (+${event.imageTokens} img)` : ""}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {formatDuration(event.durationMs)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {formatUsd(event.estimatedCostUsd)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {formatBRL(event.estimatedCostBrl)}
              </td>
              {/* Snapshot econômico do evento (F38.2.1) — taxa usada + origem; ausente → fallback explícito */}
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                {event.usdBrlRateAtGeneration !== null ? (
                  <span
                    title={`Taxa de câmbio usada no custo BRL (origem: ${event.usdBrlRateSourceAtGeneration ?? "captured_at_generation"})`}
                  >
                    {event.usdBrlRateAtGeneration.toLocaleString("pt-BR")} ·{" "}
                    {eventOriginLabel(event.usdBrlRateSourceAtGeneration)}
                  </span>
                ) : (
                  <span title="Sem snapshot no evento — custo BRL derivado do parâmetro econômico corrente">
                    parâmetro atual (fallback)
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                {event.textComponentUsd !== null ? (
                  <span title="Componente de texto">T {formatUsd(event.textComponentUsd)}</span>
                ) : null}
                {event.imageToolComponentUsd !== null ? (
                  <span title="Componente de ferramenta de imagem">
                    {" "}
                    · I {formatUsd(event.imageToolComponentUsd)}
                  </span>
                ) : null}
                {event.textComponentUsd === null &&
                event.imageToolComponentUsd === null
                  ? "—"
                  : null}
              </td>
              <td className="px-3 py-2">
                <CostBadge badge={event.badge} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
