import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { validateDrift } from '@/lib/visual-signature/drift-validator';
import { reconcileProfiles } from '@/lib/brand-assets/profile-reconciliation';
import { BrandProfilerWithoutLogoService } from '@/lib/visual-signature/brand-profiler';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';
import type { VisualSignatureMetadataInputSnapshot, VisualSignatureMetadataArtDirectorOutput } from '@/lib/visual-signature/types';
import { assertCanTransition } from '@/lib/identity-transitions';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  requireSameOrigin(request);
  const storeId = (await params).id;
  await requireAuthorizedStore(storeId);

  if (!UUID_REGEX.test(storeId)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  let body: { signature_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }

  if (!body.signature_id || !UUID_REGEX.test(body.signature_id)) {
    return NextResponse.json({ error: 'signature_id inválido ou ausente' }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, segment, city, state, slogan, identity_state')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  if (store.identity_state === 'logo') {
    return NextResponse.json({
      error: 'Remova o logotipo ativo antes de restaurar uma assinatura visual.',
      requires_logo_removal: true,
      current_identity_state: 'logo',
    }, { status: 409 });
  }

  if (store.identity_state === 'visual_signature') {
    return NextResponse.json({
      error: 'Remova a assinatura visual ativa antes de restaurar outra.',
      requires_identity_removal: true,
      current_identity_state: 'visual_signature',
    }, { status: 409 });
  }

  const preCheck = await assertCanTransition(storeId, 'text_only_to_visual_signature');
  if (!preCheck.ok) {
    return NextResponse.json({ error: preCheck.error }, { status: preCheck.status });
  }

  const { data: signature, error: sigError } = await supabase
    .from('store_visual_signatures')
    .select('*')
    .eq('id', body.signature_id)
    .eq('store_id', storeId)
    .in('status', ['active', 'archived'])
    .single();

  if (sigError || !signature) {
    return NextResponse.json({ error: 'Assinatura visual não encontrada para esta loja' }, { status: 404 });
  }

  if (signature.status === 'active') {
    return NextResponse.json({ success: true });
  }

  const metadata = (signature.metadata ?? {}) as Record<string, unknown>;
  const inputSnapshot = metadata.input_snapshot as VisualSignatureMetadataInputSnapshot | null ?? null;
  const artDirectorOutput = metadata.artDirectorOutput as VisualSignatureMetadataArtDirectorOutput | null ?? null;

  const driftResult = validateDrift({
    input_snapshot: inputSnapshot,
    content_used: artDirectorOutput?.content_used ?? null,
    currentStoreData: {
      name: store.name,
      segment: store.segment,
      city: store.city,
      state: store.state,
      slogan: store.slogan,
    },
  });

  if (driftResult.has_drift) {
    return NextResponse.json({
      success: false,
      drift: {
        critical: true,
        fields: driftResult.fields,
        requires_regeneration: driftResult.requires_regeneration,
        reason: driftResult.reason,
      },
    });
  }

  const { data: activeSignatures } = await supabase
    .from('store_visual_signatures')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .limit(1);

  if (activeSignatures && activeSignatures.length > 0) {
    await supabase
      .from('store_visual_signatures')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', activeSignatures[0].id);
  }

  await supabase
    .from('store_visual_signatures')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', body.signature_id);

  await supabase
    .from('stores')
    .update({
      identity_state: 'visual_signature',
      logo_status: IDENTITY_TO_LOGO_STATUS['visual_signature'],
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId);

  const { data: existingProfiles } = await supabase
    .from('store_brand_profiles')
    .select('id')
    .eq('visual_signature_id', body.signature_id)
    .eq('source', 'without_logo')
    .in('status', ['synced', 'outdated'])
    .order('updated_at', { ascending: false })
    .limit(1);

  if (existingProfiles && existingProfiles.length > 0) {
    await reconcileProfiles(storeId, {
      activateProfileIds: [existingProfiles[0].id],
      markIncompatibleAsOutdated: true,
    });
  } else {
    try {
      const profiler = new BrandProfilerWithoutLogoService();
      await profiler.generate({
        storeId,
        storeName: store.name,
        segment: store.segment,
        subsegment: null,
        tone_of_voice: null,
        positioning: null,
        short_description: null,
        slogan: store.slogan,
        city: store.city,
        state: store.state,
        brandColor: null,
        artDirectorOutput: artDirectorOutput ? {
          creative_description: `Assinatura visual para ${store.name} (${store.segment})`,
          suggested_colors: [],
          visual_direction: artDirectorOutput.visual_direction,
          elements_used: [],
        } : {
          creative_description: `Assinatura visual para ${store.name} (${store.segment})`,
          suggested_colors: [],
          visual_direction: 'Personalizada',
          elements_used: ['nome da loja'],
        },
        visualSignatureId: body.signature_id,
        assetUrl: signature.asset_url,
        referenceCardUrl: null,
      });
    } catch (err) {
      console.error('[visual-signature:restore] BrandProfilerWithoutLogoService failed', err);
    }
  }

  return NextResponse.json({
    success: true,
    signature: {
      id: signature.id,
      assetUrl: signature.asset_url,
    },
  });
}
