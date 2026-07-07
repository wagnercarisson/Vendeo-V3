import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandDirectorService, BrandDirectorAnalysisError } from '@/lib/brand-assets/brand-director';
import type { BrandProfileRecord } from '@/lib/brand-assets/types';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  requireSameOrigin(request);
  const { id: storeId } = await params;
  await requireAuthorizedStore(storeId);
  if (!validateUUID(storeId)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  const { data: store } = await supabase
    .from('stores')
    .select()
    .eq('id', storeId)
    .single();

  if (!store) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  if (store.identity_state !== 'logo') {
    return NextResponse.json({
      error: 'O retry do BrandDirector só está disponível quando a loja está no estado logo.',
      current_identity_state: store.identity_state,
    }, { status: 409 });
  }

  const { data: activeAsset } = await supabase
    .from('store_brand_assets')
    .select()
    .eq('store_id', storeId)
    .eq('variant_type', 'original')
    .eq('status', 'active')
    .single();

  if (!activeAsset) {
    return NextResponse.json({ error: 'Nenhum asset de logotipo ativo encontrado.' }, { status: 400 });
  }

  const { data: latestProfile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const profileRecord = latestProfile as BrandProfileRecord | null;

  if (
    !profileRecord ||
    profileRecord.status !== 'failed' ||
    profileRecord.source !== 'logo_analysis' ||
    profileRecord.active_logo_asset_id !== activeAsset.id
  ) {
    return NextResponse.json({
      error: 'Nenhuma falha de análise prévia encontrada para o asset ativo.',
    }, { status: 400 });
  }

  const { data: fallbackProfile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', storeId)
    .eq('status', 'synced')
    .maybeSingle();

  const fallbackRecord = fallbackProfile as BrandProfileRecord | null;

  let logoBuffer: Buffer | null = null;
  let logoMimeType = 'image/png';

  if (activeAsset.storage_path) {
    const { data: fileData } = await supabase
      .storage
      .from('store-brand-assets')
      .download(activeAsset.storage_path);

    if (fileData) {
      logoBuffer = Buffer.from(await fileData.arrayBuffer());
      logoMimeType = activeAsset.mime_type;
    }
  }

  const currentSnapshot = buildStoreProfileInputSnapshot(store);

  const accentColor = fallbackRecord?.brand_colors_chosen?.[1]
    ?? fallbackRecord?.safe_color_tokens?.accent
    ?? fallbackRecord?.inferred_accent_color
    ?? undefined;

  const director = new BrandDirectorService();

  try {
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
        userPrimaryColor: store.brand_color,
        userAccentColor: accentColor,
      },
    });

    let previousBrandColors: Array<string | null> = [];

    if (fallbackRecord) {
      const hasColors = (fallbackRecord.brand_colors_chosen as Array<string | null> | undefined)?.some(
        (c: string | null) => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c)
      );
      previousBrandColors = hasColors ? (fallbackRecord.brand_colors_chosen as Array<string | null>) : [];

      const { error: markError } = await supabase
        .from('store_brand_profiles')
        .update({ status: 'outdated', updated_at: new Date().toISOString() })
        .eq('id', fallbackRecord.id);

      if (markError) {
        console.error('[retry-brand-director] Falha ao marcar fallback como outdated:', markError.message);
      }
    }

    const { data: newProfile, error: insertError } = await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: storeId,
        source: 'logo_analysis',
        active_logo_asset_id: activeAsset.id,
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
        inferred_primary_color: analysis.inferred_primary_color,
        inferred_accent_color: analysis.inferred_accent_color,
        status: 'synced',
        metadata: {
          input_snapshot: currentSnapshot,
        },
      })
      .select()
      .single();

    if (insertError || !newProfile) {
      console.error('[retry-brand-director] Falha ao inserir novo perfil:', insertError?.message);

      if (fallbackRecord) {
        const { error: restoreError } = await supabase
          .from('store_brand_profiles')
          .update({ status: 'synced', updated_at: new Date().toISOString() })
          .eq('id', fallbackRecord.id);

        if (restoreError) {
          console.error('[retry-brand-director] Falha ao restaurar fallback no rollback:', restoreError.message);
        }
      }

      return NextResponse.json({
        error: 'Não foi possível salvar o resultado da análise. O perfil anterior foi mantido. Tente novamente.',
        retry: true,
      }, { status: 500 });
    }

    return NextResponse.json({ profile: newProfile, success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof BrandDirectorAnalysisError) {
      return NextResponse.json({
        success: false,
        error: err.message,
        retry: true,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Erro interno ao executar BrandDirector',
      retry: true,
    }, { status: 200 });
  }
}
