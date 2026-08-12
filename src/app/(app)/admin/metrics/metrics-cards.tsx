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

interface MetricsCardsProps {
  cards: MetricCard[];
}

export function MetricsCards({ cards }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <div key={i} className="rounded-lg border border-border bg-bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-muted-foreground">{card.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {formatCardValue(card)}
            </span>
            {card.unit && <span className="text-sm text-muted-foreground">{card.unit}</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{formatTimeRange(card.timeRange)}</div>
        </div>
      ))}
    </div>
  );
}

function formatCardValue(card: MetricCard): string {
  if (card.value === null || card.value === undefined) return "—";
  // Valor string = já formatado na página (ex.: "Custo Médio IA" em BRL,
  // R$ X,XX) — devolvido sem re-conversão (D7, estabilidade temporal).
  if (typeof card.value === "string") return card.value;

  const label = card.label.toLowerCase();
  if (label.includes("taxa") || label.includes("rate")) {
    return formatPercent(card.value);
  }
  if (label.includes("tempo") || label.includes("duração")) {
    return formatDuration(card.value);
  }
  return formatNumber(card.value);
}

function formatTimeRange(range: string): string {
  const labels: Record<string, string> = {
    "1h": "Última hora",
    "24h": "Últimas 24 horas",
    "7d": "Últimos 7 dias",
  };
  return labels[range] ?? range;
}
