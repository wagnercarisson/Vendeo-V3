import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { validateDrift } from '@/lib/visual-signature/drift-validator';
import { BrandProfilerWithoutLogoService } from '@/lib/visual-signature/brand-profiler';
import { updateGenerationEventDecision } from '@/lib/visual-signature/generation-events';
import { reconcileProfiles } from '@/lib/brand-assets/profile-reconciliation';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';
import { normalizeIntendedPalette } from '@/lib/visual-signature/types';
import type { VisualSignatureMetadataInputSnapshot, VisualSignatureMetadataArtDirectorOutput, VisualSignatureArtDirectorOutput, IntendedPalette } from '@/lib/visual-signature/types';
import { assertCanTransition, transition } from '@/lib/identity-transitions';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';
import { revalidateCriticalDrift } from '@/lib/visual-signature/drift-revalidator';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let approveRequestCounter = 0;

/**
 * Substitution approval (Tier 1 + Tier 2).
 * identity-transitions NOT called — state stays 'visual_signature'.
 */
async function handleSubstitution(
  store: Record<string, any>,
  signatureId: string,
  id: string,
  reqId: number,
): Promise<NextResponse> {
  console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO — guardas`);

  // Guard 1: identity_state === 'visual_signature'
  if (store.identity_state !== 'visual_signature') {
    console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO BLOQUEADA — identity_state inválido: ${store.identity_state}`);
    return NextResponse.json({
      success: false,
      code: 'INVALID_IDENTITY_STATE',
      error: 'Estado de identidade deve ser visual_signature',
    }, { status: 400 });
  }

  // Guard 2: active VS exists (the one that will be archived)
  const { data: activeVSList } = await supabase
    .from('store_visual_signatures')
    .select('*')
    .eq('store_id', id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1);
  const activeVS = activeVSList?.[0] ?? null;

  if (!activeVS) {
    console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO BLOQUEADA — nenhuma VS ativa encontrada`);
    return NextResponse.json({
      success: false,
      code: 'NO_ACTIVE_VS',
      error: 'Nenhuma assinatura visual ativa encontrada',
    }, { status: 404 });
  }
  console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO — VS ativa encontrada: ${activeVS.id}`);

  // Guard 3: revalidate drift against the ACTIVE VS (not the new signatureId)
  const activeVSMetadata = (activeVS.metadata ?? {}) as Record<string, unknown>;
  const activeVSArtDir = activeVSMetadata.artDirectorOutput as { content_used?: { slogan?: boolean; city?: boolean; state?: boolean } } | null ?? null;
  const vsContentUsed = activeVSArtDir?.content_used ?? null;
  const vsInputSnapshot = activeVSMetadata.input_snapshot as Record<string, unknown> | null ?? null;

  const revalidation = revalidateCriticalDrift({
    vsSnapshot: vsInputSnapshot as any,
    contentUsed: vsContentUsed ?? undefined,
    store: { name: store.name, segment: store.segment, slogan: store.slogan ?? null, city: store.city ?? null, state: store.state ?? null },
  });

  if (!revalidation.hasDrift) {
    console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO BLOQUEADA — drift crítico não confirmado contra VS ativa`, { reason: revalidation.reason });
    return NextResponse.json({
      success: false,
      code: 'DRIFT_NOT_CONFIRMED',
      error: 'Drift crítico não confirmado. Recalcule o diagnóstico.',
    }, { status: 400 });
  }

  // Guard 4: signatureId corresponds to a pending VS for this store
  const { data: pendingSig, error: pendingSigError } = await supabase
    .from('store_visual_signatures')
    .select()
    .eq('id', signatureId)
    .eq('store_id', id)
    .single();

  if (pendingSigError || !pendingSig) {
    console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO BLOQUEADA — signature não encontrada`);
    return NextResponse.json({ error: 'Assinatura visual não encontrada' }, { status: 404 });
  }

  console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO — guardas OK. Iniciando Tier 1 (Archive/Activate)...`);

  // ===== Tier 1 — Archive/Activate with compensation =====
  const activeVSId = activeVS.id;

  // a. Archive previous active VS
  const { error: archiveError } = await supabase
    .from('store_visual_signatures')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', activeVSId)
    .eq('status', 'active');

  if (archiveError) {
    console.error(`[approve][req-${reqId}] SUBSTITUIÇÃO — archive falhou: ${archiveError.message}`);
    return NextResponse.json({ error: 'Falha ao arquivar assinatura anterior' }, { status: 500 });
  }

  // b. Activate new signature
  const { error: activateError } = await supabase
    .from('store_visual_signatures')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', signatureId);

  if (activateError) {
    console.error(`[approve][req-${reqId}] SUBSTITUIÇÃO — activation falhou. Restaurando VS anterior...`);

    // c. Restore old active
    const { error: restoreError } = await supabase
      .from('store_visual_signatures')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', activeVSId);

    if (restoreError) {
      console.error(`[approve][req-${reqId}] SUBSTITUIÇÃO — CRÍTICO: restore também falhou. Intervenção manual necessária.`, { activeVSId, restoreError });
      return NextResponse.json({
        error: 'Falha crítica: assinatura anterior não pôde ser restaurada. Intervenção manual necessária.',
        visual_signature_id_anterior: activeVSId,
        visual_signature_id_nova: null,
      }, { status: 500 });
    }

    console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO — VS anterior restaurada com sucesso`);
    return NextResponse.json({
      success: false,
      error: 'Não foi possível ativar a nova assinatura. A assinatura anterior foi restaurada.',
      visual_signature_id_anterior: activeVSId,
      visual_signature_id_nova: null,
    }, { status: 500 });
  }

  console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO — Tier 1 OK. VS ativada: ${signatureId}`);

  // ===== Tier 2 — BP Generation (fallback: does NOT undo activation) =====
  console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO — Tier 2: BrandProfilerWithoutLogo...`);

  // Build artDirectorOutput from the pending signature's metadata
  const pendingMetadata = (pendingSig.metadata ?? {}) as Record<string, unknown>;
  const artDirectorOutput = (pendingMetadata.artDirectorOutput ?? {
    creative_description: `Assinatura visual para ${store.name} (${store.segment})`,
    suggested_colors: store.brand_color ? [store.brand_color] : [],
    visual_direction: 'Personalizada',
    elements_used: ['nome da loja'],
  }) as VisualSignatureArtDirectorOutput;

  const contentUsed = (artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput).content_used ?? {
    store_name: true,
    city: false,
    state: false,
    slogan: false,
  };

  // Extract intendedPalette from signature metadata
  const artDirectorMetadata = pendingMetadata.artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput | null ?? null;
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
      visualSignatureId: signatureId,
      assetUrl: pendingSig.asset_url,
      referenceCardUrl: null,
      intendedPalette,
      previousBrandColors,
    });

    console.log(`[approve][req-${reqId}] SUBSTITUIÇÃO — Tier 2 BP OK`, { profileId: result.profile.id });

    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    const inferredPrimaryColor = sanitizeHex(result.profile.inferred_primary_color, '#666666');
    const inferredAccentColor = sanitizeHex(result.profile.inferred_accent_color, '#999999');

    const newMetadata = (result.profile.metadata ?? {}) as Record<string, unknown>;
    await supabase
      .from('store_brand_profiles')
      .update({
        metadata: {
          ...newMetadata,
          input_snapshot: buildStoreProfileInputSnapshot(store as Parameters<typeof buildStoreProfileInputSnapshot>[0]),
          content_used: contentUsed,
        },
      })
      .eq('id', result.profile.id);

    const logoColorsDetected = (result.profile.logo_colors_detected ?? [])
      .filter((c: string) => /^#[0-9A-Fa-f]{6}$/.test(c))
      .map((c: string) => c.toUpperCase());

    return NextResponse.json({
      success: true,
      signature: {
        id: pendingSig.id,
        assetUrl: pendingSig.asset_url,
        status: 'active',
      },
      brandProfile: { id: result.profile.id, status: 'synced' },
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
      bp_status: 'success',
      visual_signature_id: signatureId,
    });
  } catch (err) {
    console.error(`[approve][req-${reqId}] SUBSTITUIÇÃO — Tier 2 BP FAILED (activation NOT undone)`, err);

    // BP insert failed — restore previous profile to synced if possible
    try {
      await supabase
        .from('store_brand_profiles')
        .update({ status: 'synced', updated_at: new Date().toISOString() })
        .eq('store_id', id)
        .eq('status', 'outdated')
        .eq('source', 'without_logo');
    } catch (restoreErr) {
      console.error(`[approve][req-${reqId}] SUBSTITUIÇÃO — fallback restore failed (non-critical):`, restoreErr);
    }

    // Return 200 with warning — new VS stays active, BP can be retried via /realign
    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    const fallbackPrimary = (artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput)?.intended_palette?.primary
      ?? (artDirectorOutput as any)?.suggested_colors?.[0]
      ?? store.brand_color
      ?? null;
    const fallbackAccent = (artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput)?.intended_palette?.accent
      ?? (artDirectorOutput as any)?.suggested_colors?.[1]
      ?? null;
    const inferredPrimaryColor = sanitizeHex(fallbackPrimary, '#666666');
    const inferredAccentColor = sanitizeHex(fallbackAccent, '#999999');
    const logoColorsDetected = [inferredPrimaryColor, inferredAccentColor]
      .filter((c): c is string => /^#[0-9A-Fa-f]{6}$/.test(c));

    return NextResponse.json({
      success: true,
      signature: {
        id: pendingSig.id,
        assetUrl: pendingSig.asset_url,
        status: 'active',
      },
      brandProfile: { id: '', status: 'failed' },
      inferredPrimaryColor,
      inferredAccentColor,
      logoColorsDetected,
      logoStatus: 'generated',
      brandProfileData: null,
      bp_status: 'failed',
      visual_signature_id: signatureId,
      warning: 'Assinatura visual ativada. Geração de perfil de marca falhou — pode ser retentada via /brand-profile/realign.',
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  requireSameOrigin(request);
  const { id } = await params;
  await requireAuthorizedStore(id);
  const reqId = ++approveRequestCounter;
  console.log(`[approve][req-${reqId}] 1/12 request recebido`, { storeId: id });

  if (!UUID_REGEX.test(id)) {
    console.log(`[approve][req-${reqId}] ID da loja inválido`);
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  let body: { signatureId: string; mode?: 'standard' | 'substitution' };
  try {
    body = await request.json();
    console.log(`[approve][req-${reqId}] body parsed`, { signatureId: body.signatureId, mode: body.mode });
  } catch {
    console.log(`[approve][req-${reqId}] JSON inválido`);
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.signatureId || !UUID_REGEX.test(body.signatureId)) {
    console.log(`[approve][req-${reqId}] signatureId inválido`);
    return NextResponse.json({ error: 'signatureId inválido' }, { status: 400 });
  }

  const mode = body.mode ?? 'standard';
  console.log(`[approve][req-${reqId}] mode: ${mode}`);

  // Load store (shared between modes)
  console.log(`[approve][req-${reqId}] carregando store...`);
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select()
    .eq('id', id)
    .single();

  if (storeError || !store) {
    console.log(`[approve][req-${reqId}] store não encontrada`, { error: storeError?.message });
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }
  console.log(`[approve][req-${reqId}] store carregada:`, { name: store.name, identity_state: store.identity_state });

  // ===== Substitution mode =====
  if (mode === 'substitution') {
    return handleSubstitution(store, body.signatureId, id, reqId);
  }

  // ===== Standard mode (existing flow, unchanged) =====
  const preCheck = await assertCanTransition(id, 'text_only_to_visual_signature');
  if (!preCheck.ok) {
    console.log(`[approve][req-${reqId}] state validation failed: ${preCheck.error}`);
    return NextResponse.json({
      error: preCheck.error,
      current_identity_state: id,
    }, { status: preCheck.status });
  }

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

  console.log(`[approve][req-${reqId}] carregando signature...`);
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
    const artDirectorOutput = metadata.artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput | null ?? null;

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

  console.log(`[approve][req-${reqId}] arquivando assinaturas anteriores...`);
  await supabase
    .from('store_visual_signatures')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('store_id', id)
    .eq('status', 'active');

  console.log(`[approve][req-${reqId}] ativando signature atual...`);
  await supabase
    .from('store_visual_signatures')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', body.signatureId);

  const attempts = store.visual_signature_attempts ?? 0;
  console.log(`[approve][req-${reqId}] atualizando store via transition...`);
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

  console.log(`[approve][req-${reqId}] atualizando generation_event decision...`);
  await updateGenerationEventDecision(body.signatureId, attempts, {
    approved: true,
  });

  const artDirectorOutput = (signature.metadata?.artDirectorOutput ?? {
    creative_description: `Assinatura visual para ${store.name} (${store.segment})`,
    suggested_colors: store.brand_color ? [store.brand_color] : [],
    visual_direction: 'Personalizada',
    elements_used: ['nome da loja'],
  }) as VisualSignatureArtDirectorOutput;

  const contentUsed = (artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput).content_used ?? {
    store_name: true,
    city: false,
    state: false,
    slogan: false,
  };

  // Check if a brand profile already exists for this visual_signature_id
  console.log(`[approve][req-${reqId}] checking for existing brand profile...`);
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
    console.log(`[approve][req-${reqId}] found existing profile (${existingProfile.status}), reactivating`);

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
          input_snapshot: buildStoreProfileInputSnapshot(store as Parameters<typeof buildStoreProfileInputSnapshot>[0]),
          content_used: contentUsed,
        },
      })
      .eq('id', existingProfile.id);

    console.log(`[approve][req-${reqId}] returning reused profile`);
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

  console.log(`[approve][req-${reqId}] no existing profile, starting BrandProfilerWithoutLogoService...`);

  // Extract intendedPalette from signature metadata
  const signatureMetadata = (signature.metadata ?? {}) as Record<string, unknown>;
  const artDirectorMetadata = signatureMetadata.artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput | null ?? null;
  const rawIntendedPalette = artDirectorMetadata?.intended_palette;
  const intendedPaletteLocal: IntendedPalette | null = rawIntendedPalette
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
      intendedPalette: intendedPaletteLocal,
      previousBrandColors,
    });

    console.log(`[approve][req-${reqId}] BrandProfiler OK`, { profileId: result.profile.id });
    brandProfileResult = {
      id: result.profile.id,
      status: result.profile.status,
    };

    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    inferredPrimaryColor = sanitizeHex(result.profile.inferred_primary_color, '#666666');
    inferredAccentColor = sanitizeHex(result.profile.inferred_accent_color, '#999999');

    const newMetadata = (result.profile.metadata ?? {}) as Record<string, unknown>;
    await supabase
      .from('store_brand_profiles')
      .update({
        metadata: {
          ...newMetadata,
          input_snapshot: buildStoreProfileInputSnapshot(store as Parameters<typeof buildStoreProfileInputSnapshot>[0]),
          content_used: contentUsed,
        },
      })
      .eq('id', result.profile.id);
    const logoColorsDetected = (result.profile.logo_colors_detected ?? [])
      .filter((c: string) => /^#[0-9A-Fa-f]{6}$/.test(c))
      .map((c: string) => c.toUpperCase());

    console.log(`[approve][req-${reqId}] enviando response`, { inferredPrimaryColor, inferredAccentColor, logoColorsDetected });
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
    console.error(`[approve][req-${reqId}] BrandProfiler FAILED`, err);
    brandProfileResult = { id: '', status: 'failed' };

    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    const fallbackPrimary = (artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput)?.intended_palette?.primary
      ?? (artDirectorOutput as any)?.suggested_colors?.[0]
      ?? store.brand_color
      ?? null;
    const fallbackAccent = (artDirectorOutput as unknown as VisualSignatureMetadataArtDirectorOutput)?.intended_palette?.accent
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
