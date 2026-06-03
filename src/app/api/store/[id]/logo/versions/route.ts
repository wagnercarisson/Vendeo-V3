import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';

function validateUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!validateUUID(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  const { data: versions, error } = await supabase
    .from('store_brand_assets')
    .select('id, version, storage_path, mime_type, status, created_at')
    .eq('store_id', id)
    .eq('variant_type', 'original')
    .order('version', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ versions: versions ?? [] }, { status: 200 });
}
