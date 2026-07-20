"use client";

import type { MetricCard } from "@/lib/metrics/types";

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value}`;
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR");
}

function formatCost(value: number | null, usdToBrlRate: number): string {
  if (value === null || value === undefined) return "—";
  const brl = value * usdToBrlRate;
  return `R$ ${brl.toFixed(2).replace(".", ",")}`;
}

interface MetricsCardsProps {
  cards: MetricCard[];
  usdToBrlRate: number;
}

export function MetricsCards({ cards, usdToBrlRate }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <div key={i} className="rounded-lg border border-border bg-bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-muted-foreground">{card.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {formatCardValue(card, usdToBrlRate)}
            </span>
            {card.unit && <span className="text-sm text-muted-foreground">{card.unit}</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{formatTimeRange(card.timeRange)}</div>
        </div>
      ))}
    </div>
  );
}

function formatCardValue(card: MetricCard, usdToBrlRate: number): string {
  if (card.value === null || card.value === undefined) return "—";

  const label = card.label.toLowerCase();
  if (label.includes("custo") || label.includes("cósto")) {
    return formatCost(card.value as number, usdToBrlRate);
  }
  if (label.includes("taxa") || label.includes("rate")) {
    return formatPercent(card.value as number);
  }
  if (label.includes("tempo") || label.includes("duração")) {
    return formatDuration(card.value as number);
  }
  return formatNumber(card.value as number);
}

function formatTimeRange(range: string): string {
  const labels: Record<string, string> = {
    "1h": "Última hora",
    "24h": "Últimas 24 horas",
    "7d": "Últimos 7 dias",
  };
  return labels[range] ?? range;
}
