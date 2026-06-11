"use client";

import { useState, useEffect } from "react";
import type { Store } from "@/lib/store";
import { resolveStoreIdentity } from "@/lib/actions/store";
import { STORE_SEGMENTS } from "@/lib/constants";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";
import { Loader2 } from "lucide-react";

interface StoreIdentityBlockProps {
  store: Pick<Store, "id" | "name" | "logo_url" | "segment" | "brand_color" | "subsegment" | "tone_of_voice" | "positioning" | "short_description" | "slogan">;
}

export function StoreIdentityBlock({ store }: StoreIdentityBlockProps) {
  const [identity, setIdentity] = useState<StoreIdentitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    resolveStoreIdentity(store)
      .then(setIdentity)
      .catch(() => setIdentity(null))
      .finally(() => setLoading(false));
  }, [store]);

  if (!store.name) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!identity) return null;

  const segmentEntry = STORE_SEGMENTS.find(s => s.value === store.segment);
  const segmentLabel = segmentEntry?.label ?? "";

  const logoUrl = identity.brandProfile?.logoVariantUrl ?? identity.logoUrl;
  const visualSignatureUrl = identity.visualSignatureUrl;
  const secondaryColor = identity.brandProfile?.brand_colors_chosen?.[1] ?? null;
  const hasBrandProfile = !!identity.brandProfile;

  return (
    <div className="flex items-start gap-4 bg-bg-surface border border-border rounded-xl p-4">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`Logo ${store.name}`}
          className="w-10 h-10 rounded-full object-contain shrink-0 bg-bg-elevated border border-border-light"
        />
      ) : visualSignatureUrl ? (
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-bg-elevated border border-border-light">
          <img
            src={visualSignatureUrl}
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
          {hasBrandProfile && (
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
