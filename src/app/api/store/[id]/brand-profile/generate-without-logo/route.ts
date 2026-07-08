import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandProfilerWithoutLogoService } from '@/lib/visual-signature/brand-profiler';
import type { VisualSignatureArtDirectorOutput } from '@/lib/visual-signature/types';
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

  let body: {
    visualSignatureId: string;
    artDirectorOutput: VisualSignatureArtDirectorOutput;
    assetUrl: string;
    referenceCardUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.visualSignatureId || !body.assetUrl || !body.artDirectorOutput) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: visualSignatureId, assetUrl, artDirectorOutput' },
      { status: 400 }
    );
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select()
    .eq('id', id)
    .single();

  if (storeError || !store) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  const profiler = new BrandProfilerWithoutLogoService();

  try {
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
      artDirectorOutput: body.artDirectorOutput,
      visualSignatureId: body.visualSignatureId,
      assetUrl: body.assetUrl,
      referenceCardUrl: body.referenceCardUrl ?? null,
    });

    return NextResponse.json({
      success: true,
      brandProfile: {
        id: result.profile.id,
        status: result.profile.status,
        source: 'without_logo',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';

    return NextResponse.json({
      success: false,
      error: message,
      brandProfile: null,
    }, { status: 500 });
  }
});
