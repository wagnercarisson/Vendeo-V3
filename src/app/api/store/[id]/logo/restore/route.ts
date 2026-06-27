import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandDirectorService, BrandDirectorAnalysisError } from '@/lib/brand-assets/brand-director';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';
import { normalizeSnapshotValue, DRIFT_FIELDS } from '@/lib/drift';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';
import { reconcileProfiles } from '@/lib/brand-assets/profile-reconciliation';
import type { LogoRestoreRequest, LogoRestoreResponse, BrandProfileRecord } from '@/lib/brand-assets/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

function detectDrift(
  inputSnapshot: Record<string, string | null> | null | undefined,
  current: Record<string, string | null>,
): boolean {
  if (!inputSnapshot) return true;
  const fields: readonly string[] = DRIFT_FIELDS;
  return fields.some(f =>
    normalizeSnapshotValue(current[f] ?? null) !== normalizeSnapshotValue(inputSnapshot[f] ?? null)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  if (!validateUUID(storeId)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  let body: LogoRestoreRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }

  if (!body.asset_id || !validateUUID(body.asset_id)) {
    return NextResponse.json({ error: 'asset_id inválido ou ausente' }, { status: 400 });
  }

  // Validate asset belongs to this store (accepts archived for normal restore, active for retry)
  const { data: asset, error: assetError } = await supabase
    .from('store_brand_assets')
    .select()
    .eq('id', body.asset_id)
    .eq('store_id', storeId)
    .in('status', ['active', 'archived'])
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Asset não encontrado para esta loja' }, { status: 404 });
  }

  // Fetch store and current synced profile
  const { data: store } = await supabase
    .from('stores')
    .select()
    .eq('id', storeId)
    .single();

  if (!store) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  if (store.identity_state === 'visual_signature') {
    return NextResponse.json({
      error: 'Remova a assinatura visual ativa antes de restaurar um logotipo.',
      requires_identity_removal: true,
      current_identity_state: 'visual_signature',
    }, { status: 409 });
  }

  if (store.identity_state === 'logo') {
    return NextResponse.json({
      error: 'Remova o logotipo ativo antes de restaurar outro logotipo.',
      requires_logo_removal: true,
      current_identity_state: 'logo',
    }, { status: 409 });
  }

  const { data: currentProfile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', storeId)
    .eq('status', 'synced')
    .maybeSingle();

  // Archive current active assets (skip if target asset is already active — retry path)
  if (asset.status !== 'active') {
    await supabase
      .from('store_brand_assets')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .eq('status', 'active');
  }

  // Load profile associated with this asset via FK
  const { data: chosenProfile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('active_logo_asset_id', body.asset_id)
    .maybeSingle();

  const profileRecord = chosenProfile as BrandProfileRecord | null;
  const inputSnapshot = profileRecord?.metadata?.input_snapshot as Record<string, string | null> | null ?? null;

  const accentColor = currentProfile?.brand_colors_chosen?.[1]
    ?? currentProfile?.safe_color_tokens?.accent
    ?? currentProfile?.inferred_accent_color
    ?? null;

  const currentSnapshot = buildStoreProfileInputSnapshot(store);

  const hasDrift = detectDrift(inputSnapshot, currentSnapshot as unknown as Record<string, string | null>);

  // Resolve brand_color and accent_color for storeData
  const resolvedBrandColor = store.brand_color
    ?? currentProfile?.safe_color_tokens?.primary
    ?? null;

  const resolvedAccentColor = accentColor;

  if (!hasDrift) {
    // No-drift path
    if (profileRecord && profileRecord.status !== 'synced') {
      await reconcileProfiles(storeId, {
        activateProfileIds: [profileRecord.id],
        markIncompatibleAsOutdated: true,
        outdatedSources: ['without_logo', 'text_only'],
      });
    }

    // Reactivate assets
    await supabase
      .from('store_brand_assets')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', body.asset_id)
      .eq('store_id', storeId);

    // Also reactivate variants for this asset
    await supabase
      .from('store_brand_assets')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('parent_asset_id', body.asset_id)
      .eq('store_id', storeId);

    // Update stores
    await supabase
      .from('stores')
      .update({
        identity_state: 'logo',
        logo_status: IDENTITY_TO_LOGO_STATUS['logo'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId);

    const response: LogoRestoreResponse = {
      success: true,
      profile_id: profileRecord?.id ?? null,
      drift_detected: false,
      realigned: false,
    };

    return NextResponse.json(response, { status: 200 });
  }

  // Drift path
  let restoredProfile: BrandProfileRecord | null = null;
  let realigned = false;

  try {
    // Fetch the original logo buffer from storage
    const storagePath = asset.storage_path;
    let logoBuffer: Buffer | null = null;
    let logoMimeType = 'image/png';

    if (storagePath) {
      const { data: fileData } = await supabase
        .storage
        .from('store-brand-assets')
        .download(storagePath);

      if (fileData) {
        logoBuffer = Buffer.from(await fileData.arrayBuffer());
        logoMimeType = asset.mime_type;
      }
    }

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
      },
    });

    // Create new synced profile
      const previousBrandColors = (currentProfile?.brand_colors_chosen as Array<string | null> | undefined)?.some(
        (c: string | null) => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c)
      )
        ? currentProfile.brand_colors_chosen
        : [];

      const { data: newProfile } = await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: storeId,
        source: 'logo_analysis',
        active_logo_asset_id: body.asset_id,
        logo_colors_detected: analysis.logo_colors_detected,
        brand_colors_chosen: previousBrandColors,
        safe_color_tokens: analysis.safe_color_tokens,
        visual_style: analysis.visual_style,
        visual_tone: analysis.visual_tone,
        typography_direction: analysis.typography_direction,
        brand_personality: analysis.brand_personality,
        campaign_guidelines: analysis.campaign_guidelines,
        campaign_brief: analysis.campaign_brief,
        confidence_score: analysis.confidence_score,
        status: 'synced',
        metadata: {
          input_snapshot: currentSnapshot,
        },
      })
      .select()
      .single();

    if (newProfile) {
      await reconcileProfiles(storeId, {
        activateProfileIds: [newProfile.id],
        markIncompatibleAsOutdated: true,
        outdatedSources: ['without_logo', 'text_only'],
      });
    }

    restoredProfile = newProfile as BrandProfileRecord | null;
    realigned = true;
  } catch (err) {
    // BrandDirector failure on drift path: fallback preserved
    // Capture deterministic colors from error if available
    const dc = err instanceof BrandDirectorAnalysisError ? err.deterministicResult : null;

    // Insert failed profile
    const { data: failedProfile } = await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: storeId,
        source: 'logo_analysis',
        active_logo_asset_id: body.asset_id,
        logo_colors_detected: dc?.logo_colors_detected ?? [],
        safe_color_tokens: dc?.safe_color_tokens ?? null,
        inferred_primary_color: dc?.inferred_primary_color ?? null,
        inferred_accent_color: dc?.inferred_accent_color ?? null,
        status: 'failed',
        metadata: {
          error: err instanceof Error ? err.message : 'Brand Director analysis failed',
          attempt_snapshot: currentSnapshot,
        },
      })
      .select()
      .single();

    restoredProfile = failedProfile as BrandProfileRecord | null;
  }

  // Reactivate chosen assets (in all drift cases — even BD failure)
  await supabase
    .from('store_brand_assets')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', body.asset_id)
    .eq('store_id', storeId);

  await supabase
    .from('store_brand_assets')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('parent_asset_id', body.asset_id)
    .eq('store_id', storeId);

  // Update stores
  await supabase
    .from('stores')
    .update({
      identity_state: 'logo',
      logo_status: IDENTITY_TO_LOGO_STATUS['logo'],
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId);

  const response: LogoRestoreResponse = {
    success: realigned,
    profile_id: restoredProfile?.id ?? null,
    drift_detected: true,
    realigned,
    error: realigned ? undefined : 'Não foi possível atualizar a direção visual. Tente novamente.',
  };

  return NextResponse.json(response, { status: 200 });
}
