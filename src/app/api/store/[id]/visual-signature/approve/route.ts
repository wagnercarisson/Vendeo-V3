import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { validateDrift } from '@/lib/visual-signature/drift-validator';
import { BrandProfilerWithoutLogoService } from '@/lib/visual-signature/brand-profiler';
import { updateGenerationEventDecision } from '@/lib/visual-signature/generation-events';
import { reconcileProfiles } from '@/lib/brand-assets/profile-reconciliation';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';
import { normalizeIntendedPalette } from '@/lib/visual-signature/types';
import type { VisualSignatureMetadataInputSnapshot, VisualSignatureMetadataArtDirectorOutput, IntendedPalette } from '@/lib/visual-signature/types';
import { assertCanTransition, transition } from '@/lib/identity-transitions';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let approveRequestCounter = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = ++approveRequestCounter;
  const { id } = await params;
  console.log(`[approve][req-${reqId}] 1/12 request recebido`, { storeId: id });

  if (!UUID_REGEX.test(id)) {
    console.log(`[approve][req-${reqId}] ID da loja inválido`);
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  let body: { signatureId: string };
  try {
    body = await request.json();
    console.log(`[approve][req-${reqId}] body parsed`, { signatureId: body.signatureId });
  } catch {
    console.log(`[approve][req-${reqId}] JSON inválido`);
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.signatureId || !UUID_REGEX.test(body.signatureId)) {
    console.log(`[approve][req-${reqId}] signatureId inválido`);
    return NextResponse.json({ error: 'signatureId inválido' }, { status: 400 });
  }

  const preCheck = await assertCanTransition(id, 'text_only_to_visual_signature');
  if (!preCheck.ok) {
    console.log(`[approve][req-${reqId}] state validation failed: ${preCheck.error}`);
    return NextResponse.json({
      error: preCheck.error,
      current_identity_state: id,
    }, { status: preCheck.status });
  }

  console.log(`[approve][req-${reqId}] 2/12 carregando store...`);
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select()
    .eq('id', id)
    .single();

  if (storeError || !store) {
    console.log(`[approve][req-${reqId}] store não encontrada`, { error: storeError?.message });
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }
  console.log(`[approve][req-${reqId}] store carregada:`, { name: store.name });

  const inputSnapshot: VisualSignatureMetadataInputSnapshot = {
    name: store.name,
    segment: store.segment,
    subsegment: store.subsegment,
    tone_of_voice: store.tone_of_voice,
    positioning: store.positioning,
    short_description: store.short_description,
    slogan: store.slogan,
    city: store.city,
    state: store.state,
    brand_color: store.brand_color,
    accent_color: null,
  };

  console.log(`[approve][req-${reqId}] 3/12 carregando signature...`);
  const { data: signature, error: sigError } = await supabase
    .from('store_visual_signatures')
    .select()
    .eq('id', body.signatureId)
    .eq('store_id', id)
    .single();

  if (sigError || !signature) {
    console.log(`[approve][req-${reqId}] signature não encontrada`, { error: sigError?.message });
    return NextResponse.json({ error: 'Assinatura visual não encontrada' }, { status: 404 });
  }
  console.log(`[approve][req-${reqId}] signature carregada status=${signature.status}`);

  if (signature.status === 'archived') {
    const metadata = (signature.metadata ?? {}) as Record<string, unknown>;
    const inputSnapshot = metadata.input_snapshot as VisualSignatureMetadataInputSnapshot | null ?? null;
    const artDirectorOutput = metadata.artDirectorOutput as VisualSignatureMetadataArtDirectorOutput | null ?? null;

    const driftResult = validateDrift({
      input_snapshot: inputSnapshot,
      content_used: artDirectorOutput?.content_used ?? null,
      currentStoreData: {
        name: store.name,
        segment: store.segment,
        city: store.city,
        state: store.state,
        slogan: store.slogan,
      },
    });

    if (driftResult.has_drift) {
      console.log(`[approve][req-${reqId}] drift detectado — bloqueando restore de signature arquivada`, { fields: driftResult.fields, reason: driftResult.reason });
      return NextResponse.json({
        success: false,
        error: 'Os dados da loja mudaram desde que esta assinatura foi gerada. Crie uma nova versão.',
        drift: {
          fields: driftResult.fields,
          reason: driftResult.reason,
          requires_regeneration: driftResult.requires_regeneration,
        },
      }, { status: 409 });
    }
  }

  console.log(`[approve][req-${reqId}] 4/12 arquivando assinaturas anteriores...`);
  await supabase
    .from('store_visual_signatures')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('store_id', id)
    .eq('status', 'active');

  console.log(`[approve][req-${reqId}] 5/12 ativando signature atual...`);
  await supabase
    .from('store_visual_signatures')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', body.signatureId);

  const attempts = store.visual_signature_attempts ?? 0;
  console.log(`[approve][req-${reqId}] 6/12 atualizando store via transition...`);
  const transitionResult = await transition(id, 'text_only_to_visual_signature', {
    onCriticalPersistence: async () => {},
    onCompensate: async () => {
      await supabase
        .from('store_visual_signatures')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', body.signatureId);
    },
  });

  if (!transitionResult.success) {
    console.log(`[approve][req-${reqId}] transition failed: ${transitionResult.error}`);
    return NextResponse.json({ error: transitionResult.error }, { status: 500 });
  }

  await supabase
    .from('stores')
    .update({ visual_signature_attempts: 0, updated_at: new Date().toISOString() })
    .eq('id', id);

  console.log(`[approve][req-${reqId}] 7/12 atualizando generation_event decision...`);
  await updateGenerationEventDecision(body.signatureId, attempts, {
    approved: true,
  });

  const artDirectorOutput = signature.metadata?.artDirectorOutput ?? {
    creative_description: `Assinatura visual para ${store.name} (${store.segment})`,
    suggested_colors: store.brand_color ? [store.brand_color] : [],
    visual_direction: 'Personalizada',
    elements_used: ['nome da loja'],
  };

  const contentUsed = (artDirectorOutput as VisualSignatureMetadataArtDirectorOutput).content_used ?? {
    store_name: true,
    city: false,
    state: false,
    slogan: false,
  };

  // 8/12 Check if a brand profile already exists for this visual_signature_id
  // Switching to an existing signature should reuse its cached profile, not call GPT again.
  // Only reuse profiles with complete data (synced or outdated), never failed ones.
  console.log(`[approve][req-${reqId}] 8/12 checking for existing brand profile...`);
  // Use order().limit(1) instead of maybeSingle() because existing
  // duplicate profiles (created before UPSERT fix) cause maybeSingle()
  // to return null even when matches exist, defeating profile reuse.
  const { data: existingProfiles } = await supabase
    .from('store_brand_profiles')
    .select('*')
    .eq('visual_signature_id', body.signatureId)
    .eq('source', 'without_logo')
    .in('status', ['synced', 'outdated'])
    .order('updated_at', { ascending: false })
    .limit(1);
  const existingProfile = existingProfiles?.[0] ?? null;

  if (existingProfile) {
    console.log(`[approve][req-${reqId}] 8b/12 found existing profile (${existingProfile.status}), reactivating`);

    await reconcileProfiles(id, {
      activateProfileIds: [existingProfile.id],
      markIncompatibleAsOutdated: true,
    });

    const sanitize = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    const pColor = sanitize(existingProfile.inferred_primary_color, '#666666');
    const aColor = sanitize(existingProfile.inferred_accent_color, '#999999');
    const detected = (existingProfile.logo_colors_detected ?? [])
      .filter((c: string) => /^#[0-9A-Fa-f]{6}$/.test(c))
      .map((c: string) => c.toUpperCase());

    const existingMetadata = (existingProfile.metadata ?? {}) as Record<string, unknown>;
    await supabase
      .from('store_brand_profiles')
      .update({
        metadata: {
          ...existingMetadata,
          input_snapshot: {
            ...inputSnapshot,
            brand_color: pColor,
            accent_color: aColor,
          },
          content_used: contentUsed,
        },
      })
      .eq('id', existingProfile.id);

    console.log(`[approve][req-${reqId}] 9/12 returning reused profile`);
    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        assetUrl: signature.asset_url,
        status: 'active',
      },
      brandProfile: { id: existingProfile.id, status: 'synced' },
      inferredPrimaryColor: pColor,
      inferredAccentColor: aColor,
      logoColorsDetected: detected.length > 0 ? detected : [pColor],
      logoStatus: 'generated',
      brandProfileData: {
        safe_color_tokens: existingProfile.safe_color_tokens,
        visual_style: existingProfile.visual_style,
        visual_tone: existingProfile.visual_tone,
        brand_personality: existingProfile.brand_personality,
        brand_colors_chosen: existingProfile.brand_colors_chosen,
        inferred_primary_color: existingProfile.inferred_primary_color,
        inferred_accent_color: existingProfile.inferred_accent_color,
        metadata: existingProfile.metadata,
      },
    });
  }

  let brandProfileResult: { id: string; status: string } | null = null;
  let inferredPrimaryColor: string | null = null;
  let inferredAccentColor: string | null = null;

  console.log(`[approve][req-${reqId}] 9/12 no existing profile, starting BrandProfilerWithoutLogoService...`);

  // Extract intendedPalette from signature metadata
  const signatureMetadata = (signature.metadata ?? {}) as Record<string, unknown>;
  const artDirectorMetadata = signatureMetadata.artDirectorOutput as VisualSignatureMetadataArtDirectorOutput | null ?? null;
  const rawIntendedPalette = artDirectorMetadata?.intended_palette;
  const intendedPalette: IntendedPalette | null = rawIntendedPalette
    ? normalizeIntendedPalette(rawIntendedPalette)
    : null;

  // Load previousBrandColors from last synced profile's brand_colors_chosen directly
  let previousBrandColors: Array<string | null> = [];
  try {
    const { data: lastSynced } = await supabase
      .from('store_brand_profiles')
      .select('brand_colors_chosen')
      .eq('store_id', id)
      .eq('status', 'synced')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (lastSynced?.[0]) {
      const chosen = lastSynced[0].brand_colors_chosen as Array<string | null> | null;
      if (chosen?.some(c => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c))) {
        previousBrandColors = chosen;
      }
    }
  } catch (err) {
    console.error(`[approve][req-${reqId}] Error loading previousBrandColors:`, err);
  }

  try {
    const profiler = new BrandProfilerWithoutLogoService();
    const result = await profiler.generate({
      storeId: id,
      storeName: store.name,
      segment: store.segment,
      subsegment: store.subsegment,
      tone_of_voice: store.tone_of_voice,
      positioning: store.positioning,
      short_description: store.short_description,
      slogan: store.slogan,
      city: store.city,
      state: store.state,
      brandColor: store.brand_color,
      artDirectorOutput,
      visualSignatureId: body.signatureId,
      assetUrl: signature.asset_url,
      referenceCardUrl: null,
      intendedPalette,
      previousBrandColors,
    });

    console.log(`[approve][req-${reqId}] 10/12 BrandProfiler OK`, { profileId: result.profile.id });
    brandProfileResult = {
      id: result.profile.id,
      status: result.profile.status,
    };

    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    inferredPrimaryColor = sanitizeHex(result.profile.inferred_primary_color, '#666666');
    inferredAccentColor = sanitizeHex(result.profile.inferred_accent_color, '#999999');

    const accentColor: string | null = result.profile.brand_colors_chosen?.[1]
      ?? result.profile.safe_color_tokens?.accent
      ?? result.profile.inferred_accent_color
      ?? null;

    const newMetadata = (result.profile.metadata ?? {}) as Record<string, unknown>;
    await supabase
      .from('store_brand_profiles')
      .update({
        metadata: {
          ...newMetadata,
          input_snapshot: {
            ...inputSnapshot,
            brand_color: inferredPrimaryColor,
            accent_color: accentColor,
          },
          content_used: contentUsed,
        },
      })
      .eq('id', result.profile.id);
    const logoColorsDetected = (result.profile.logo_colors_detected ?? [])
      .filter((c: string) => /^#[0-9A-Fa-f]{6}$/.test(c))
      .map((c: string) => c.toUpperCase());

    console.log(`[approve][req-${reqId}] 11/12 enviando response`, { inferredPrimaryColor, inferredAccentColor, logoColorsDetected });
    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        assetUrl: signature.asset_url,
        status: 'active',
      },
      brandProfile: brandProfileResult,
      inferredPrimaryColor,
      inferredAccentColor,
      logoColorsDetected,
      logoStatus: 'generated',
      brandProfileData: {
        safe_color_tokens: result.profile.safe_color_tokens,
        visual_style: result.profile.visual_style,
        visual_tone: result.profile.visual_tone,
        brand_personality: result.profile.brand_personality,
        brand_colors_chosen: result.profile.brand_colors_chosen,
        inferred_primary_color: result.profile.inferred_primary_color,
        inferred_accent_color: result.profile.inferred_accent_color,
        metadata: result.profile.metadata,
      },
    });
  } catch (err) {
    console.error(`[approve][req-${reqId}] 12/12 BrandProfiler FAILED`, err);
    brandProfileResult = { id: '', status: 'failed' };

    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    const fallbackPrimary = (artDirectorOutput as VisualSignatureMetadataArtDirectorOutput)?.intended_palette?.primary
      ?? (artDirectorOutput as any)?.suggested_colors?.[0]
      ?? store.brand_color
      ?? null;
    const fallbackAccent = (artDirectorOutput as VisualSignatureMetadataArtDirectorOutput)?.intended_palette?.accent
      ?? (artDirectorOutput as any)?.suggested_colors?.[1]
      ?? null;
    inferredPrimaryColor = sanitizeHex(fallbackPrimary, '#666666');
    inferredAccentColor = sanitizeHex(fallbackAccent, '#999999');
    const logoColorsDetected = [inferredPrimaryColor, inferredAccentColor]
      .filter((c): c is string => /^#[0-9A-Fa-f]{6}$/.test(c));

    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        assetUrl: signature.asset_url,
        status: 'active',
      },
      brandProfile: brandProfileResult,
      inferredPrimaryColor,
      inferredAccentColor,
      logoColorsDetected,
      logoStatus: 'generated',
      brandProfileData: null,
    });
  }
}
