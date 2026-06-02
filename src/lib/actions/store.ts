"use server";

import type { StoreIdentitySnapshot, BrandProfileSnapshot } from "@/components/campaign/types";
import type { VisualSignatureType } from "@/lib/visual-signature/types";
import { getDefaultBrandColor, getStoreInitials } from "@/lib/store";
import type { Store } from "@/lib/store";
import { getActiveVisualSignature } from "@/lib/visual-signature/persistence";
import { supabaseAdmin } from '@/lib/supabase/server';
import type { BrandProfileRecord, BrandAssetRecord } from '@/lib/brand-assets/types';

export async function resolveStoreIdentity(
  store: Pick<Store, "id" | "name" | "logo_url" | "segment" | "brand_color">
): Promise<StoreIdentitySnapshot> {
  let brandColor = store.brand_color ?? getDefaultBrandColor(store.segment);
  const storeInitials = getStoreInitials(store.name);

  let brandProfile: BrandProfileSnapshot | null = null;
  let resolvedLogoUrl: string | null = store.logo_url;

  try {
    const [profileResult, assetsResult] = await Promise.all([
      supabaseAdmin.from('store_brand_profiles').select('*').eq('store_id', store.id).eq('status', 'synced').maybeSingle(),
      supabaseAdmin.from('store_brand_assets').select('*').eq('store_id', store.id).eq('status', 'active'),
    ]);

    const profile = profileResult.data as BrandProfileRecord | null;
    const assets = (assetsResult.data ?? []) as BrandAssetRecord[];

    if (profile && assets.length > 0) {
      const originalAsset = assets.find(a => a.variant_type === 'original');
      const onDarkAsset = assets.find(a => a.variant_type === 'on_dark');

      const logoAsset = onDarkAsset ?? originalAsset;
      let logoVariantUrl: string | null = null;
      if (logoAsset?.storage_path) {
        const { data: { publicUrl } } = supabaseAdmin.storage.from('store-brand-assets').getPublicUrl(logoAsset.storage_path);
        logoVariantUrl = publicUrl;
      }

      brandProfile = {
        brand_colors_chosen: profile.brand_colors_chosen ?? [],
        safe_color_tokens: profile.safe_color_tokens ?? {},
        visual_style: profile.visual_style,
        visual_tone: profile.visual_tone,
        brand_personality: profile.brand_personality,
        campaign_guidelines: profile.campaign_guidelines,
        campaign_brief: profile.campaign_brief,
        logoVariantUrl,
      };

      resolvedLogoUrl = logoVariantUrl ?? resolvedLogoUrl;

      if (profile.brand_colors_chosen?.length > 0) {
        const primaryColor = profile.brand_colors_chosen[0];
        if (/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
          brandColor = primaryColor;
        }
      } else if (profile.safe_color_tokens?.primary) {
        const tokenColor = profile.safe_color_tokens.primary;
        if (/^#[0-9A-Fa-f]{6}$/.test(tokenColor)) {
          brandColor = tokenColor;
        }
      }
    }
  } catch (err) {
    console.error('[resolveStoreIdentity] Brand profile resolution error:', err);
  }

  if (resolvedLogoUrl) {
    return {
      storeName: store.name,
      storeSegment: store.segment,
      brandColor,
      logoUrl: resolvedLogoUrl,
      visualSignatureUrl: null,
      visualSignatureType: null,
      storeInitials,
      brandProfile,
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
      brandProfile,
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
    brandProfile,
  };
}
