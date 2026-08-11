import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { EconomicParameterService } from "@/lib/economic/economic-parameter-service";
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
import type { StoreKind } from "@/lib/metrics/pipeline-metrics";
import { computeHealthState } from "@/lib/metrics/health";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import type { MetricCard, HealthState } from "@/lib/metrics/types";
import { HealthBanner } from "./health-banner";
import { MetricsCards } from "./metrics-cards";

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

async function fetchMetrics(hours: number, storeKind: StoreKind = "production"): Promise<MetricsData> {
  const [
    successRate, errorRate, avgCost, avgDuration, refundRate, activeUsers,
    vsSuccessRate, vsErrorRate, vsAvgDuration, vsCreditsConsumed, vsRefundRate, vsCreditsRefunded,
    creditsGranted,
  ] = await Promise.all([
    getSuccessRate(hours, storeKind),
    getErrorRate(hours, storeKind),
    getAvgCost(hours, storeKind),
    getAvgDuration(hours, storeKind),
    getRefundRate(hours, storeKind),
    getActiveUsers(hours, storeKind),
    getVsSuccessRate(hours, storeKind),
    getVsErrorRate(hours, storeKind),
    getVsAvgDuration(hours, storeKind),
    getVsCreditsConsumed(hours, storeKind),
    getVsRefundRate(hours, storeKind),
    getVsCreditsRefunded(hours, storeKind),
    getCreditsGranted(hours, storeKind),
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
    { label: "Custo Médio IA", value: data.avgCost, timeRange },
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

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Acesso negado. Apenas administradores podem acessar esta página.
      </div>
    );
  }

  const sp = await searchParams;
  const storeKind: StoreKind = sp.view === "all" ? "all" : "production";
  const modeLabel = storeKind === "all" ? "Todos (produção + teste)" : "Apenas produção";
  const modeLinkHref = storeKind === "all" ? "/admin/metrics" : "/admin/metrics?view=all";
  const modeLinkLabel = storeKind === "all" ? "Ver apenas produção" : "Ver todos (incluir teste)";

  const [metrics1h, metrics24h, metrics7d] = await Promise.all([
    fetchMetrics(1, storeKind),
    fetchMetrics(24, storeKind),
    fetchMetrics(168, storeKind),
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Métricas</h1>
            <p className="text-sm text-muted-foreground">
              Indicadores operacionais do sistema
            </p>
          </div>
          <Link
            href={modeLinkHref}
            className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors whitespace-nowrap ${
              storeKind === "all"
                ? "bg-accent-amber/10 border-accent-amber/30 text-accent-amber"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            {storeKind === "all" ? "⬡ Modo: Todos" : "☐ Modo: Produção"}
          </Link>
        </div>
        <EmptyState
          icon={BarChart3}
          title="Aguardando dados de geração"
          description="As métricas serão exibidas conforme campanhas e assinaturas visuais forem geradas."
        />
      </div>
    );
  }

  // Fonte única de conversão USD→BRL (D2): economic_parameters.usd_brl_rate via
  // EconomicParameterService (38-2-02) — default 1.00 no fallback (D1). O env
  // VENDEO_USD_BRL_RATE fica apenas como fallback de bootstrap documentado,
  // SEM uso ativo (deprecado).
  const usdBrl = await new EconomicParameterService().getParameter("usd_brl_rate");
  const usdToBrlRate = usdBrl.value;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Métricas</h1>
          <p className="text-sm text-muted-foreground">
            Indicadores operacionais do sistema
          </p>
        </div>
        <Link
          href={modeLinkHref}
          className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors whitespace-nowrap ${
            storeKind === "all"
              ? "bg-accent-amber/10 border-accent-amber/30 text-accent-amber"
              : "bg-muted border-border text-muted-foreground"
          }`}
        >
          {storeKind === "all" ? "⬡ Modo: Todos" : "☐ Modo: Produção"}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        <Link href={modeLinkHref} className="hover:text-foreground transition-colors">
          {modeLinkLabel}
        </Link>
      </p>

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
            <MetricsCards cards={campaignCards1h} usdToBrlRate={usdToBrlRate} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimas 24 horas</h3>
            <MetricsCards cards={campaignCards24h} usdToBrlRate={usdToBrlRate} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimos 7 dias</h3>
            <MetricsCards cards={campaignCards7d} usdToBrlRate={usdToBrlRate} />
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
            <MetricsCards cards={vsCards1h} usdToBrlRate={usdToBrlRate} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimas 24 horas</h3>
            <MetricsCards cards={vsCards24h} usdToBrlRate={usdToBrlRate} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimos 7 dias</h3>
            <MetricsCards cards={vsCards7d} usdToBrlRate={usdToBrlRate} />
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
            <MetricsCards cards={walletCards1h} usdToBrlRate={usdToBrlRate} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimas 24 horas</h3>
            <MetricsCards cards={walletCards24h} usdToBrlRate={usdToBrlRate} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Últimos 7 dias</h3>
            <MetricsCards cards={walletCards7d} usdToBrlRate={usdToBrlRate} />
          </div>
        </div>
      </section>
    </div>
  );
}
