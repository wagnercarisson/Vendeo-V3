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
  getVsSuccessRate,
  getVsErrorRate,
  getVsAvgDuration,
  getVsCreditsConsumed,
  getVsRefundRate,
  getVsCreditsRefunded,
} from "@/lib/metrics/pipeline-metrics";
import { computeHealthState } from "@/lib/metrics/health";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import type { MetricCard, HealthState } from "@/lib/metrics/types";
import { HealthBanner } from "./health-banner";
import { MetricsCards } from "./metrics-cards";

const USD_BRL_RATE = Number(process.env.VENDEO_USD_BRL_RATE ?? "5.50");

interface MetricsData {
  // Campaign
  successRate: number | null;
  errorRate: number | null;
  avgCost: number | null;
  avgDuration: number | null;
  refundRate: number | null;
  activeUsers: number | null;
  // VS
  vsSuccessRate: number | null;
  vsErrorRate: number | null;
  vsAvgDuration: number | null;
  vsCreditsConsumed: number | null;
  vsRefundRate: number | null;
  vsCreditsRefunded: number | null;
  // Wallet
  creditsGranted: number | null;
}

async function fetchMetrics(hours: number): Promise<MetricsData> {
  const [
    successRate, errorRate, avgCost, avgDuration, refundRate, activeUsers,
    vsSuccessRate, vsErrorRate, vsAvgDuration, vsCreditsConsumed, vsRefundRate, vsCreditsRefunded,
    creditsGranted,
  ] = await Promise.all([
    getSuccessRate(hours),
    getErrorRate(hours),
    getAvgCost(hours),
    getAvgDuration(hours),
    getRefundRate(hours),
    getActiveUsers(hours),
    getVsSuccessRate(hours),
    getVsErrorRate(hours),
    getVsAvgDuration(hours),
    getVsCreditsConsumed(hours),
    getVsRefundRate(hours),
    getVsCreditsRefunded(hours),
    getCreditsGranted(hours),
  ]);

  return {
    successRate, errorRate, avgCost, avgDuration, refundRate, activeUsers,
    vsSuccessRate, vsErrorRate, vsAvgDuration, vsCreditsConsumed, vsRefundRate, vsCreditsRefunded,
    creditsGranted,
  };
}

function buildCampaignCards(hours: number, data: MetricsData): MetricCard[] {
  const timeRange = hours === 1 ? "1h" as const : hours === 24 ? "24h" as const : "7d" as const;
  return [
    { label: "Taxa de Sucesso", value: data.successRate, unit: "%", timeRange },
    { label: "Taxa de Erro", value: data.errorRate, unit: "%", timeRange },
    { label: "Custo Médio", value: data.avgCost, timeRange },
    { label: "Tempo Médio", value: data.avgDuration, timeRange },
    { label: "Taxa de Estorno Campanhas", value: data.refundRate, unit: "%", timeRange },
    { label: "Usuários Ativos", value: data.activeUsers, timeRange },
  ];
}

function buildVsCards(hours: number, data: MetricsData): MetricCard[] {
  const timeRange = hours === 1 ? "1h" as const : hours === 24 ? "24h" as const : "7d" as const;
  return [
    { label: "Taxa de Sucesso VS", value: data.vsSuccessRate, unit: "%", timeRange },
    { label: "Taxa de Erro VS", value: data.vsErrorRate, unit: "%", timeRange },
    { label: "Tempo Médio VS", value: data.vsAvgDuration, timeRange },
    { label: "Créditos Consumidos VS", value: data.vsCreditsConsumed, timeRange },
    { label: "Créditos Estornados VS", value: data.vsCreditsRefunded, timeRange },
    { label: "Taxa de Estorno VS", value: data.vsRefundRate, unit: "%", timeRange },
  ];
}

function buildWalletCards(hours: number, data: MetricsData): MetricCard[] {
  const timeRange = hours === 1 ? "1h" as const : hours === 24 ? "24h" as const : "7d" as const;
  return [
    { label: "Créditos Concedidos", value: data.creditsGranted, timeRange },
  ];
}

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage() {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
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

  const campaignCards1h = buildCampaignCards(1, metrics1h);
  const campaignCards24h = buildCampaignCards(24, metrics24h);
  const campaignCards7d = buildCampaignCards(168, metrics7d);

  const vsCards1h = buildVsCards(1, metrics1h);
  const vsCards24h = buildVsCards(24, metrics24h);
  const vsCards7d = buildVsCards(168, metrics7d);

  const walletCards1h = buildWalletCards(1, metrics1h);
  const walletCards24h = buildWalletCards(24, metrics24h);
  const walletCards7d = buildWalletCards(168, metrics7d);

  const allIsEmpty =
    [...campaignCards1h, ...campaignCards24h, ...campaignCards7d,
     ...vsCards1h, ...vsCards24h, ...vsCards7d,
     ...walletCards1h, ...walletCards24h, ...walletCards7d]
      .every((c) => c.value === null || c.value === undefined);

  if (allIsEmpty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Métricas</h1>
          <p className="text-sm text-muted-foreground">
            Indicadores operacionais do sistema
          </p>
        </div>
        <EmptyState
          icon={BarChart3}
          title="Aguardando dados de geração"
          description="As métricas serão exibidas conforme campanhas e assinaturas visuais forem geradas."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Métricas</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores operacionais do sistema
        </p>
      </div>

      <HealthBanner healthState={healthState} />

      {/* ─── Pipeline de Campanhas ─── */}
      <section>
        <h2 className="border-b pb-2 text-lg font-semibold text-foreground">Pipeline de Campanhas</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Pipeline de geração de campanhas
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Última hora</h3>
            <MetricsCards cards={campaignCards1h} usdToBrlRate={USD_BRL_RATE} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimas 24 horas</h3>
            <MetricsCards cards={campaignCards24h} usdToBrlRate={USD_BRL_RATE} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimos 7 dias</h3>
            <MetricsCards cards={campaignCards7d} usdToBrlRate={USD_BRL_RATE} />
          </div>
        </div>
      </section>

      {/* ─── Assinatura Visual ─── */}
      <section>
        <h2 className="border-b pb-2 text-lg font-semibold text-foreground">Assinatura Visual</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Geração de assinatura visual
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Última hora</h3>
            <MetricsCards cards={vsCards1h} usdToBrlRate={USD_BRL_RATE} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimas 24 horas</h3>
            <MetricsCards cards={vsCards24h} usdToBrlRate={USD_BRL_RATE} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimos 7 dias</h3>
            <MetricsCards cards={vsCards7d} usdToBrlRate={USD_BRL_RATE} />
          </div>
        </div>
      </section>

      {/* ─── Wallet/Admin ─── */}
      <section>
        <h2 className="border-b pb-2 text-lg font-semibold text-foreground">Wallet/Admin</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Créditos e concessões
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Última hora</h3>
            <MetricsCards cards={walletCards1h} usdToBrlRate={USD_BRL_RATE} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimas 24 horas</h3>
            <MetricsCards cards={walletCards24h} usdToBrlRate={USD_BRL_RATE} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimos 7 dias</h3>
            <MetricsCards cards={walletCards7d} usdToBrlRate={USD_BRL_RATE} />
          </div>
        </div>
      </section>
    </div>
  );
}
