"use client";

import type { HealthState } from "@/lib/metrics/types";

const BANNER_STYLES: Record<HealthState, { bg: string; text: string; indicator: string }> = {
  healthy: { bg: "bg-success/10 border-success/30", text: "text-success", indicator: "●" },
  attention: { bg: "bg-accent-amber/10 border-accent-amber/30", text: "text-accent-amber", indicator: "●" },
  pause: { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", indicator: "●" },
};

const LABELS: Record<HealthState, string> = {
  healthy: "Saudável",
  attention: "Atenção",
  pause: "Crítico",
};

export function HealthBanner({ healthState }: { healthState: HealthState }) {
  const style = BANNER_STYLES[healthState];

  return (
    <div className={`rounded-lg border px-4 py-3 ${style.bg} ${style.text}`}>
      <span className="font-medium">{style.indicator} {LABELS[healthState]}</span>
    </div>
  );
}
