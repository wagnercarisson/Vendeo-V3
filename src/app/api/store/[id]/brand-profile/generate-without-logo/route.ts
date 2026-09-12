import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandProfilerWithoutLogoService } from '@/lib/visual-signature/brand-profiler';
import type { VisualSignatureArtDirectorOutput } from '@/lib/visual-signature/types';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';
import { apiHandler } from '@/lib/auth/api-handler';
import { AiCostTracker } from '@/lib/ai-cost';
import { createDefaultTelemetryContext } from '@/lib/ai';
import { EconomicParameterService } from '@/lib/economic/economic-parameter-service';

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

  // F38.2.1 (D3): snapshot econômico resolvido UMA vez no início do run
  // (padrão telemetria) e propagado a TODOS os eventos do run (call-level +
  // delivery). APENAS valores — o tracker define captured_at_generation na
  // gravação. Best-effort: falha → null → fallback legacy; nunca bloqueia.
  let economicSnapshot: { usdBrlRateAtGeneration: number | null; creditValueBrlAtGeneration: number | null } = {
    usdBrlRateAtGeneration: null,
    creditValueBrlAtGeneration: null,
  };
  try {
    const service = new EconomicParameterService();
    const [usd, credit] = await Promise.all([
      service.getParameter("usd_brl_rate"),
      service.getParameter("credit_value_brl"),
    ]);
    economicSnapshot = {
      usdBrlRateAtGeneration: usd.value,
      creditValueBrlAtGeneration: credit.value,
    };
  } catch (err) {
    console.error(
      "[brand-profile/generate-without-logo] snapshot econômico indisponível (best-effort):",
      err instanceof Error ? err.message : String(err)
    );
  }

  // F46-04 (D9): telemetria pelo sink único. O profiler invoca
  // `brand_profile_vision`/`brand_profile_text` via gateway; o sink resolve custo
  // (CAPABILITY_GENERATION_TYPE) e grava call-level — a rota NÃO grava manualmente.
  const telemetry = createDefaultTelemetryContext({
    operationRunId: run.operationRunId,
    operationRunType: "brand_profile",
    traceId: run.traceId,
    storeId: id,
    visualSignatureId: body.visualSignatureId ?? null,
    usdBrlRateAtGeneration: economicSnapshot.usdBrlRateAtGeneration,
    creditValueBrlAtGeneration: economicSnapshot.creditValueBrlAtGeneration,
  });

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
    }, telemetry);

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
      // F38.2.1 (D3): snapshot do run no delivery (APENAS valores)
      usdBrlRateAtGeneration: economicSnapshot.usdBrlRateAtGeneration,
      creditValueBrlAtGeneration: economicSnapshot.creditValueBrlAtGeneration,
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
