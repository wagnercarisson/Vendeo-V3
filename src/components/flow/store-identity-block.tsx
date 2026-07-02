"use client";

import { STORE_SEGMENTS } from "@/lib/constants";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";
import { AlertTriangle } from "lucide-react";

interface StoreIdentityBlockProps {
  store: { name: string; segment: string; brand_color: string; id: string };
  identity: StoreIdentitySnapshot | null;
}

const IDENTITY_STATE_LABELS: Record<string, string> = {
  'text_only': 'Texto Only',
  'logo': 'Logo Ativo',
  'visual_signature': 'Assinatura Visual',
};

export function StoreIdentityBlock({ store, identity }: StoreIdentityBlockProps) {
  if (!store.name || !identity) return null;

  const segmentEntry = STORE_SEGMENTS.find(s => s.value === store.segment);
  const segmentLabel = segmentEntry?.label ?? "";

  const secondaryColor = identity.brandProfile?.brand_colors_chosen?.[1] ?? null;
  const hasBrandProfile = !!identity.brandProfile;
  const { signature } = identity;

  return (
    <div className="flex items-start gap-4 bg-bg-surface border border-border rounded-xl p-4">
      {signature.type === 'logo' && signature.url ? (
        <div className="relative shrink-0">
          <img
            src={signature.url}
            alt={`Logo ${store.name}`}
            className="w-10 h-10 rounded-full object-contain bg-bg-elevated border border-border-light"
          />
        </div>
      ) : signature.type === 'visual_signature' && signature.url ? (
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-bg-elevated border border-border-light">
          <img
            src={signature.url}
            alt={`Assinatura visual ${store.name}`}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-heading font-bold text-sm shrink-0"
          style={{ backgroundColor: identity.brandColor }}
        >
          {store.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-text-primary font-heading font-semibold text-base truncate">
            {store.name}
          </p>
          {identity.identityState && identity.identityState !== 'text_only' && (
            <span className={`text-[10px] font-heading font-medium px-1.5 py-0.5 rounded-full shrink-0 text-accent-green bg-accent-green/10`}>
              {IDENTITY_STATE_LABELS[identity.identityState] ?? identity.identityState}
            </span>
          )}
          {hasBrandProfile && !identity.identityState && (
            <span className="text-[10px] font-heading font-medium text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full shrink-0">
              Ativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {segmentLabel && (
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-heading font-medium"
              style={{
                backgroundColor: `${identity.brandColor}1A`,
                color: identity.brandColor,
                border: `1px solid ${identity.brandColor}33`,
              }}
            >
              {segmentLabel}
            </span>
          )}
          <div
            className="w-4 h-4 rounded border border-border-light"
            style={{ backgroundColor: identity.brandColor }}
            title={identity.brandColor}
          />
          {secondaryColor && (
            <div
              className="w-4 h-4 rounded border border-border-light"
              style={{ backgroundColor: secondaryColor }}
              title={secondaryColor}
            />
          )}
        </div>
      </div>
    </div>
  );
}
