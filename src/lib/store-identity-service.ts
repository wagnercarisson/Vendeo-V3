import type { StoreIdentitySnapshot, BrandProfileSnapshot, IdentityState, ResolvedCampaignContext, CampaignInput } from "@/components/campaign/types";
import { getDefaultBrandColor, getStoreInitials } from "@/lib/store";
import type { Store } from "@/lib/store";
import { getActiveVisualSignature } from "@/lib/visual-signature/persistence";
import { supabaseAdmin } from '@/lib/supabase/server';
import type { BrandProfileRecord, BrandAssetRecord } from '@/lib/brand-assets/types';

function deriveDirective(state: IdentityState, hasAsset: boolean): string {
  if (state === 'text_only') {
    return "Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";
  }
  if (state === 'logo') {
    if (hasAsset) {
      return "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";
    }
    return "Não inventar logotipo. Usar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório.";
  }
  if (state === 'visual_signature') {
    if (hasAsset) {
      return "Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";
    }
    return "Não inventar assinatura visual nem logotipo. Considerar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório.";
  }
  return "Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";
}

export async function resolveStoreIdentity(
  store: Pick<Store, "id" | "name" | "logo_url" | "segment" | "brand_color" | "subsegment" | "tone_of_voice" | "positioning" | "short_description" | "slogan" | "identity_state">
): Promise<StoreIdentitySnapshot> {
  let brandColor = store.brand_color ?? getDefaultBrandColor(store.segment);
  const storeInitials = getStoreInitials(store.name);
  const identityState: IdentityState = (store.identity_state as IdentityState) ?? 'text_only';

  let brandProfile: BrandProfileSnapshot | null = null;
  let signatureUrl: string | null = null;
  let signatureType: 'logo' | 'visual_signature' | null = null;

  try {
    const { data: profileData } = await supabaseAdmin
      .from('store_brand_profiles')
      .select('*')
      .eq('store_id', store.id)
      .eq('status', 'synced')
      .maybeSingle();

    const profile = profileData as BrandProfileRecord | null;

    if (identityState === 'logo') {
      const { data: assetsData } = await supabaseAdmin
        .from('store_brand_assets')
        .select('*')
        .eq('store_id', store.id)
        .eq('status', 'active');

      const assets = (assetsData ?? []) as BrandAssetRecord[];
      if (assets.length > 0) {
        const normalized = assets.find(a => a.variant_type === 'normalized');
        const original = assets.find(a => a.variant_type === 'original');
        const onDark = assets.find(a => a.variant_type === 'on_dark');
        const logoAsset = normalized ?? original ?? onDark;

        if (logoAsset?.storage_path) {
          const { data: { publicUrl } } = supabaseAdmin.storage.from('store-brand-assets').getPublicUrl(logoAsset.storage_path);
          signatureUrl = publicUrl;
          signatureType = 'logo';
        }
      }
    } else if (identityState === 'visual_signature') {
      const activeSignature = await getActiveVisualSignature(store.id);
      if (activeSignature?.asset_url) {
        signatureUrl = activeSignature.asset_url;
        signatureType = 'visual_signature';
      }
    }

    if (profile) {
      if (profile.source === 'text_only' && profile.status === 'synced') {
        if (profile.safe_color_tokens?.primary && /^#[0-9A-Fa-f]{6}$/.test(profile.safe_color_tokens.primary)) {
          brandColor = profile.safe_color_tokens.primary;
        } else if (profile.inferred_primary_color && /^#[0-9A-Fa-f]{6}$/.test(profile.inferred_primary_color)) {
          brandColor = profile.inferred_primary_color;
        }
      }

      brandProfile = {
        brand_colors_chosen: profile.brand_colors_chosen ?? [],
        safe_color_tokens: profile.safe_color_tokens ?? {},
        visual_style: profile.visual_style,
        visual_tone: profile.visual_tone,
        brand_personality: profile.brand_personality,
        campaign_guidelines: profile.campaign_guidelines,
        campaign_brief: profile.campaign_brief,
      };

      if (profile.brand_colors_chosen?.length > 0) {
        const primaryColor = profile.brand_colors_chosen[0];
        if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
          brandColor = primaryColor;
        }
      } else if (profile.safe_color_tokens?.primary) {
        const tokenColor = profile.safe_color_tokens.primary;
        if (/^#[0-9A-Fa-f]{6}$/.test(tokenColor)) {
          brandColor = tokenColor;
        }
      }
    }

    if (!brandProfile) {
      try {
        const { data: withoutLogoData } = await supabaseAdmin
          .from('store_brand_profiles')
          .select('*')
          .eq('store_id', store.id)
          .eq('source', 'without_logo')
          .eq('status', 'synced')
          .maybeSingle();

        const withoutLogoProfile = withoutLogoData as BrandProfileRecord | null;

        if (withoutLogoProfile && (withoutLogoProfile.visual_style || withoutLogoProfile.visual_tone || withoutLogoProfile.brand_personality)) {
          brandProfile = {
            brand_colors_chosen: withoutLogoProfile.brand_colors_chosen ?? [],
            safe_color_tokens: withoutLogoProfile.safe_color_tokens ?? {},
            visual_style: withoutLogoProfile.visual_style,
            visual_tone: withoutLogoProfile.visual_tone,
            brand_personality: withoutLogoProfile.brand_personality,
            campaign_guidelines: withoutLogoProfile.campaign_guidelines,
            campaign_brief: withoutLogoProfile.campaign_brief,
          };

          if (withoutLogoProfile.brand_colors_chosen?.length > 0) {
            const primaryColor = withoutLogoProfile.brand_colors_chosen[0];
            if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
              brandColor = primaryColor;
            }
          }
        }
      } catch (err) {
        console.error('[resolveStoreIdentity] Without_logo profile resolution error:', err);
      }
    }
  } catch (err) {
    console.error('[resolveStoreIdentity] Resolution error:', err);
  }

  const directionFields = {
    toneOfVoice: store.tone_of_voice ?? null,
    subsegment: store.subsegment ?? null,
    positioning: store.positioning ?? null,
    shortDescription: store.short_description ?? null,
    slogan: store.slogan ?? null,
  };

  return {
    storeName: store.name,
    storeSegment: store.segment,
    brandColor,
    identityState,
    signature: {
      url: signatureUrl,
      type: signatureType,
    },
    storeInitials,
    brandProfile,
    ...directionFields,
  };
}

export async function validateIdentityReference(
  snapshot: StoreIdentitySnapshot
): Promise<StoreIdentitySnapshot> {
  if (!snapshot.signature.url) {
    return { ...snapshot };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(snapshot.signature.url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ...snapshot,
        signature: { ...snapshot.signature, url: null },
      };
    }

    return { ...snapshot };
  } catch (err) {
    return {
      ...snapshot,
      signature: { ...snapshot.signature, url: null },
    };
  }
}

export async function buildCampaignBrief(
  snapshot: StoreIdentitySnapshot,
  campaignInput: CampaignInput
): Promise<ResolvedCampaignContext> {
  const hasAsset = snapshot.signature.url !== null;
  const directive = deriveDirective(snapshot.identityState, hasAsset);

  return {
    campaignInput,
    store: {
      name: snapshot.storeName,
      segment: snapshot.storeSegment,
      subsegment: snapshot.subsegment,
      toneOfVoice: snapshot.toneOfVoice,
      positioning: snapshot.positioning,
      shortDescription: snapshot.shortDescription,
      slogan: snapshot.slogan,
      brandColor: snapshot.brandColor,
    },
    brandProfile: snapshot.brandProfile,
    identity: {
      state: snapshot.identityState,
      imageUrl: snapshot.signature.url,
      directive,
    },
  };
}
