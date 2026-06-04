"use server";

import type { StoreIdentitySnapshot, BrandProfileSnapshot } from "@/components/campaign/types";
import type { VisualSignatureType } from "@/lib/visual-signature/types";
import { getDefaultBrandColor, getStoreInitials } from "@/lib/store";
import type { Store } from "@/lib/store";
import { getActiveVisualSignature } from "@/lib/visual-signature/persistence";
import { supabaseAdmin } from '@/lib/supabase/server';
import type { BrandProfileRecord, BrandAssetRecord } from '@/lib/brand-assets/types';

export async function resolveStoreIdentity(
  store: Pick<Store, "id" | "name" | "logo_url" | "segment" | "brand_color" | "subsegment" | "tone_of_voice" | "positioning" | "short_description" | "slogan">
): Promise<StoreIdentitySnapshot> {
  let brandColor = store.brand_color ?? getDefaultBrandColor(store.segment);
  const storeInitials = getStoreInitials(store.name);

  let brandProfile: BrandProfileSnapshot | null = null;
  let resolvedLogoUrl: string | null = null;

  try {
    const [profileResult, assetsResult] = await Promise.all([
      supabaseAdmin.from('store_brand_profiles').select('*').eq('store_id', store.id).eq('status', 'synced').maybeSingle(),
      supabaseAdmin.from('store_brand_assets').select('*').eq('store_id', store.id).eq('status', 'active'),
    ]);

    const profile = profileResult.data as BrandProfileRecord | null;
    const assets = (assetsResult.data ?? []) as BrandAssetRecord[];

    if (profile && assets.length > 0) {
      const normalizedAsset = assets.find(a => a.variant_type === 'normalized');
      const originalAsset = assets.find(a => a.variant_type === 'original');
      const onDarkAsset = assets.find(a => a.variant_type === 'on_dark');

      const logoAsset = normalizedAsset ?? originalAsset ?? onDarkAsset;
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

  const directionFields = {
    toneOfVoice: store.tone_of_voice ?? null,
    subsegment: store.subsegment ?? null,
    positioning: store.positioning ?? null,
    shortDescription: store.short_description ?? null,
    slogan: store.slogan ?? null,
  };

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
      ...directionFields,
    };
  }

  let withoutLogoProfile: BrandProfileRecord | null = null;

  try {
    const { data } = await supabaseAdmin
      .from('store_brand_profiles')
      .select('*')
      .eq('store_id', store.id)
      .eq('source', 'without_logo')
      .eq('status', 'synced')
      .maybeSingle();
    withoutLogoProfile = data;
  } catch {
    withoutLogoProfile = null;
  }

  if (withoutLogoProfile) {
    if (withoutLogoProfile.visual_style || withoutLogoProfile.visual_tone || withoutLogoProfile.brand_personality) {
      brandProfile = {
        brand_colors_chosen: withoutLogoProfile.brand_colors_chosen ?? [],
        safe_color_tokens: withoutLogoProfile.safe_color_tokens ?? {},
        visual_style: withoutLogoProfile.visual_style,
        visual_tone: withoutLogoProfile.visual_tone,
        brand_personality: withoutLogoProfile.brand_personality,
        campaign_guidelines: withoutLogoProfile.campaign_guidelines,
        campaign_brief: withoutLogoProfile.campaign_brief,
        logoVariantUrl: null,
      };

      if (withoutLogoProfile.brand_colors_chosen?.length > 0) {
        const primaryColor = withoutLogoProfile.brand_colors_chosen[0];
        if (/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
          brandColor = primaryColor;
        }
      }
    }
  }

  const activeSignature = await getActiveVisualSignature(store.id);
  if (activeSignature) {
    // Rule: logo_status = generated → usar assinatura visual ativa
    // Prefill logoVariantUrl so the campaign generate-image endpoint
    // receives the correct asset URL for rendering.
    if (brandProfile && activeSignature.asset_url) {
      brandProfile = { ...brandProfile, logoVariantUrl: activeSignature.asset_url };
    }
    return {
      storeName: store.name,
      storeSegment: store.segment,
      brandColor,
      logoUrl: null,
      visualSignatureUrl: activeSignature.asset_url,
      visualSignatureType: activeSignature.type as VisualSignatureType,
      storeInitials,
      brandProfile,
      ...directionFields,
    };
  }

  if (brandProfile) {
    return {
      storeName: store.name,
      storeSegment: store.segment,
      brandColor,
      logoUrl: null,
      visualSignatureUrl: null,
      visualSignatureType: null,
      storeInitials,
      brandProfile,
      ...directionFields,
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
    ...directionFields,
  };
}
