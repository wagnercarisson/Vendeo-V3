import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { validateBrandColorsChosen, normalizeBrandColorsChosen } from '@/lib/validators/color';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

const PLACEHOLDER_HEX = '#RRGGBB';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireAuthorizedStore(id);
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');

  if (statusParam === 'synced') {
    const { data, error } = await supabase
      .from('store_brand_profiles')
      .select()
      .eq('store_id', id)
      .eq('status', 'synced')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  }

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
  requireSameOrigin(request);
  const { id } = await params;
  await requireAuthorizedStore(id);
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
  requireSameOrigin(request);
  const { id } = await params;
  await requireAuthorizedStore(id);
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.endsWith('/archive')) {
    return handleArchive(request, id);
  }

  return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
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
