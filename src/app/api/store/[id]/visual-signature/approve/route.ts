import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandProfilerWithoutLogoService } from '@/lib/visual-signature/brand-profiler';
import { updateGenerationEventDecision } from '@/lib/visual-signature/generation-events';
import { reconcileProfiles } from '@/lib/brand-assets/profile-reconciliation';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let approveRequestCounter = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = ++approveRequestCounter;
  const { id } = await params;
  console.log(`[approve][req-${reqId}] 1/12 request recebido`, { storeId: id });

  if (!UUID_REGEX.test(id)) {
    console.log(`[approve][req-${reqId}] ID da loja inválido`);
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  let body: { signatureId: string };
  try {
    body = await request.json();
    console.log(`[approve][req-${reqId}] body parsed`, { signatureId: body.signatureId });
  } catch {
    console.log(`[approve][req-${reqId}] JSON inválido`);
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.signatureId || !UUID_REGEX.test(body.signatureId)) {
    console.log(`[approve][req-${reqId}] signatureId inválido`);
    return NextResponse.json({ error: 'signatureId inválido' }, { status: 400 });
  }

  console.log(`[approve][req-${reqId}] 2/12 carregando store...`);
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select()
    .eq('id', id)
    .single();

  if (storeError || !store) {
    console.log(`[approve][req-${reqId}] store não encontrada`, { error: storeError?.message });
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }
  console.log(`[approve][req-${reqId}] store carregada:`, { name: store.name });

  console.log(`[approve][req-${reqId}] 3/12 carregando signature...`);
  const { data: signature, error: sigError } = await supabase
    .from('store_visual_signatures')
    .select()
    .eq('id', body.signatureId)
    .eq('store_id', id)
    .single();

  if (sigError || !signature) {
    console.log(`[approve][req-${reqId}] signature não encontrada`, { error: sigError?.message });
    return NextResponse.json({ error: 'Assinatura visual não encontrada' }, { status: 404 });
  }
  console.log(`[approve][req-${reqId}] signature carregada status=${signature.status}`);

  console.log(`[approve][req-${reqId}] 4/12 arquivando assinaturas anteriores...`);
  await supabase
    .from('store_visual_signatures')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('store_id', id)
    .eq('status', 'active');

  console.log(`[approve][req-${reqId}] 5/12 ativando signature atual...`);
  await supabase
    .from('store_visual_signatures')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', body.signatureId);

  const attempts = store.visual_signature_attempts ?? 0;
  console.log(`[approve][req-${reqId}] 6/12 atualizando store (identity_state=visual_signature, logo_status=generated)...`);
  await supabase
    .from('stores')
    .update({
      identity_state: 'visual_signature',
      logo_status: IDENTITY_TO_LOGO_STATUS['visual_signature'],
      visual_signature_attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  console.log(`[approve][req-${reqId}] 7/12 atualizando generation_event decision...`);
  await updateGenerationEventDecision(body.signatureId, attempts, {
    approved: true,
  });

  const artDirectorOutput = signature.metadata?.artDirectorOutput ?? {
    creative_description: `Assinatura visual para ${store.name} (${store.segment})`,
    suggested_colors: store.brand_color ? [store.brand_color] : [],
    visual_direction: 'Personalizada',
    elements_used: ['nome da loja'],
  };

  // 8/12 Check if a brand profile already exists for this visual_signature_id
  // Switching to an existing signature should reuse its cached profile, not call GPT again.
  // Only reuse profiles with complete data (synced or outdated), never failed ones.
  console.log(`[approve][req-${reqId}] 8/12 checking for existing brand profile...`);
  // Use order().limit(1) instead of maybeSingle() because existing
  // duplicate profiles (created before UPSERT fix) cause maybeSingle()
  // to return null even when matches exist, defeating profile reuse.
  const { data: existingProfiles } = await supabase
    .from('store_brand_profiles')
    .select('*')
    .eq('visual_signature_id', body.signatureId)
    .eq('source', 'without_logo')
    .in('status', ['synced', 'outdated'])
    .order('updated_at', { ascending: false })
    .limit(1);
  const existingProfile = existingProfiles?.[0] ?? null;

  if (existingProfile) {
    console.log(`[approve][req-${reqId}] 8b/12 found existing profile (${existingProfile.status}), reactivating`);

    await reconcileProfiles(id, {
      activateProfileIds: [existingProfile.id],
      markIncompatibleAsOutdated: true,
      outdatedSources: ['without_logo'],
    });

    const sanitize = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    const pColor = sanitize(existingProfile.inferred_primary_color, '#666666');
    const aColor = sanitize(existingProfile.inferred_accent_color, '#999999');
    const detected = (existingProfile.logo_colors_detected ?? [])
      .filter((c: string) => /^#[0-9A-Fa-f]{6}$/.test(c))
      .map((c: string) => c.toUpperCase());

    console.log(`[approve][req-${reqId}] 9/12 returning reused profile`);
    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        assetUrl: signature.asset_url,
        status: 'active',
      },
      brandProfile: { id: existingProfile.id, status: 'synced' },
      inferredPrimaryColor: pColor,
      inferredAccentColor: aColor,
      logoColorsDetected: detected.length > 0 ? detected : [pColor],
      logoStatus: 'generated',
    });
  }

  let brandProfileResult: { id: string; status: string } | null = null;
  let inferredPrimaryColor: string | null = null;
  let inferredAccentColor: string | null = null;

  console.log(`[approve][req-${reqId}] 9/12 no existing profile, starting BrandProfilerWithoutLogoService...`);
  try {
    const profiler = new BrandProfilerWithoutLogoService();
    const result = await profiler.generate({
      storeId: id,
      storeName: store.name,
      segment: store.segment,
      subsegment: store.subsegment,
      tone_of_voice: store.tone_of_voice,
      positioning: store.positioning,
      short_description: store.short_description,
      slogan: store.slogan,
      city: store.city,
      state: store.state,
      brandColor: store.brand_color,
      artDirectorOutput,
      visualSignatureId: body.signatureId,
      assetUrl: signature.asset_url,
      referenceCardUrl: null,
    });

    console.log(`[approve][req-${reqId}] 10/12 BrandProfiler OK`, { profileId: result.profile.id });
    brandProfileResult = {
      id: result.profile.id,
      status: result.profile.status,
    };

    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    inferredPrimaryColor = sanitizeHex(result.profile.inferred_primary_color, '#666666');
    inferredAccentColor = sanitizeHex(result.profile.inferred_accent_color, '#999999');
    const logoColorsDetected = (result.profile.logo_colors_detected ?? [])
      .filter((c: string) => /^#[0-9A-Fa-f]{6}$/.test(c))
      .map((c: string) => c.toUpperCase());

    console.log(`[approve][req-${reqId}] 11/12 enviando response`, { inferredPrimaryColor, inferredAccentColor, logoColorsDetected });
    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        assetUrl: signature.asset_url,
        status: 'active',
      },
      brandProfile: brandProfileResult,
      inferredPrimaryColor,
      inferredAccentColor,
      logoColorsDetected,
      logoStatus: 'generated',
    });
  } catch (err) {
    console.error(`[approve][req-${reqId}] 12/12 BrandProfiler FAILED`, err);
    brandProfileResult = { id: '', status: 'failed' };

    const sanitizeHex = (v: string | null | undefined, fb: string): string =>
      v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fb;

    inferredPrimaryColor = sanitizeHex(artDirectorOutput.suggested_colors[0], '#666666');
    inferredAccentColor = sanitizeHex(artDirectorOutput.suggested_colors[1], '#999999');
    const logoColorsDetected = (artDirectorOutput.suggested_colors ?? [])
      .filter((c: string) => /^#[0-9A-Fa-f]{6}$/.test(c))
      .map((c: string) => c.toUpperCase());

    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        assetUrl: signature.asset_url,
        status: 'active',
      },
      brandProfile: brandProfileResult,
      inferredPrimaryColor,
      inferredAccentColor,
      logoColorsDetected,
      logoStatus: 'generated',
    });
  }
}
