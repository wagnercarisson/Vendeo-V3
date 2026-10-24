import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { validateBrandColorsChosen, normalizeBrandColorsChosen } from '@/lib/validators/color';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';
import { apiHandler } from '@/lib/auth/api-handler';
import {
  deriveBrandProfileState,
  type BrandProfileSnapshotFields,
} from '@/lib/visual-signature/brand-profile-state';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

const PLACEHOLDER_HEX = '#RRGGBB';

export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  await requireAuthorizedStore(id);
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const viewParam = url.searchParams.get('view');

  if (viewParam === "state") {
    return getProfileState(id);
  }

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
});

function cleanPlaceholderColors(colors: Array<string | null>): Array<string | null> {
  return colors.map(c => c === PLACEHOLDER_HEX ? null : c);
}

async function getProfileState(storeId: string) {
  const [storeResult, signatureResult, profilesResult, assetsResult] = await Promise.all([
    supabase.from("stores").select("*").eq("id", storeId).single(),
    supabase
      .from("store_visual_signatures")
      .select("id")
      .eq("store_id", storeId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("store_brand_profiles")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("store_brand_assets")
      .select("id")
      .eq("store_id", storeId)
      .eq("variant_type", "original")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (storeResult.error || !storeResult.data) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }
  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }
  if (signatureResult.error) {
    return NextResponse.json({ error: signatureResult.error.message }, { status: 500 });
  }

  const store = storeResult.data as Record<string, unknown>;
  const records = (profilesResult.data ?? []) as Array<{
    id: string;
    source: string;
    status: string;
    created_at: string;
    updated_at?: string | null;
    visual_signature_id?: string | null;
    active_logo_asset_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;

  const identityState = String(store.identity_state ?? "text_only");
  const activeOrigin =
    identityState === "logo"
      ? "logo_analysis"
      : identityState === "visual_signature"
        ? "without_logo"
        : "text_only";

  const latestLogo = records.find(
    (record) => record.source === "logo_analysis" && record.status === "synced",
  );
  const activeLogoAssetId = (assetsResult.data?.[0]?.id as string | undefined) ?? null;
  const activeAssetId =
    activeOrigin === "without_logo"
      ? (signatureResult.data?.id ?? null)
      : activeOrigin === "logo_analysis"
        ? activeLogoAssetId
        : null;

  const fallbackLogoAssetId =
    latestLogo?.active_logo_asset_id ?? null;

  const snapshot: BrandProfileSnapshotFields = {
    segment: String(store.segment ?? ""),
    subsegment: (store.subsegment as string | null | undefined) ?? null,
    tone_of_voice: (store.tone_of_voice as string | null | undefined) ?? null,
    name: String(store.name ?? ""),
    positioning: (store.positioning as string | null | undefined) ?? null,
    short_description: (store.short_description as string | null | undefined) ?? null,
    slogan: (store.slogan as string | null | undefined) ?? null,
  };

  const derived = deriveBrandProfileState({
    records,
    activeOrigin,
    activeAssetId,
    currentSnapshot: snapshot,
    fallbackLogoAssetId,
  });

  return NextResponse.json(
    {
      state: derived.state,
      currentKind: derived.currentKind,
      currentProfileId: derived.current?.id ?? null,
      current: derived.current,
      previousProfileIds: derived.previous.map((record) => record.id),
      previous: derived.previous,
      lastFailure: derived.lastFailure,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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
});

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  requireSameOrigin(request);
  const { id } = await params;
  await requireAuthorizedStore(id);
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.endsWith('/archive')) {
    return handleArchive(request, id);
  }

  return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
});

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
