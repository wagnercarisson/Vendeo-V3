import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandDirectorService, BrandDirectorAnalysisError } from '@/lib/brand-assets/brand-director';
import { validateBrandColorsChosen, normalizeBrandColorsChosen } from '@/lib/validators/color';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

const PLACEHOLDER_HEX = '#RRGGBB';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}

function cleanPlaceholderColors(colors: Array<string | null>): Array<string | null> {
  return colors.map(c => c === PLACEHOLDER_HEX ? null : c);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { colors } = body;

  if (!validateBrandColorsChosen(colors)) {
    return NextResponse.json(
      { error: 'colors deve ser um array com 0 ou 2 elementos, cada um sendo hex (#RRGGBB) ou null' },
      { status: 400 }
    );
  }

  const cleaned = cleanPlaceholderColors(colors);

  const { data: existing } = await supabase
    .from('store_brand_profiles')
    .select('id')
    .eq('store_id', id)
    .eq('status', 'synced')
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Nenhum perfil ativo encontrado' }, { status: 404 });
  }

  const normalizedColors = normalizeBrandColorsChosen(cleaned);

  const { data, error } = await supabase
    .from('store_brand_profiles')
    .update({
      brand_colors_chosen: normalizedColors,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.endsWith('/generate')) {
    return handleGenerate(request, id);
  }

  if (path.endsWith('/archive')) {
    return handleArchive(request, id);
  }

  return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
}

async function handleGenerate(_request: NextRequest, storeId: string) {
  try {
    const { data: store } = await supabase
      .from('stores')
      .select()
      .eq('id', storeId)
      .single();

    if (!store) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const { data: logoAsset } = await supabase
      .from('store_brand_assets')
      .select()
      .eq('store_id', storeId)
      .eq('variant_type', 'original')
      .eq('status', 'active')
      .single();

    let logoBuffer: Buffer | null = null;
    let logoMimeType = 'image/png';

    if (logoAsset?.storage_path) {
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('store-brand-assets')
        .download(logoAsset.storage_path);

      if (!downloadError && fileData) {
        logoBuffer = Buffer.from(await fileData.arrayBuffer());
        logoMimeType = logoAsset.mime_type;
      }
    }

    const director = new BrandDirectorService();
    const analysis = await director.analyze({
      logoBuffer: logoBuffer ?? Buffer.alloc(0),
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

    await supabase
      .from('store_brand_profiles')
      .update({ status: 'outdated', updated_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .eq('status', 'synced');

    const { data: profile, error: insertError } = await supabase
      .from('store_brand_profiles')
      .insert({
        store_id: storeId,
        source: 'logo_analysis',
        active_logo_asset_id: logoAsset?.id ?? null,
        logo_colors_detected: analysis.logo_colors_detected,
        brand_colors_chosen: analysis.logo_colors_detected,
        safe_color_tokens: analysis.safe_color_tokens,
        visual_style: analysis.visual_style,
        visual_tone: analysis.visual_tone,
        typography_direction: analysis.typography_direction,
        brand_personality: analysis.brand_personality,
        campaign_guidelines: analysis.campaign_guidelines,
        campaign_brief: analysis.campaign_brief,
        confidence_score: analysis.confidence_score,
        status: 'synced',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    if (err instanceof BrandDirectorAnalysisError) {
      const { data: failedProfile } = await supabase
        .from('store_brand_profiles')
        .insert({
          store_id: storeId,
          source: 'logo_analysis',
          status: 'failed',
          metadata: {
            error: err.message,
            errorType: err.metadata.errorType,
            provider: err.metadata.provider,
            model: err.metadata.model,
            elapsedMs: err.metadata.elapsedMs,
          },
        })
        .select()
        .single();

      return NextResponse.json(failedProfile ?? { error: err.message }, { status: 201 });
    }

    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 });
  }
}

async function handleArchive(_request: NextRequest, storeId: string) {
  const { data, error } = await supabase
    .from('store_brand_profiles')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .eq('status', 'synced')
    .select()
    .single();

  if (error && error.code === 'PGRST116') {
    return NextResponse.json({ error: 'Nenhum perfil ativo encontrado' }, { status: 404 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
