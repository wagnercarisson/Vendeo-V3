import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { updateGenerationEventDecision } from '@/lib/visual-signature/generation-events';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';
import { apiHandler } from '@/lib/auth/api-handler';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  requireSameOrigin(request);
  const { id } = await params;
  await requireAuthorizedStore(id);

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('visual_signature_attempts')
    .eq('id', id)
    .single();

  if (storeError || !store) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  const currentAttempts = store.visual_signature_attempts ?? 0;

  const { data: draftSignature } = await supabase
    .from('store_visual_signatures')
    .select()
    .eq('store_id', id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftSignature) {
    const metadata = draftSignature.metadata ?? {};
    metadata.rejected = true;
    metadata.reason = body.reason ?? '';
    metadata.attempt_number = currentAttempts;

    await supabase
      .from('store_visual_signatures')
      .update({
        status: 'archived',
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftSignature.id);

    await updateGenerationEventDecision(draftSignature.id, currentAttempts, {
      rejected: true,
    });
  }

  if (currentAttempts >= 3) {
    const { data: archives } = await supabase
      .from('store_visual_signatures')
      .select()
      .eq('store_id', id)
      .in('status', ['archived', 'draft'])
      .order('created_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      success: true,
      exhausted: true,
      signatures: (archives ?? []).map(s => ({
        id: s.id,
        asset_url: s.asset_url,
        attempt: 0,
      })),
      message: 'Limite de 3 versões atingido. Reavalie as assinaturas geradas.',
    });
  }

  return NextResponse.json({
    success: true,
    rejectionContext: {
      reason: body.reason ?? 'O lojista rejeitou a versão anterior sem feedback específico.',
      attempt: currentAttempts,
    },
    exhausted: false,
  });
});
