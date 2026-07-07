import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  requireSameOrigin(request);
  const { id } = await params;
  await requireAuthorizedStore(id);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must contain at least one metadata field' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'Body must contain at least one metadata field' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('store_brand_profiles')
    .select('id, metadata')
    .eq('store_id', id)
    .eq('status', 'synced')
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'No active brand profile found' }, { status: 404 });
  }

  const currentMetadata = (profile.metadata as Record<string, unknown>) ?? {};
  const merged = { ...currentMetadata, ...body };

  const { error: updateError } = await supabase
    .from('store_brand_profiles')
    .update({ metadata: merged, updated_at: new Date().toISOString() })
    .eq('id', profile.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 });
  }

  return NextResponse.json({ success: true, metadata: merged }, { status: 200 });
}
