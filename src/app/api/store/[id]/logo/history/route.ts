import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import type { BrandAssetRecord, BrandProfileRecord, LogoHistoryItem, DriftStatus } from '@/lib/brand-assets/types';
import { normalizeSnapshotValue } from '@/lib/drift';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

function computeDriftStatusForHistory(
  inputSnapshot: Record<string, string | null> | null | undefined,
  currentStore: { segment: string | null; subsegment: string | null; tone_of_voice: string | null; name: string | null; brand_color: string | null; accent_color: string | null },
): DriftStatus {
  if (!inputSnapshot) return 'drift';

  const fields = ['segment', 'subsegment', 'tone_of_voice', 'name', 'brand_color', 'accent_color'] as const;
  const hasDrift = fields.some(f =>
    normalizeSnapshotValue(currentStore[f]) !== normalizeSnapshotValue(inputSnapshot[f] ?? null)
  );

  return hasDrift ? 'drift' : 'none';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
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

  const { data: assets, error: assetsError } = await supabase
    .from('store_brand_assets')
    .select()
    .eq('store_id', storeId)
    .eq('variant_type', 'original')
    .eq('status', 'archived')
    .order('created_at', { ascending: false });

  if (assetsError) {
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }

  const logos: LogoHistoryItem[] = [];

  for (const asset of assets as BrandAssetRecord[]) {
    const { data: profile } = await supabase
      .from('store_brand_profiles')
      .select()
      .eq('active_logo_asset_id', asset.id)
      .order('created_at', { ascending: true })
      .maybeSingle();

    const profileRecord = profile as BrandProfileRecord | null;
    const inputSnapshot = profileRecord?.metadata?.input_snapshot as Record<string, string | null> | null ?? null;

    let driftStatus: DriftStatus = null;
    if (profileRecord) {
      const accentColor = profileRecord.brand_colors_chosen?.[1]
        ?? profileRecord.safe_color_tokens?.accent
        ?? profileRecord.inferred_accent_color
        ?? null;

      driftStatus = computeDriftStatusForHistory(inputSnapshot, {
        segment: store.segment,
        subsegment: store.subsegment,
        tone_of_voice: store.tone_of_voice,
        name: store.name,
        brand_color: store.brand_color,
        accent_color: accentColor,
      });
    }

    const visualStyle = profileRecord?.visual_style ?? null;
    const safeColorTokens = profileRecord?.safe_color_tokens ?? null;

    logos.push({
      version: asset.version,
      asset,
      profile: profileRecord,
      created_at: asset.created_at,
      visual_style: visualStyle,
      safe_color_tokens: safeColorTokens,
      drift_status: driftStatus,
      input_snapshot: inputSnapshot,
    });
  }

  return NextResponse.json({ logos }, { status: 200 });
}
