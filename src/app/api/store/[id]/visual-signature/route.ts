import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('store_visual_signatures')
    .select('id, asset_url, type, status, created_at')
    .eq('store_id', id)
    .in('type', ['ai_generated', 'automatic_generated'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[visual-signature:list] error', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    signatures: (data ?? []).map((s, i) => ({
      id: s.id,
      assetUrl: s.asset_url,
      type: s.type,
      status: s.status,
      attempt: i + 1,
    })),
    total: data?.length ?? 0,
  });
}
