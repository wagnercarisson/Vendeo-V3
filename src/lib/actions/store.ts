"use server";

import type { StoreIdentitySnapshot } from "@/components/campaign/types";
import type { VisualSignatureType } from "@/lib/visual-signature/types";
import { getDefaultBrandColor, getStoreInitials } from "@/lib/store";
import type { Store } from "@/lib/store";
import { getActiveVisualSignature } from "@/lib/visual-signature/persistence";

export async function resolveStoreIdentity(
  store: Pick<Store, "id" | "name" | "logo_url" | "segment" | "brand_color">
): Promise<StoreIdentitySnapshot> {
  const brandColor = store.brand_color ?? getDefaultBrandColor(store.segment);
  const storeInitials = getStoreInitials(store.name);

  if (store.logo_url) {
    return {
      storeName: store.name,
      storeSegment: store.segment,
      brandColor,
      logoUrl: store.logo_url,
      visualSignatureUrl: null,
      visualSignatureType: null,
      storeInitials,
    };
  }

  const activeSignature = await getActiveVisualSignature(store.id);
  if (activeSignature) {
    return {
      storeName: store.name,
      storeSegment: store.segment,
      brandColor,
      logoUrl: null,
      visualSignatureUrl: activeSignature.asset_url,
      visualSignatureType: activeSignature.type as VisualSignatureType,
      storeInitials,
    };
  }

  return {
    storeName: store.name,
    storeSegment: store.segment,
    brandColor,
    logoUrl: null,
    visualSignatureUrl: null,
    visualSignatureType: null,
    storeInitials,
  };
}
