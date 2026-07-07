import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandDirectorService, BrandDirectorAnalysisError } from '@/lib/brand-assets/brand-director';
import { BrandTextOnlyInferenceService, BrandTextOnlyInferenceError } from '@/lib/brand-assets/text-only-inference-service';
import { BrandProfilerWithoutLogoService, BrandProfilerWithoutLogoError } from '@/lib/visual-signature/brand-profiler';
import type { BrandProfilerInput } from '@/lib/visual-signature/types';
import type { BrandProfileRecord } from '@/lib/brand-assets/types';
import type { VisualSignatureRecord, VisualSignatureMetadataArtDirectorOutput } from '@/lib/visual-signature/types';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const realignLocks = new Map<string, boolean>();

/**
 * POST /api/store/[id]/brand-profile/realign
 *
 * Re-infers the brand profile based on the current identity_state.
 * The server decides the strategy exclusively by identity_state.
 *
 * text_only → BrandTextOnlyInferenceService (endpoint owns persistence)
 * logo     → BrandDirectorService (endpoint owns persistence)
 * visual_signature → BrandProfilerWithoutLogoService mode:'regenerate' (profiler owns persistence)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  requireSameOrigin(request);
  const id = (await params).id;
  await requireAuthorizedStore(id);

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  if (realignLocks.get(id)) {
    return NextResponse.json(
      { error: 'Realinhamento já em andamento para esta loja. Aguarde.' },
      { status: 429 },
    );
  }

  realignLocks.set(id, true);

  try {
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select()
      .eq('id', id)
      .single();

    if (storeError || !store) {
      realignLocks.delete(id);
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const identityState = store.identity_state;

    // ── LOGO PATH ──
    if (identityState === 'logo') {
      return handleLogoRealign(id, store, realignLocks);
    }

    // ── VISUAL SIGNATURE PATH ──
    if (identityState === 'visual_signature') {
      return handleVSRealign(id, store, realignLocks);
    }

    // ── TEXT-ONLY PATH (default) ──
    return handleTextOnlyRealign(id, store, realignLocks);

  } catch (err) {
    realignLocks.delete(id);
    return NextResponse.json({
      success: false,
      message: 'Erro interno no servidor.',
      error: err instanceof Error ? err.message : 'Erro interno',
    });
  }
}

// ──────────────────────────────────────────────
// TEXT-ONLY PATH
// ──────────────────────────────────────────────

async function handleTextOnlyRealign(
  id: string,
  store: any,
  locks: Map<string, boolean>,
): Promise<NextResponse> {
  const { data: currentProfile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', id)
    .eq('status', 'synced')
    .maybeSingle();

  try {
    const currentPrimary = store.brand_color
      ?? currentProfile?.safe_color_tokens?.primary
      ?? undefined;

    const currentAccent = (currentProfile?.brand_colors_chosen as Array<string | null> | undefined)?.[1]
      ?? currentProfile?.safe_color_tokens?.accent
      ?? currentProfile?.inferred_accent_color
      ?? undefined;

    const service = new BrandTextOnlyInferenceService();
    const timeoutMs = parseInt(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS ?? '30000', 10);
    const result = await service.infer({
      storeName: store.name,
      segment: store.segment,
      subsegment: store.subsegment ?? null,
      toneOfVoice: store.tone_of_voice ?? null,
      positioning: store.positioning ?? null,
      shortDescription: store.short_description ?? null,
      slogan: store.slogan ?? null,
      city: store.city ?? null,
      state: store.state ?? null,
      userPrimaryColor: currentPrimary,
      userAccentColor: currentAccent,
    });

    // Inference succeeded — mark current profile outdated (if any)
    if (currentProfile) {
      const { error: markError } = await supabase
        .from('store_brand_profiles')
        .update({ status: 'outdated', updated_at: new Date().toISOString() })
        .eq('id', currentProfile.id);

      if (markError) {
        console.error(`[realign/text_only] Failed to mark profile ${currentProfile.id} outdated: ${markError.message}`);
        // Non-fatal — continue to insert
      }
    }

    const inputSnapshot = buildStoreProfileInputSnapshot(store);

    const previousBrandColors = (currentProfile?.brand_colors_chosen as Array<string | null> | undefined)?.some(
      (c: string | null) => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c)
    )
      ? currentProfile.brand_colors_chosen
      : [];

    const { data: profile, error: insertError } = await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: id,
        source: 'text_only',
        brand_colors_chosen: previousBrandColors,
        safe_color_tokens: result.safe_color_tokens,
        visual_style: result.visual_style,
        visual_tone: result.visual_tone,
        typography_direction: result.typography_direction,
        brand_personality: result.brand_personality,
        campaign_guidelines: result.campaign_guidelines,
        campaign_brief: result.campaign_brief,
        inferred_primary_color: result.inferred_primary_color,
        inferred_accent_color: result.inferred_accent_color,
        confidence_score: result.confidence_score,
        metadata: { input_snapshot: inputSnapshot },
        status: 'synced',
      })
      .select()
      .single();

    if (insertError) {
      // COMPENSATION: insert failed — restore previous profile to synced
      if (currentProfile) {
        await supabase
          .from('store_brand_profiles')
          .update({ status: 'synced', updated_at: new Date().toISOString() })
          .eq('id', currentProfile.id);
        console.log(`[realign/text_only] Compensated: restored profile ${currentProfile.id} to synced after insert failure`);
      }
      locks.delete(id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update store state
    await supabase
      .from('stores')
      .update({
        identity_state: 'text_only',
        logo_status: IDENTITY_TO_LOGO_STATUS['text_only'],
        text_only_origin: 'explicit',
        brand_color: result.safe_color_tokens?.primary ?? store.brand_color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    locks.delete(id);
    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        status: profile.status,
        source: 'text_only',
        safe_color_tokens: result.safe_color_tokens,
        inferred_primary_color: result.inferred_primary_color,
        inferred_accent_color: result.inferred_accent_color,
        visual_style: result.visual_style,
        visual_tone: result.visual_tone,
        brand_personality: result.brand_personality,
        brand_colors_chosen: previousBrandColors,
        metadata: profile.metadata,
      },
    });
  } catch (err) {
    // Inference failed — current profile NOT marked outdated
    const message = err instanceof Error ? err.message : 'Erro interno';

    await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: id,
        source: 'text_only',
        status: 'failed',
        metadata: { error: message },
      })
      .select()
      .single();

    // Keep previous store state on failure
    locks.delete(id);
    return NextResponse.json({
      success: false,
      message: 'Não foi possível gerar a direção visual. Tente novamente.',
      error: message,
    });
  }
}

// ──────────────────────────────────────────────
// LOGO PATH
// ──────────────────────────────────────────────

async function handleLogoRealign(
  id: string,
  store: any,
  locks: Map<string, boolean>,
): Promise<NextResponse> {
  const { data: logoAsset } = await supabase
    .from('store_brand_assets')
    .select()
    .eq('store_id', id)
    .eq('variant_type', 'original')
    .eq('status', 'active')
    .maybeSingle();

  if (!logoAsset) {
    locks.delete(id);
    return NextResponse.json(
      { error: 'Nenhum logo ativo encontrado para realinhamento com logo.' },
      { status: 400 },
    );
  }

  const { data: currentProfile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', id)
    .eq('status', 'synced')
    .maybeSingle();

  try {
    let logoBuffer: Buffer | null = null;
    let logoMimeType = 'image/png';

    if (logoAsset.storage_path) {
      const { data: fileData } = await supabase
        .storage
        .from('store-brand-assets')
        .download(logoAsset.storage_path);

      if (fileData) {
        logoBuffer = Buffer.from(await fileData.arrayBuffer());
        logoMimeType = logoAsset.mime_type;
      }
    }

    const accentColor = (currentProfile?.brand_colors_chosen as Array<string | null> | undefined)?.[1]
      ?? currentProfile?.safe_color_tokens?.accent
      ?? null;

    const director = new BrandDirectorService();
    const analysis = await director.analyze({
      logoBuffer: logoBuffer ?? Buffer.from([]),
      logoMimeType,
      storeData: {
        storeName: store.name,
        segment: store.segment,
        subsegment: store.subsegment,
        city: store.city,
        state: store.state,
        tone_of_voice: store.tone_of_voice,
        positioning: store.positioning,
        short_description: store.short_description,
        slogan: store.slogan,
        userPrimaryColor: store.brand_color ?? undefined,
        userAccentColor: accentColor ?? undefined,
      },
    });

    // Inference succeeded — mark current profile outdated (if any)
    if (currentProfile) {
      const { error: markError } = await supabase
        .from('store_brand_profiles')
        .update({ status: 'outdated', updated_at: new Date().toISOString() })
        .eq('id', currentProfile.id);

      if (markError) {
        console.error(`[realign/logo] Failed to mark profile ${currentProfile.id} outdated: ${markError.message}`);
      }
    }

    const { data: profile, error: insertError } = await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: id,
        source: 'logo_analysis',
        active_logo_asset_id: logoAsset.id,
        logo_colors_detected: analysis.logo_colors_detected,
        brand_colors_chosen: currentProfile?.brand_colors_chosen ?? analysis.logo_colors_detected,
        safe_color_tokens: analysis.safe_color_tokens,
        visual_style: analysis.visual_style,
        visual_tone: analysis.visual_tone,
        typography_direction: analysis.typography_direction,
        brand_personality: analysis.brand_personality,
        campaign_guidelines: analysis.campaign_guidelines,
        campaign_brief: analysis.campaign_brief,
        inferred_primary_color: analysis.inferred_primary_color,
        inferred_accent_color: analysis.inferred_accent_color,
        confidence_score: analysis.confidence_score,
        metadata: {
          input_snapshot: buildStoreProfileInputSnapshot(store),
        },
        status: 'synced',
      })
      .select()
      .single();

    if (insertError) {
      // COMPENSATION: insert failed — restore previous profile to synced
      if (currentProfile) {
        await supabase
          .from('store_brand_profiles')
          .update({ status: 'synced', updated_at: new Date().toISOString() })
          .eq('id', currentProfile.id);
        console.log(`[realign/logo] Compensated: restored profile ${currentProfile.id} to synced after insert failure`);
      }
      locks.delete(id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update store state
    await supabase
      .from('stores')
      .update({
        identity_state: 'logo',
        logo_status: IDENTITY_TO_LOGO_STATUS['logo'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    locks.delete(id);
    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        status: profile.status,
        source: 'logo_analysis',
        safe_color_tokens: analysis.safe_color_tokens,
        inferred_primary_color: analysis.inferred_primary_color,
        inferred_accent_color: analysis.inferred_accent_color,
        visual_style: analysis.visual_style,
        visual_tone: analysis.visual_tone,
        brand_personality: analysis.brand_personality,
        brand_colors_chosen: currentProfile?.brand_colors_chosen ?? analysis.logo_colors_detected,
        metadata: profile.metadata,
      },
    });
  } catch (err) {
    // Inference failed — current profile NOT marked outdated
    if (err instanceof BrandDirectorAnalysisError) {
      const dc = err.deterministicResult;
      await supabase
        .from('store_brand_profiles')
        .insert({
          store_id: id,
          source: 'logo_analysis',
          active_logo_asset_id: logoAsset.id,
          logo_colors_detected: dc?.logo_colors_detected ?? [],
          safe_color_tokens: dc?.safe_color_tokens ?? null,
          inferred_primary_color: dc?.inferred_primary_color ?? null,
          inferred_accent_color: dc?.inferred_accent_color ?? null,
          status: 'failed',
          metadata: { error: err.message, errorType: err.metadata.errorType },
        })
        .select()
        .single();
    } else {
      await supabase
        .from('store_brand_profiles')
        .insert({
          store_id: id,
          source: 'logo_analysis',
          active_logo_asset_id: logoAsset.id,
          status: 'failed',
          metadata: { error: err instanceof Error ? err.message : 'Erro interno' },
        })
        .select()
        .single();
    }

    // Don't update store state on failure — preserve existing state
    locks.delete(id);
    return NextResponse.json({
      success: false,
      message: 'Não foi possível atualizar a direção visual. O perfil anterior foi mantido.',
      error: err instanceof Error ? err.message : 'Erro interno',
    });
  }
}

// ──────────────────────────────────────────────
// VISUAL SIGNATURE PATH
// ──────────────────────────────────────────────

async function handleVSRealign(
  id: string,
  store: any,
  locks: Map<string, boolean>,
): Promise<NextResponse> {
  // Load active VS for content_used
  const { data: activeVS } = await supabase
    .from('store_visual_signatures')
    .select()
    .eq('store_id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (!activeVS) {
    locks.delete(id);
    return NextResponse.json(
      { error: 'Nenhuma assinatura visual ativa encontrada para realinhamento.' },
      { status: 400 },
    );
  }

  const vsRecord = activeVS as VisualSignatureRecord;

  // Read content_used from VS metadata
  const artDirectorOutput = vsRecord.metadata?.artDirectorOutput as VisualSignatureMetadataArtDirectorOutput | undefined;
  const contentUsed = artDirectorOutput?.content_used ?? null;

  // Load current profile for previousBrandColors
  const { data: currentProfile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', id)
    .eq('status', 'synced')
    .maybeSingle();

  const previousBrandColors = (currentProfile?.brand_colors_chosen as Array<string | null> | undefined)?.some(
    (c: string | null) => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c)
  )
    ? currentProfile.brand_colors_chosen
    : [];

  // Extract intendedPalette from VS metadata
  const vsMetadata = vsRecord.metadata as Record<string, unknown> | null;
  const intendedPalette = (vsMetadata?.artDirectorOutput as Record<string, unknown> | undefined)
    ?.intended_palette as BrandProfilerInput['intendedPalette'] | undefined;

  try {
    const profiler = new BrandProfilerWithoutLogoService();
    const result = await profiler.generate({
      storeId: id,
      storeName: store.name,
      segment: store.segment,
      subsegment: store.subsegment ?? null,
      tone_of_voice: store.tone_of_voice ?? null,
      positioning: store.positioning ?? null,
      short_description: store.short_description ?? null,
      slogan: store.slogan ?? null,
      city: store.city ?? null,
      state: store.state ?? null,
      brandColor: store.brand_color ?? null,
      artDirectorOutput: (() => {
        const artOut = (vsRecord.metadata?.artDirectorOutput as unknown as Record<string, unknown>) ?? {};
        return {
          creative_description: String(artOut.creative_description ?? ''),
          suggested_colors: Array.isArray(artOut.suggested_colors) ? artOut.suggested_colors : [],
          visual_direction: String(artOut.visual_direction ?? ''),
          elements_used: Array.isArray(artOut.elements_used) ? artOut.elements_used : [],
        };
      })(),
      visualSignatureId: vsRecord.id,
      assetUrl: vsRecord.asset_url,
      referenceCardUrl: null,
      intendedPalette: intendedPalette ?? null,
      previousBrandColors: previousBrandColors,
      mode: 'regenerate',
      contentUsed: contentUsed as BrandProfilerInput['contentUsed'],
    });

    // Profiler handles 3 branches internally with compensation.
    // Identity state remains 'visual_signature' — no change to store.

    locks.delete(id);
    return NextResponse.json({
      success: true,
      profile: {
        id: result.profile.id,
        status: result.profile.status,
        source: 'without_logo',
        safe_color_tokens: result.profile.safe_color_tokens,
        inferred_primary_color: result.profile.inferred_primary_color,
        inferred_accent_color: result.profile.inferred_accent_color,
        visual_style: result.profile.visual_style,
        visual_tone: result.profile.visual_tone,
        brand_personality: result.profile.brand_personality,
        brand_colors_chosen: result.profile.brand_colors_chosen,
        metadata: result.profile.metadata,
      },
    });
  } catch (err) {
    // Profiler handles persistence internally (failed profile).
    // Previous profile NOT marked outdated (compensation inside profiler).
    const message = err instanceof Error ? err.message : 'Erro interno';

    locks.delete(id);
    return NextResponse.json({
      success: false,
      message: 'Não foi possível regenerar o perfil de marca. A assinatura visual foi mantida.',
      error: message,
    });
  }
}
