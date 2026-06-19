import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { validateDrift } from '@/lib/visual-signature/drift-validator';
import { reconcileProfiles } from '@/lib/brand-assets/profile-reconciliation';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, segment, city, state, slogan')
    .eq('id', id)
    .single();

  if (!store) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('store_visual_signatures')
    .select('id, asset_url, type, status, created_at, updated_at, metadata')
    .eq('store_id', id)
    .in('type', ['ai_generated', 'automatic_generated'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[visual-signature:list] error', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const signatures = (data ?? []).map((s, i) => {
    const metadata = (s.metadata ?? {}) as Record<string, unknown>;
    const artDirectorOutput = metadata.artDirectorOutput as Record<string, unknown> | null ?? null;
    const inputSnapshot = metadata.input_snapshot as Record<string, unknown> | null ?? null;

    let restoreEligibility: {
      can_restore: boolean;
      drift_fields: string[];
      requires_regeneration: boolean;
      reason: 'ok' | 'critical_drift' | 'missing_metadata';
    };

    if (inputSnapshot && artDirectorOutput && typeof artDirectorOutput === 'object' && 'content_used' in artDirectorOutput) {
      const driftResult = validateDrift({
        input_snapshot: inputSnapshot as { name: string; segment: string; city: string | null; state: string | null; slogan: string | null },
        content_used: (artDirectorOutput as { content_used: { store_name: boolean; city: boolean; state: boolean; slogan: boolean } }).content_used,
        currentStoreData: {
          name: store.name,
          segment: store.segment,
          city: store.city,
          state: store.state,
          slogan: store.slogan,
        },
      });

      restoreEligibility = {
        can_restore: !driftResult.has_drift,
        drift_fields: driftResult.fields,
        requires_regeneration: driftResult.requires_regeneration,
        reason: driftResult.reason,
      };
    } else if (!inputSnapshot || !artDirectorOutput) {
      restoreEligibility = {
        can_restore: false,
        drift_fields: [],
        requires_regeneration: true,
        reason: 'missing_metadata',
      };
    } else {
      restoreEligibility = {
        can_restore: false,
        drift_fields: [],
        requires_regeneration: true,
        reason: 'missing_metadata',
      };
    }

    return {
      id: s.id,
      assetUrl: s.asset_url,
      type: s.type,
      status: s.status,
      attempt: i + 1,
      created_at: s.created_at,
      approved_at: s.status === 'active' ? s.updated_at : null,
      art_direction: artDirectorOutput && typeof artDirectorOutput === 'object'
        ? {
            visual_direction: (artDirectorOutput as Record<string, unknown>).visual_direction ?? null,
            content_used: (artDirectorOutput as Record<string, unknown>).content_used ?? null,
          }
        : null,
      restore_eligibility: restoreEligibility,
    };
  });

  return NextResponse.json({
    signatures,
    total: data?.length ?? 0,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', id)
    .single();

  if (!store) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  const { data: activeSignatures, error: findError } = await supabase
    .from('store_visual_signatures')
    .select('id')
    .eq('store_id', id)
    .eq('status', 'active')
    .limit(1);

  if (findError) {
    console.error('[visual-signature:delete] error', findError.message);
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!activeSignatures || activeSignatures.length === 0) {
    return NextResponse.json({ error: 'Nenhuma assinatura visual ativa para remover.' }, { status: 404 });
  }

  const activeSignatureId = activeSignatures[0].id;

  await supabase
    .from('store_visual_signatures')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', activeSignatureId);

  await supabase
    .from('stores')
    .update({
      identity_state: 'text_only',
      logo_status: IDENTITY_TO_LOGO_STATUS['text_only'],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  await reconcileProfiles(id, {
    preserveCurrentAsFallback: true,
  });

  return NextResponse.json({
    success: true,
    previous_identity_state: 'visual_signature',
  });
}
