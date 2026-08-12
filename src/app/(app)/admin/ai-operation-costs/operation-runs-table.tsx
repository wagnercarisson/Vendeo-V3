"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { OperationRun } from "@/lib/ai-cost/operation-runs-service";
import { formatDateTimeBR } from "@/lib/formatters";
import { CostBadge } from "./cost-badge";
import { RunDetailDialog } from "./run-detail-dialog";

const OPERATION_TYPE_LABELS: Record<string, string> = {
  campaign_delivery: "Campanha",
  visual_signature: "Assinatura visual",
  brand_profile: "Perfil de marca",
  theme: "Tema",
};

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

function statusBadgeVariant(status: string | null) {
  if (status === "success") return "ready" as const;
  if (status === "failed") return "error" as const;
  return "default" as const;
}

function statusLabel(status: string | null): string {
  if (status === "success") return "Sucesso";
  if (status === "failed") return "Falha";
  return "—";
}

/**
 * Tabela por entrega (D3) — data, tipo, loja, status, custo (USD/BRL),
 * créditos, tempo, chamadas, regenerações, provider/model e badge de
 * confiança (D5). Linha clicável → drilldown call-level (D4).
 * Placeholder F38.3 (D7): colunas "Custo reconciliado provider: ainda
 * indisponível" e "Diferença: pendente".
 */
export function OperationRunsTable({ runs }: { runs: OperationRun[] }) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (runs.length === 0) return null;

  return (
    <section aria-label="Entregas" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Entregas</h2>
        <span className="text-xs text-muted-foreground">
          Clique numa entrega para ver o detalhe call-level
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Loja</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Custo (USD)</th>
              <th className="px-3 py-2 font-medium">Custo (BRL)</th>
              <th className="px-3 py-2 font-medium">Créditos</th>
              <th className="px-3 py-2 font-medium">Tempo</th>
              <th className="px-3 py-2 font-medium">Chamadas</th>
              <th className="px-3 py-2 font-medium">Regenerações</th>
              <th className="px-3 py-2 font-medium">Provider/Model</th>
              <th className="px-3 py-2 font-medium">Confiança</th>
              <th className="px-3 py-2 font-medium" title="F38.3 — reconciliação financeira futura">
                Custo reconciliado provider
              </th>
              <th className="px-3 py-2 font-medium" title="F38.3 — reconciliação financeira futura">
                Diferença
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => (
              <tr
                key={run.operationRunId}
                onClick={() => setSelectedRunId(run.operationRunId)}
                className="cursor-pointer hover:bg-bg-elevated"
                data-testid={`run-row-${run.operationRunId}`}
              >
                <td className="whitespace-nowrap px-3 py-2">
                  {run.createdAt ? formatDateTimeBR(run.createdAt) : "—"}
                </td>
                <td className="px-3 py-2">
                  {run.operationRunType
                    ? (OPERATION_TYPE_LABELS[run.operationRunType] ?? run.operationRunType)
                    : "—"}
                </td>
                <td className="px-3 py-2">{run.storeName ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={statusBadgeVariant(run.deliveryStatus)}>
                    {statusLabel(run.deliveryStatus)}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatUsd(run.custoUsdTotal)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatBRL(run.custoBrl)}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-2 text-xs"
                  title="Bruto = créditos debitados (auditoria); Estorno = estornos vinculados ao run; Líquido = bruto − estorno (mín. 0)"
                >
                  <div>Bruto: {formatNumber(run.creditosDebitados)}</div>
                  <div>Estorno: {formatNumber(run.creditosEstornados)}</div>
                  <div>Líquido: {formatNumber(run.creditosLiquidos)}</div>
                  <div className="text-muted-foreground">
                    Receita {formatBRL(run.receitaEstimadaBrl)} · Resultado{" "}
                    {formatBRL(run.resultadoEstimadoBrl)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatDuration(run.duracaoTotalMs)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatNumber(run.chamadas)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatNumber(run.regeneracoes)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {run.provider && run.model
                    ? `${run.provider}/${run.model}`
                    : (run.provider ?? run.model ?? "—")}
                </td>
                <td className="px-3 py-2">
                  <CostBadge badge={run.badge} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  ainda indisponível
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  pendente
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedRunId && (
        <RunDetailDialog
          operationRunId={selectedRunId}
          onClose={() => setSelectedRunId(null)}
        />
      )}
    </section>
  );
}
