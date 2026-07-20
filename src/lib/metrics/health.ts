import type { HealthState } from "./types";

export interface MetricValues {
  successRate: number | null;
  errorRate: number | null;
  avgCost: number | null;
  avgDuration: number | null;
  refundRate: number | null;
}

function metricState(
  value: number | null,
  thresholds: { healthy: number; attention: number; pause: boolean }
): HealthState {
  if (value === null) return "healthy";
  if (thresholds.pause) {
    if (value >= thresholds.attention) return "pause";
    if (value >= thresholds.healthy) return "attention";
  } else {
    if (value < thresholds.attention) return "pause";
    if (value < thresholds.healthy) return "attention";
  }
  return "healthy";
}

const STATE_ORDER: Record<HealthState, number> = {
  healthy: 0,
  attention: 1,
  pause: 2,
};

export function computeHealthState(metrics: MetricValues): HealthState {
  const states: HealthState[] = [
    metricState(metrics.successRate, { healthy: 85, attention: 70, pause: false }),
    metricState(metrics.errorRate, { healthy: 5, attention: 10, pause: true }),
    metricState(metrics.avgCost, { healthy: 0.2, attention: 0.5, pause: true }),
    metricState(metrics.avgDuration, { healthy: 90000, attention: 180000, pause: true }),
    metricState(metrics.refundRate, { healthy: 10, attention: 15, pause: true }),
  ];

  return states.reduce((worst, current) =>
    STATE_ORDER[current] > STATE_ORDER[worst] ? current : worst
  );
}
