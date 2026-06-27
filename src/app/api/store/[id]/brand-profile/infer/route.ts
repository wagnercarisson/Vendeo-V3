import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandTextOnlyInferenceService } from '@/lib/brand-assets/text-only-inference-service';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const inferenceLocks = new Map<string, boolean>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  if (inferenceLocks.get(id)) {
    return NextResponse.json(
      { error: 'Inferência já em andamento para esta loja. Aguarde.' },
      { status: 429 }
    );
  }

  inferenceLocks.set(id, true);

  let body: {
    textOnlyOrigin: 'explicit' | 'implicit';
    userChosenColors?: Array<string | null>;
    manualColorOverride?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    inferenceLocks.delete(id);
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.textOnlyOrigin || !['explicit', 'implicit'].includes(body.textOnlyOrigin)) {
    inferenceLocks.delete(id);
    return NextResponse.json({ error: 'textOnlyOrigin é obrigatório (explicit ou implicit)' }, { status: 400 });
  }

  try {
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select()
      .eq('id', id)
      .single();

    if (storeError || !store) {
      inferenceLocks.delete(id);
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

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
      userPrimaryColor: body.userChosenColors?.[0] ?? undefined,
      userAccentColor: body.userChosenColors?.[1] ?? undefined,
    }, timeoutMs);

    // Preserve brand_colors_chosen from previous synced profile
    const { data: previousProfiles } = await supabase
      .from('store_brand_profiles')
      .select('brand_colors_chosen')
      .eq('store_id', id)
      .eq('status', 'synced')
      .order('updated_at', { ascending: false })
      .limit(1);
    const previousSyncedProfile = previousProfiles?.[0] ?? null;

    const hasUserColors = body.userChosenColors?.some(
      (c: string | null) => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c)
    );

    let brandColorsChosen: Array<string | null> = [];

    if (hasUserColors) {
      brandColorsChosen = body.userChosenColors ?? [];
    } else if ((previousSyncedProfile?.brand_colors_chosen as Array<string | null> | undefined)?.some(
      (c: string | null) => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c)
    )) {
      brandColorsChosen = previousSyncedProfile?.brand_colors_chosen ?? [];
    }

    await supabase
      .from('store_brand_profiles')
      .update({ status: 'outdated', updated_at: new Date().toISOString() })
      .eq('store_id', id)
      .eq('status', 'synced');

    const inputSnapshot = buildStoreProfileInputSnapshot(store);

    const { data: profile, error: insertError } = await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: id,
        source: 'text_only',
        brand_colors_chosen: brandColorsChosen,
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
      inferenceLocks.delete(id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { error: storeUpdateError } = await supabase
      .from('stores')
      .update({
        identity_state: 'text_only',
        text_only_origin: body.textOnlyOrigin,
        logo_status: 'explicit_none',
        brand_color: result.safe_color_tokens.primary ?? store.brand_color,
      })
      .eq('id', id);

    if (storeUpdateError) {
      inferenceLocks.delete(id);
      return NextResponse.json({ error: storeUpdateError.message }, { status: 500 });
    }

    inferenceLocks.delete(id);
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
        brand_colors_chosen: brandColorsChosen,
        metadata: profile.metadata,
      },
    });
  } catch (err) {
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

    await supabase
      .from('stores')
      .update({
        identity_state: 'text_only',
        text_only_origin: body.textOnlyOrigin,
        logo_status: 'explicit_none',
      })
      .eq('id', id);

    inferenceLocks.delete(id);
    return NextResponse.json({
      success: false,
      message: 'Não foi possível gerar a direção visual. Tente novamente.',
      error: message,
    });
  }
}
