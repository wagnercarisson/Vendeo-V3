import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandProfilerWithoutLogoService } from '@/lib/visual-signature/brand-profiler';
import type { VisualSignatureArtDirectorOutput } from '@/lib/visual-signature/types';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';
import { apiHandler } from '@/lib/auth/api-handler';
import { AiCostTracker, resolveAiCost } from '@/lib/ai-cost';
import type { AiCallInfo } from '@/lib/ai-cost/types';

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
  const startTime = Date.now();

  // ── F38.1 (D1/D7): run context da entrega brand profile ──────────────
  // Cada request de geração/realinhamento = UM run (D1). operationRunId/traceId
  // são propagados às chamadas filhas via onCall do profiler e usados no
  // delivery marker (custo NULL + flag de pipeline no metadata — D1/D6).
  const run = new AiCostTracker().startRun("brand_profile");

  // Call-level (brand_profile_vision / brand_profile_text) chegam via onCall
  // DURANTE generate(). O profiler invoca onCall uma vez por chamada de provider
  // (path 1 = 1 visão; path 2 = visão depois texto — ordem fixa documentada).
  // A rota BUFFERA os AiCallInfo e grava por sequência: 1a entrada -> vision,
  // 2a -> text (determinístico por path — T-38.1-39).
  const pendingCalls: AiCallInfo[] = [];

  const flushCallEvents = async (): Promise<void> => {
    const events = pendingCalls.splice(0);
    for (let i = 0; i < events.length; i += 1) {
      const info = events[i];
      try {
        // Call-level: custo REAL por chamada (resolveAiCost — D9)
        const cost = await resolveAiCost({
          provider: info.provider,
          model: info.model,
          usage: info.usage,
          providerReportedCostUsd: info.providerReportedCostUsd,
        });
        await new AiCostTracker().record({
          operationRunId: run.operationRunId,
          operationRunType: "brand_profile",
          traceId: run.traceId,
          storeId: id,
          visualSignatureId: body.visualSignatureId ?? null,
          generationType: i === 0 ? "brand_profile_vision" : "brand_profile_text",
          provider: info.provider,
          model: info.model,
          attemptNumber: 0,
          durationMs: info.durationMs,
          status: "success",
          tokens: info.usage,
          cost,
        });
      } catch (err) {
        console.error(
          "[brand-profile/generate-without-logo] recordCall failed (best-effort):",
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  };

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
      // F38.1 (D7/D11): telemetria por chamada — nunca bloqueia profiling
      onCall: (info: AiCallInfo) => {
        pendingCalls.push(info);
      },
    });

    // F38.1 (D7/D11): grava os eventos call-level do run com custo real
    await flushCallEvents();

    // Delivery marker: SEM custo/tokens + flag de pipeline (D1/D6 — a view
    // soma apenas call-level; anti-dupla-contagem T-38.1-40)
    await new AiCostTracker().record({
      operationRunId: run.operationRunId,
      operationRunType: "brand_profile",
      traceId: run.traceId,
      storeId: id,
      visualSignatureId: body.visualSignatureId ?? null,
      generationType: "brand_profile_without_logo",
      provider: "openai",
      model: "gpt-4o",
      attemptNumber: 0,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: { duration_is_pipeline: true },
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
