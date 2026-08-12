import type {
  EconomicValueSource,
  OperationRunsSummary,
} from "@/lib/ai-cost/operation-runs-service";
import { Badge } from "@/components/ui/badge";

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

/**
 * Rótulo de origem do valor (D8/T-38.2.1-14) — a UI apenas EXIBE a origem que
 * vem do service (creditValueSource/usdBrlRateSource); nunca infere:
 *   economic_parameter_fallback → "estimado de parâmetro atual"
 *   backfilled_*               → "reconstruído de histórico"
 *   captured_at_generation     → null (snapshot real — sem rótulo)
 */
function sourceOriginLabel(source: EconomicValueSource): string | null {
  if (source === "economic_parameter_fallback") return "estimado de parâmetro atual";
  if (source.startsWith("backfilled")) return "reconstruído de histórico";
  return null;
}

interface KpiDef {
  label: string;
  value: string;
  tooltip?: string;
  origin?: string;
}

function buildKpis(summary: OperationRunsSummary): KpiDef[] {
  // Origem do valor (D8) — exibida nos cards BRL; a UI nunca infere a origem.
  const custoOrigin = sourceOriginLabel(summary.usdBrlRateSource);
  const receitaOrigin = sourceOriginLabel(summary.creditValueSource);
  return [
    { label: "Custo estimado total (USD)", value: formatUsd(summary.custoUsdTotal) },
    {
      label: "Custo estimado total (BRL)",
      value: formatBRL(summary.custoBrl),
      origin: custoOrigin ?? undefined,
    },
    { label: "Créditos brutos", value: formatNumber(summary.creditosDebitados) },
    { label: "Estornos", value: formatNumber(summary.creditosEstornados) },
    { label: "Créditos líquidos", value: formatNumber(summary.creditosLiquidos) },
    {
      label: "Receita estimada (BRL)",
      value: formatBRL(summary.receitaEstimadaBrl),
      origin: receitaOrigin ?? undefined,
    },
    {
      label: "Resultado estimado (BRL)",
      value: formatBRL(summary.resultadoEstimadoBrl),
      origin: receitaOrigin ?? undefined,
    },
    {
      label: "Margem estimada",
      value: formatPercent(summary.margemEstimadaPct),
      origin: receitaOrigin ?? undefined,
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
 * filtrado INTEIRO; a UI NUNCA recalcula KPIs sobre a página. Origem do valor
 * (D8): quando o derivado usa fallback/backfill, um badge sinaliza que o valor
 * NÃO foi capturado na geração (T-38.2.1-15 — fallback nunca sem marcação).
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
            {kpi.origin ? (
              <div
                className="mt-1"
                data-testid={`kpi-origin-${kpi.label}`}
                data-origin={
                  kpi.origin === "estimado de parâmetro atual"
                    ? "economic_parameter_fallback"
                    : "backfilled"
                }
              >
                <Badge
                  variant={kpi.origin === "estimado de parâmetro atual" ? "generating" : "default"}
                >
                  {kpi.origin}
                </Badge>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
