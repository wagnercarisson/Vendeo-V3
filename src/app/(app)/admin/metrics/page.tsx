import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  getSuccessRate,
  getErrorRate,
  getAvgCost,
  getAvgDuration,
  getCreditsGranted,
  getRefundRate,
  getActiveUsers,
} from "@/lib/metrics/pipeline-metrics";
import { computeHealthState } from "@/lib/metrics/health";
import type { MetricCard, HealthState } from "@/lib/metrics/types";
import { HealthBanner } from "./health-banner";
import { MetricsCards } from "./metrics-cards";

const USD_BRL_RATE = Number(process.env.VENDEO_USD_BRL_RATE ?? "5.50");

async function fetchMetrics(hours: number): Promise<{
  successRate: number | null;
  errorRate: number | null;
  avgCost: number | null;
  avgDuration: number | null;
  creditsGranted: number | null;
  refundRate: number | null;
  activeUsers: number | null;
}> {
  const [successRate, errorRate, avgCost, avgDuration, creditsGranted, refundRate, activeUsers] =
    await Promise.all([
      getSuccessRate(hours),
      getErrorRate(hours),
      getAvgCost(hours),
      getAvgDuration(hours),
      getCreditsGranted(hours),
      getRefundRate(hours),
      getActiveUsers(hours),
    ]);

  return { successRate, errorRate, avgCost, avgDuration, creditsGranted, refundRate, activeUsers };
}

function toCards(
  hours: number,
  data: Awaited<ReturnType<typeof fetchMetrics>>
): MetricCard[] {
  const timeRange = hours === 1 ? "1h" as const : hours === 24 ? "24h" as const : "7d" as const;

  return [
    { label: "Taxa de Sucesso", value: data.successRate, unit: "%", timeRange },
    { label: "Taxa de Erro", value: data.errorRate, unit: "%", timeRange },
    { label: "Custo Médio", value: data.avgCost, timeRange },
    { label: "Tempo Médio", value: data.avgDuration, timeRange },
    { label: "Créditos Concedidos", value: data.creditsGranted, timeRange },
    { label: "Taxa de Estorno", value: data.refundRate, unit: "%", timeRange },
    { label: "Usuários Ativos", value: data.activeUsers, timeRange },
  ];
}

export default async function AdminMetricsPage() {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        Acesso negado. Apenas administradores podem acessar esta página.
      </div>
    );
  }

  const [metrics1h, metrics24h, metrics7d] = await Promise.all([
    fetchMetrics(1),
    fetchMetrics(24),
    fetchMetrics(168),
  ]);

  const healthState: HealthState = computeHealthState({
    successRate: metrics24h.successRate,
    errorRate: metrics24h.errorRate,
    avgCost: metrics24h.avgCost,
    avgDuration: metrics24h.avgDuration,
    refundRate: metrics24h.refundRate,
  });

  const allCards: MetricCard[] = [
    ...toCards(1, metrics1h),
    ...toCards(24, metrics24h),
    ...toCards(168, metrics7d),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Métricas</h1>
        <p className="text-sm text-gray-500">
          Indicadores operacionais do pipeline de geração
        </p>
      </div>

      <HealthBanner healthState={healthState} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Última hora</h2>
        <MetricsCards cards={allCards.filter((c) => c.timeRange === "1h")} usdToBrlRate={USD_BRL_RATE} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Últimas 24 horas</h2>
        <MetricsCards cards={allCards.filter((c) => c.timeRange === "24h")} usdToBrlRate={USD_BRL_RATE} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Últimos 7 dias</h2>
        <MetricsCards cards={allCards.filter((c) => c.timeRange === "7d")} usdToBrlRate={USD_BRL_RATE} />
      </section>
    </div>
  );
}
