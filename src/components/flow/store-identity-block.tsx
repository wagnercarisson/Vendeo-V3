"use client";

import type { Store } from "@/lib/store";
import { resolveStoreIdentity } from "@/lib/store";
import { SEGMENT_LABELS } from "@/lib/constants";

interface StoreIdentityBlockProps {
  store: Pick<Store, "name" | "logo_url" | "segment" | "brand_color">;
}

export function StoreIdentityBlock({ store }: StoreIdentityBlockProps) {
  const identity = resolveStoreIdentity(store);

  if (!store.name) return null;

  const segmentLabel =
    store.segment && SEGMENT_LABELS[store.segment as keyof typeof SEGMENT_LABELS]
      ? SEGMENT_LABELS[store.segment as keyof typeof SEGMENT_LABELS]
      : "";

  return (
    <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-heading font-bold text-sm shrink-0"
        style={{ backgroundColor: identity.color }}
      >
        {store.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex flex-col min-w-0">
        <p className="text-text-primary font-heading font-semibold text-base truncate">
          {store.name}
        </p>
        {segmentLabel && (
          <span
            className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-heading font-medium w-fit"
            style={{
              backgroundColor: `${identity.color}1A`,
              color: identity.color,
              border: `1px solid ${identity.color}33`,
            }}
          >
            {segmentLabel}
          </span>
        )}
      </div>
    </div>
  );
}
