"use client";

import { useState, useEffect } from "react";
import type { Store } from "@/lib/store";
import { resolveStoreIdentity } from "@/lib/actions/store";
import { SEGMENT_LABELS } from "@/lib/constants";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";
import { Loader2 } from "lucide-react";

interface StoreIdentityBlockProps {
  store: Pick<Store, "id" | "name" | "logo_url" | "segment" | "brand_color">;
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

  const segmentLabel =
    store.segment && SEGMENT_LABELS[store.segment as keyof typeof SEGMENT_LABELS]
      ? SEGMENT_LABELS[store.segment as keyof typeof SEGMENT_LABELS]
      : "";

  const logoUrl = identity.brandProfile?.logoVariantUrl ?? identity.logoUrl;

  return (
    <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`Logo ${store.name}`}
          className="w-8 h-8 rounded-full object-contain shrink-0 bg-bg-elevated"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-heading font-bold text-sm shrink-0"
          style={{ backgroundColor: identity.brandColor }}
        >
          {store.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <p className="text-text-primary font-heading font-semibold text-base truncate">
          {store.name}
        </p>
        {segmentLabel && (
          <span
            className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-heading font-medium w-fit"
            style={{
              backgroundColor: `${identity.brandColor}1A`,
              color: identity.brandColor,
              border: `1px solid ${identity.brandColor}33`,
            }}
          >
            {segmentLabel}
          </span>
        )}
      </div>
    </div>
  );
}
