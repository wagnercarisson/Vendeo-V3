"use client";

import type { HealthState } from "@/lib/metrics/types";

const BANNER_STYLES: Record<HealthState, { bg: string; text: string; indicator: string }> = {
  healthy: { bg: "bg-green-50 border-green-300", text: "text-green-800", indicator: "●" },
  attention: { bg: "bg-yellow-50 border-yellow-300", text: "text-yellow-800", indicator: "●" },
  pause: { bg: "bg-red-50 border-red-300", text: "text-red-800", indicator: "●" },
};

const LABELS: Record<HealthState, string> = {
  healthy: "Healthy",
  attention: "Attention",
  pause: "Pause",
};

export function HealthBanner({ healthState }: { healthState: HealthState }) {
  const style = BANNER_STYLES[healthState];

  return (
    <div className={`rounded-lg border px-4 py-3 ${style.bg} ${style.text}`}>
      <span className="font-medium">{style.indicator} {LABELS[healthState]}</span>
    </div>
  );
}
