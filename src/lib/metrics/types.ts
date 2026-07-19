export type HealthState = "healthy" | "attention" | "pause";
export type TimeRange = "1h" | "24h" | "7d";

export interface MetricCard {
  label: string;
  value: number | string | null;
  unit?: string;
  timeRange: TimeRange;
}
