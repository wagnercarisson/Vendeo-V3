"use client";

import { SEGMENT_COLOR_FALLBACK } from "@/lib/store";
import { STORE_SEGMENTS } from "@/lib/constants";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { DriftStatus } from "@/lib/drift";

const PREVIEW_DEFAULT_COLOR = "#22C55E";

interface CriticalDriftInfo {
  status: 'none' | 'new' | 'dismissed';
  fields: string[];
  reason: 'ok' | 'critical_drift' | 'missing_metadata';
}

interface StorePreviewProps {
  name: string;
  segment: string;
  brandColor: string;
  accentColor?: string;
  brandColorsChosen?: Array<string | null>;
  logoUrl?: string | null;
  logoStatus?: string | null;
  identityState?: string | null;
  textOnlyProfile?: {
    safe_color_tokens?: Record<string, string>;
    visual_style?: string;
    visual_tone?: string;
    brand_personality?: string;
    brand_colors_chosen?: Array<string | null>;
    inferred_primary_color?: string;
    inferred_accent_color?: string;
  } | null;
  driftStatus?: DriftStatus;
  criticalDrift?: CriticalDriftInfo | null;
}

export function StorePreview({ name, segment, brandColor, accentColor, brandColorsChosen, logoUrl, logoStatus, identityState, textOnlyProfile, driftStatus, criticalDrift }: StorePreviewProps) {
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

  const isTextOnly = identityState === 'text_only' && textOnlyProfile;
  const showDirectionSection = textOnlyProfile && (textOnlyProfile.visual_style || textOnlyProfile.visual_tone || textOnlyProfile.brand_personality);

  const userPrimary = brandColorsChosen?.[0] && /^#[0-9A-Fa-f]{6}$/.test(brandColorsChosen[0]) ? brandColorsChosen[0] : null;
  const userAccent = brandColorsChosen?.[1] && /^#[0-9A-Fa-f]{6}$/.test(brandColorsChosen[1]) ? brandColorsChosen[1] : null;

  const resolvedColor = userPrimary
    ?? (isTextOnly
      ? (textOnlyProfile!.safe_color_tokens?.primary && /^#[0-9A-Fa-f]{6}$/.test(textOnlyProfile!.safe_color_tokens!.primary)
          ? textOnlyProfile!.safe_color_tokens!.primary
          : textOnlyProfile!.inferred_primary_color && /^#[0-9A-Fa-f]{6}$/.test(textOnlyProfile!.inferred_primary_color)
            ? textOnlyProfile!.inferred_primary_color
            : brandColor || SEGMENT_COLOR_FALLBACK[segment] || PREVIEW_DEFAULT_COLOR)
      : brandColor || SEGMENT_COLOR_FALLBACK[segment] || PREVIEW_DEFAULT_COLOR);

  const resolvedAccent = userAccent
    ?? (isTextOnly
      ? (textOnlyProfile!.safe_color_tokens?.accent && /^#[0-9A-Fa-f]{6}$/.test(textOnlyProfile!.safe_color_tokens!.accent)
          ? textOnlyProfile!.safe_color_tokens!.accent
          : textOnlyProfile!.inferred_accent_color && /^#[0-9A-Fa-f]{6}$/.test(textOnlyProfile!.inferred_accent_color)
            ? textOnlyProfile!.inferred_accent_color
            : resolvedColor)
      : accentColor || resolvedColor);

  const showVisualSignature = logoStatus === 'generated' && logoUrl;

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-6">
      <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-4">
        Preview da Loja
      </h3>

      <div className="flex items-center gap-4">
        {showVisualSignature ? (
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-bg-elevated border border-border-light shadow-sm">
            <img src={logoUrl!} alt={`Assinatura visual ${name}`} className="w-full h-full object-contain" />
          </div>
        ) : logoUrl ? (
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

          {(() => {
            const segEntry = STORE_SEGMENTS.find(s => s.value === segment);
            return segEntry ? (
              <span
                className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-heading font-medium"
                style={{
                  backgroundColor: `${resolvedColor}1A`,
                  color: resolvedColor,
                  border: `1px solid ${resolvedColor}33`,
                }}
              >
                {segEntry.label}
              </span>
            ) : null;
          })()}

          {(() => {
            const effectiveStatus: DriftStatus = criticalDrift?.status === 'new'
              ? 'new'
              : (driftStatus === 'new' && criticalDrift?.status !== 'new' ? 'new' : 'none');

            if (effectiveStatus !== 'new') return null;

            const isCritical = criticalDrift?.status === 'new';
            const tooltipText = isCritical
              ? `Dados críticos alterados: ${criticalDrift?.fields?.join(', ') || 'nome, segmento'}`
              : 'Direção visual desatualizada';

            return (
              <span className="relative group inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-900/20 text-accent-amber text-xs font-heading font-medium border border-amber-700/30 cursor-help">
                <AlertCircle className="w-3 h-3" />
                Desalinhado
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-text-secondary font-body whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg z-10">
                  {tooltipText}
                </div>
              </span>
            );
          })()}
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

      {showDirectionSection && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-accent-green" />
            <span className="text-accent-green text-xs font-heading font-semibold">Direção visual definida pelo Vendeo</span>
          </div>

          {textOnlyProfile!.safe_color_tokens && (() => {
            const tokens = textOnlyProfile!.safe_color_tokens!;
            const colorChips = Object.entries(tokens).filter(([, v]) => /^#[0-9A-Fa-f]{6}$/.test(v));
            if (colorChips.length > 0) {
              return (
                <div>
                  <span className="text-text-muted text-[10px] font-heading font-medium uppercase tracking-wider">Paleta</span>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {colorChips.map(([key, val]) => (
                      <div key={key} className="flex flex-col items-center gap-0.5">
                        <div className="w-6 h-6 rounded-full border border-border-light" style={{ backgroundColor: val }} />
                        <span className="text-[9px] text-text-muted font-mono">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {textOnlyProfile!.visual_style && (
            <div>
              <span className="text-text-muted text-[10px] font-heading font-medium uppercase tracking-wider">Estilo</span>
              <p className="text-text-secondary text-xs font-body mt-1">{textOnlyProfile!.visual_style}</p>
            </div>
          )}

          {textOnlyProfile!.visual_tone && (
            <div>
              <span className="text-text-muted text-[10px] font-heading font-medium uppercase tracking-wider">Tom</span>
              <p className="text-text-secondary text-xs font-body mt-1">{textOnlyProfile!.visual_tone}</p>
            </div>
          )}

          {textOnlyProfile!.brand_personality && (
            <div>
              <span className="text-text-muted text-[10px] font-heading font-medium uppercase tracking-wider">Personalidade</span>
              <p className="text-text-secondary text-xs font-body mt-1">{textOnlyProfile!.brand_personality}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
