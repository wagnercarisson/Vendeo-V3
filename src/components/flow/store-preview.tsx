"use client";

import { SEGMENT_COLOR_FALLBACK } from "@/lib/store";
import { SEGMENT_LABELS } from "@/lib/constants";

const PREVIEW_DEFAULT_COLOR = "#22C55E";

interface StorePreviewProps {
  name: string;
  segment: string;
  brandColor: string;
  accentColor?: string;
  brandColorsChosen?: string[];
  logoUrl?: string | null;
}

export function StorePreview({ name, segment, brandColor, accentColor, brandColorsChosen, logoUrl }: StorePreviewProps) {
  const hasData = name || segment;

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-bg-surface border border-border rounded-xl">
        <p className="text-text-muted text-sm font-body">
          Preencha os dados da loja para ver o preview
        </p>
      </div>
    );
  }

  const resolvedColor = brandColorsChosen?.[0] || brandColor || SEGMENT_COLOR_FALLBACK[segment] || PREVIEW_DEFAULT_COLOR;
  const resolvedAccent = brandColorsChosen?.[1] || accentColor || resolvedColor;

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-6">
      <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-4">
        Preview da Loja
      </h3>

      <div className="flex items-center gap-4">
        {logoUrl ? (
          <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 bg-bg-elevated border-2 border-border-light">
            <img src={logoUrl} alt={`Logo ${name}`} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-heading font-bold text-lg shrink-0"
            style={{ backgroundColor: resolvedColor }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-text-primary font-heading font-semibold text-lg truncate">
            {name}
          </p>

          {segment && SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS] && (
            <span
              className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-heading font-medium"
              style={{
                backgroundColor: `${resolvedColor}1A`,
                color: resolvedColor,
                border: `1px solid ${resolvedColor}33`,
              }}
            >
              {SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS]}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider">
            Cor Principal
          </span>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md border border-border-light"
              style={{ backgroundColor: resolvedColor }}
            />
            <span className="text-text-secondary text-xs font-mono">
              {resolvedColor}
            </span>
          </div>
        </div>
        {resolvedAccent !== resolvedColor && (
          <div className="flex items-center gap-3">
            <span className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider">
              Destaque
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md border border-border-light"
                style={{ backgroundColor: resolvedAccent }}
              />
              <span className="text-text-secondary text-xs font-mono">
                {resolvedAccent}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
