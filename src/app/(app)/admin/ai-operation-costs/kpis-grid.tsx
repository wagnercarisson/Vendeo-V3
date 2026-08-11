import type { OperationRunsSummary } from "@/lib/ai-cost/operation-runs-service";

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

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
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

interface KpiDef {
  label: string;
  value: string;
  tooltip?: string;
}

function buildKpis(summary: OperationRunsSummary): KpiDef[] {
  return [
    { label: "Custo estimado total (USD)", value: formatUsd(summary.custoUsdTotal) },
    { label: "Custo estimado total (BRL)", value: formatBRL(summary.custoBrl) },
    { label: "Créditos brutos", value: formatNumber(summary.creditosDebitados) },
    { label: "Estornos", value: formatNumber(summary.creditosEstornados) },
    { label: "Créditos líquidos", value: formatNumber(summary.creditosLiquidos) },
    { label: "Receita operacional (BRL)", value: formatBRL(summary.receitaOpBrl) },
    {
      label: "Resultado operacional estimado (BRL)",
      value: formatBRL(summary.resultadoOpBrl),
    },
    {
      label: "Margem operacional estimada",
      value: formatPercent(summary.margemOpPct),
    },
    { label: "Tempo médio", value: formatDuration(summary.tempoMedioMs) },
    {
      label: "Tempo P95 (95% das entregas)",
      value: formatDuration(summary.p95Ms),
      tooltip:
        "95% das entregas terminaram em até este tempo; os 5% mais lentos ficam fora desse corte.",
    },
    { label: "Total de entregas", value: formatNumber(summary.totalEntregas) },
    { label: "Entregas com erro", value: formatNumber(summary.entregasErro) },
    { label: "Entregas com sucesso", value: formatNumber(summary.entregasSucesso) },
  ];
}

/**
 * KPIs do painel (D3) — valores vêm do summary do service sobre o conjunto
 * filtrado INTEIRO; a UI NUNCA recalcula KPIs sobre a página.
 */
export function KpisGrid({ summary }: { summary: OperationRunsSummary }) {
  const kpis = buildKpis(summary);
  return (
    <section aria-label="KPIs" className="space-y-3">
      <h2 className="text-lg font-semibold">Indicadores</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-border bg-bg-surface p-4"
            data-testid={`kpi-${kpi.label}`}
            title={kpi.tooltip}
          >
            <div className="mb-2 text-sm font-medium text-muted-foreground">
              {kpi.label}
            </div>
            <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
