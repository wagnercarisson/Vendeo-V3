import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[dismiss-critical-drift] POST request recebido`, { storeId: id });

  if (!UUID_REGEX.test(id)) {
    console.log(`[dismiss-critical-drift] UUID inválido`);
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  // Verify store exists
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('name, segment, slogan, city, state')
    .eq('id', id)
    .single();

  if (storeError || !store) {
    console.log(`[dismiss-critical-drift] store não encontrada`, { error: storeError?.message });
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  // Verify store has an active visual signature
  const { data: activeVS, error: activeVSError } = await supabase
    .from('store_visual_signatures')
    .select('id, metadata')
    .eq('store_id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (activeVSError || !activeVS) {
    console.log(`[dismiss-critical-drift] nenhuma VS ativa encontrada`);
    return NextResponse.json({ error: 'Nenhuma assinatura visual ativa encontrada' }, { status: 404 });
  }

  // Merge snapshot into existing metadata, preserving all existing fields
  const existingMetadata = (activeVS.metadata ?? {}) as Record<string, unknown>;

  const updatedMetadata = {
    ...existingMetadata,
    visual_signature_drift_dismissed_snapshot: {
      name: store.name,
      segment: store.segment,
      slogan: store.slogan ?? null,
      city: store.city ?? null,
      state: store.state ?? null,
    },
  };

  const { error: updateError } = await supabase
    .from('store_visual_signatures')
    .update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeVS.id);

  if (updateError) {
    console.error(`[dismiss-critical-drift] falha ao persistir snapshot`, updateError.message);
    return NextResponse.json({ error: 'Falha ao persistir snapshot de dismiss' }, { status: 500 });
  }

  console.log(`[dismiss-critical-drift] snapshot persistido com sucesso para VS ${activeVS.id}`);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[dismiss-critical-drift] DELETE request recebido`, { storeId: id });

  if (!UUID_REGEX.test(id)) {
    console.log(`[dismiss-critical-drift] UUID inválido`);
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  const { data: activeVS, error: activeVSError } = await supabase
    .from('store_visual_signatures')
    .select('id, metadata')
    .eq('store_id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (activeVSError || !activeVS) {
    console.log(`[dismiss-critical-drift] nenhuma VS ativa encontrada`);
    return NextResponse.json({ error: 'Nenhuma assinatura visual ativa encontrada' }, { status: 404 });
  }

  const existingMetadata = (activeVS.metadata ?? {}) as Record<string, unknown>;
  const { visual_signature_drift_dismissed_snapshot: _, ...rest } = existingMetadata;

  const { error: updateError } = await supabase
    .from('store_visual_signatures')
    .update({
      metadata: rest,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeVS.id);

  if (updateError) {
    console.error(`[dismiss-critical-drift] falha ao limpar snapshot de dismiss`, updateError.message);
    return NextResponse.json({ error: 'Falha ao limpar snapshot de dismiss' }, { status: 500 });
  }

  console.log(`[dismiss-critical-drift] snapshot removido com sucesso da VS ${activeVS.id}`);
  return new NextResponse(null, { status: 204 });
}
