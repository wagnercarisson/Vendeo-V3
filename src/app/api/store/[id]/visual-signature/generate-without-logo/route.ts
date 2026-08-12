import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { StoreIdentityArtDirectorService } from '@/lib/visual-signature/identity-art-director';
import { AiImageGenerator } from '@/lib/visual-signature/ai-image-generator';
import { persistSignature, getActiveVisualSignature } from '@/lib/visual-signature/persistence';
import { insertGenerationEvent } from '@/lib/visual-signature/generation-events';
import { revalidateCriticalDrift } from '@/lib/visual-signature/drift-revalidator';
import type { VisualSignatureArtDirectorOutput, VisualSignatureMetadataInputSnapshot } from '@/lib/visual-signature/types';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAuthorizedStore } from '@/lib/auth/store-ownership';
import { requireSameOrigin } from '@/lib/auth/csrf';
import { apiHandler } from '@/lib/auth/api-handler';
import { getLaunchConfig } from '@/lib/launch-config/config';
import { CreditService } from '@/lib/credit/credit-service';
import { OperationCostService, OperationCostUnavailableError } from '@/lib/credit/operation-cost-service';
import type { OperationCostResolution } from '@/lib/credit/types';
import { requireLegalClearance } from '@/lib/legal/clearance';
import { AiCostTracker, resolveAiCost } from '@/lib/ai-cost';
import type { AiCallInfo, CostResolution } from '@/lib/ai-cost/types';
import type { GenerationEventType } from '@/lib/visual-signature/types';
import { EconomicParameterService } from '@/lib/economic/economic-parameter-service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROUTE_TIMEOUT_MS = Number(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS) || 300000;

const generationLocks = new Map<string, boolean>();

function computePromptVersion(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  } catch {
    return 'unknown';
  }
}

const PROMPT_VERSION_ART_DIRECTOR = computePromptVersion(
  path.join(process.cwd(), 'prompts', 'store-identity-art-director.md')
);
const PROMPT_VERSION_SIMPLIFIED = crypto
  .createHash('sha256')
  .update('simplified-visual-signature-template-v1')
  .digest('hex')
  .slice(0, 12);

let requestCounter = 0;

/**
 * F38.2.1 (D3): resolve o snapshot econômico UMA vez por run (best-effort) —
 * valores vigentes naquele momento. Sucesso → { usdBrlRateAtGeneration,
 * creditValueBrlAtGeneration } (APENAS valores; o tracker define a origem
 * captured_at_generation na gravação). Falha → log + null — NUNCA bloqueia.
 */
async function resolveEconomicSnapshot(): Promise<{
  usdBrlRateAtGeneration: number | null;
  creditValueBrlAtGeneration: number | null;
}> {
  try {
    const service = new EconomicParameterService();
    const [usd, credit] = await Promise.all([
      service.getParameter("usd_brl_rate"),
      service.getParameter("credit_value_brl"),
    ]);
    return {
      usdBrlRateAtGeneration: usd.value,
      creditValueBrlAtGeneration: credit.value,
    };
  } catch (err) {
    console.error(
      "[generate-without-logo] snapshot econômico indisponível (best-effort):",
      err instanceof Error ? err.message : String(err)
    );
    return { usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null };
  }
}

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  // 0. generationPaused guard — ABSOLUTE FIRST, before any other operation
  const launchConfig = getLaunchConfig();
  if (launchConfig.generationPaused) {
    return NextResponse.json({ error: 'Geração temporariamente indisponível.' }, { status: 503 });
  }

  requireSameOrigin(request);
  const { id } = await params;
  const authUser = await requireAuthorizedStore(id);
  const reqId = ++requestCounter;
  console.log(`[generate-without-logo][req-${reqId}] request recebido`, { storeId: id });

  // ── Legal clearance check ────────────────────────────────────────
  const clearance = await requireLegalClearance({
    storeId: id,
    userId: authUser.userId,
    capability: "content_generation",
  });

  if (!clearance.ok) {
    return NextResponse.json(
      {
        error: "Ação bloqueada por pendência legal.",
        reason: clearance.reason,
        requiredDocuments: clearance.requiredDocuments,
        acceptUrl: "/legal/reaccept",
      },
      { status: 403 },
    );
  }

  if (!UUID_REGEX.test(id)) {
    console.log(`[generate-without-logo][req-${reqId}] UUID inválido`);
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  if (generationLocks.get(id)) {
    console.log(`[generate-without-logo][req-${reqId}] BLOQUEADO — geração já em andamento para esta loja`);
    return NextResponse.json({ error: 'Geração já em andamento para esta loja. Aguarde.' }, { status: 429 });
  }
  generationLocks.set(id, true);
  const lockTimeoutId = setTimeout(() => {
    console.log(`[generate-without-logo][req-${reqId}] lock timeout — liberando lock`);
    generationLocks.delete(id);
  }, ROUTE_TIMEOUT_MS + 5000);
  console.log(`[generate-without-logo][req-${reqId}] lock adquirido`);

  let creditTxId: string | null = null;
  let operationId: string | undefined;
  let cost: OperationCostResolution | undefined;

  try {
    let body: { rejectionContext?: { reason: string; attempt: number }; mode?: 'standard' | 'substitution' };
    try {
      body = await request.json();
      console.log(`[generate-without-logo][req-${reqId}] body parsed`, { rejectionContext: body.rejectionContext, mode: body.mode });
    } catch {
      body = {};
      console.log(`[generate-without-logo][req-${reqId}] body vazio (JSON parse falhou)`);
    }

    const mode = body.mode ?? 'standard';
    console.log(`[generate-without-logo][req-${reqId}] mode: ${mode}`);

    console.log(`[generate-without-logo][req-${reqId}] carregando store...`);
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select()
      .eq('id', id)
      .single();

    if (storeError || !store) {
      console.log(`[generate-without-logo][req-${reqId}] store não encontrada`, { error: storeError?.message });
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }
    console.log(`[generate-without-logo][req-${reqId}] store carregada`, { name: store.name, segment: store.segment, identity_state: store.identity_state });

    // ----- Substitution mode guards -----
    if (mode === 'substitution') {
      if (store.identity_state !== 'visual_signature') {
        console.log(`[generate-without-logo][req-${reqId}] SUBSTITUIÇÃO BLOQUEADA — identity_state inválido: ${store.identity_state}`);
        return NextResponse.json({
          success: false,
          code: 'INVALID_IDENTITY_STATE',
          error: 'Estado de identidade deve ser visual_signature',
        }, { status: 400 });
      }

      const activeVS = await getActiveVisualSignature(id).catch(() => null);
      if (!activeVS) {
        console.log(`[generate-without-logo][req-${reqId}] SUBSTITUIÇÃO BLOQUEADA — nenhuma VS ativa encontrada`);
        return NextResponse.json({
          success: false,
          code: 'NO_ACTIVE_VS',
          error: 'Nenhuma assinatura visual ativa encontrada',
        }, { status: 404 });
      }

      const activeVSMetadata = (activeVS.metadata ?? {}) as Record<string, unknown>;
      const activeVSArtDir = activeVSMetadata.artDirectorOutput as { content_used?: { slogan?: boolean; city?: boolean; state?: boolean } } | null ?? null;
      const vsContentUsed = activeVSArtDir?.content_used ?? null;
      const vsInputSnapshot = activeVSMetadata.input_snapshot as Record<string, unknown> | null ?? null;

      const revalidation = revalidateCriticalDrift({
        vsSnapshot: vsInputSnapshot as any,
        contentUsed: vsContentUsed ?? undefined,
        store: { name: store.name, segment: store.segment, slogan: store.slogan ?? null, city: store.city ?? null, state: store.state ?? null },
      });

      if (!revalidation.hasDrift) {
        console.log(`[generate-without-logo][req-${reqId}] SUBSTITUIÇÃO BLOQUEADA — drift crítico não confirmado`, { reason: revalidation.reason });
        return NextResponse.json({
          success: false,
          code: 'DRIFT_NOT_CONFIRMED',
          error: 'Drift crítico não confirmado. Recalcule o diagnóstico.',
        }, { status: 400 });
      }

      console.log(`[generate-without-logo][req-${reqId}] SUBSTITUIÇÃO — guardas OK`);
    }

    // ----- Resolve operation cost (D12) — SEMPRE, mesmo sem cobrança -----
    try {
      cost = await new OperationCostService().getCost("visual_signature_generation");
    } catch (err) {
      if (err instanceof OperationCostUnavailableError) {
        console.error(`[generate-without-logo][req-${reqId}] operation_cost_unavailable`, { storeId: id });
        return NextResponse.json(
          { error: "operation_cost_unavailable", operationKey: "visual_signature_generation", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." },
          { status: 503 }
        );
      }
      throw err;
    }
    if (!cost.enabled) {
      console.log(`[generate-without-logo][req-${reqId}] operation_disabled`, { storeId: id });
      return NextResponse.json(
        { error: "operation_disabled", operationKey: cost.operationKey },
        { status: 503 }
      );
    }

    // ----- v15Enabled check — skip ALL credit logic if false -----
    const creditsEnabled = launchConfig.v15Enabled && launchConfig.creditsChargingEnabled;

    // ----- Balance check (only if creditsChargingEnabled) -----
    if (creditsEnabled) {
      const creditService = new CreditService();
      const balance = await creditService.getBalance(id);
      if (balance < cost.costCredits) {
        console.log(`[generate-without-logo][req-${reqId}] saldo insuficiente: ${balance}`);
        return NextResponse.json({
          error: 'Créditos insuficientes',
          code: 'insufficient_credits',
        }, { status: 402 });
      }

      // ----- Reserve credit BEFORE IA call -----
      operationId = crypto.randomUUID();
      creditTxId = await creditService.reserveCredit(id, cost.costCredits, {
        campaignId: null,
        idempotencyKey: `vs_reserve_${id}_${operationId}`,
        metadata: {
          feature: "visual_signature",
          mode,
          operationId,
          operation_key: cost.operationKey,
          operation_cost_credits: cost.costCredits,
          operation_cost_source: cost.source,
        },
      });
      console.log(`[generate-without-logo][req-${reqId}] crédito reservado: ${creditTxId}`);
    }

  const startTime = performance.now();
  const abortController = new AbortController();

  // ── F38.1 (D1/D7): run context da entrega VS ─────────────────────
  // Cada request de geração = UM run (uma geração debitável). Falha técnica
  // seguida de nova tentativa = NOVO run (novo operationRunId — D1, testado).
  // operationRunId/traceId são propagados às chamadas filhas via onCall e
  // persistidos no delivery marker (insertGenerationEvent delega ao tracker).
  let run = new AiCostTracker().startRun("visual_signature");

  // F38.2.1 (D3): snapshot econômico do run vigente — resolvido UMA vez após o
  // startRun (padrão telemetria) e propagado às chamadas filhas via
  // flushCallEvents e insertGenerationEvent. O retry (novo run) re-resolve.
  let economicSnapshot = await resolveEconomicSnapshot();

  // Eventos call-level (visual_signature_image / visual_signature_validation)
  // chegam via onCall ANTES de a assinatura existir (persistSignature acontece
  // dentro do fluxo). Ficam pendentes e são gravados quando o
  // visual_signature_id é conhecido (D2 — todos os eventos do run com o id).
  interface PendingCall {
    run: { operationRunId: string; traceId: string };
    generationType: GenerationEventType;
    attemptNumber: number;
    info: AiCallInfo;
  }
  const pendingCalls: PendingCall[] = [];
  let currentAttemptNumber = 0;

  const recordCall = (params: Omit<PendingCall, "run">): void => {
    pendingCalls.push({
      ...params,
      run: { operationRunId: run.operationRunId, traceId: run.traceId },
    });
  };

  const flushCallEvents = async (visualSignatureId: string | null): Promise<void> => {
    const events = pendingCalls.splice(0);
    for (const ev of events) {
      try {
        // Call-level: custo REAL por chamada (resolveAiCost — furo 5 sanado)
        const cost = await resolveAiCost({
          provider: ev.info.provider,
          model: ev.info.model,
          usage: ev.info.usage,
          providerReportedCostUsd: ev.info.providerReportedCostUsd,
        });
        await new AiCostTracker().record({
          operationRunId: ev.run.operationRunId,
          operationRunType: "visual_signature",
          traceId: ev.run.traceId,
          storeId: id,
          visualSignatureId,
          generationType: ev.generationType,
          provider: ev.info.provider,
          model: ev.info.model,
          attemptNumber: ev.attemptNumber,
          durationMs: ev.info.durationMs,
          status: "success",
          tokens: ev.info.usage,
          cost,
          // F38.2.1 (D3): snapshot do run vigente (APENAS valores — o tracker
          // define a origem captured_at_generation na gravação).
          usdBrlRateAtGeneration: economicSnapshot.usdBrlRateAtGeneration,
          creditValueBrlAtGeneration: economicSnapshot.creditValueBrlAtGeneration,
        });
      } catch (err) {
        console.error(
          "[generate-without-logo] recordCall failed (best-effort):",
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  };

  // Handler do callback onCall emitido pelo AiImageGenerator (imagem E validação
  // atravessam o MESMO callback — D11). Distingue pelo model real da chamada:
  // o validator usa IMAGE_VALIDATION_MODEL (default gpt-4o-mini); a imagem usa
  // IMAGE_GENERATION_RESPONSES_MODEL (default gpt-5.5). Best-effort (D7).
  const VALIDATION_MODEL = process.env.IMAGE_VALIDATION_MODEL || "gpt-4o-mini";
  const handleCall = (info: AiCallInfo): void => {
    recordCall({
      generationType:
        info.model === VALIDATION_MODEL ? "visual_signature_validation" : "visual_signature_image",
      attemptNumber: currentAttemptNumber,
      info,
    });
  };

  const timeoutId = setTimeout(() => {
    console.log(`[generate-without-logo][req-${reqId}] ⏰ SERVER TIMEOUT ${ROUTE_TIMEOUT_MS}ms atingido, abortando...`);
    abortController.abort();
  }, ROUTE_TIMEOUT_MS);

  request.signal.addEventListener('abort', () => {
    console.log(`[generate-without-logo][req-${reqId}] request abortado pelo cliente`);
    abortController.abort();
    clearTimeout(timeoutId);
  }, { once: true });

  const totalCount = 0; // quota removida — não contamos mais tentativas

  const serviceInput = {
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
    rejectionContext: body.rejectionContext
      ? { ...body.rejectionContext, attempt: 0 }
      : null,
  };

  // ----- ATTEMPT 1: image_direct (full art director prompt) -----
  console.log(`[generate-without-logo][req-${reqId}] ATTEMPT 1 — image_direct`);
  const service = new StoreIdentityArtDirectorService();

  let result: Awaited<ReturnType<typeof service.generate>> | null = null;
  let attempt1Error: unknown = null;

  try {
    currentAttemptNumber = 0;
    result = await service.generate(serviceInput, abortController.signal, handleCall);
    console.log(`[generate-without-logo][req-${reqId}] ATTEMPT 1 — sucesso`, { assetUrl: result.assetUrl, signatureId: result.signature.id });
  } catch (err) {
    attempt1Error = err;
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    console.log(`[generate-without-logo][req-${reqId}] ATTEMPT 1 — falhou timeout=${isTimeout}`, { message: err instanceof Error ? err.message : 'erro' });
  }

  // ----- ATTEMPT 2: image_retry with simplified prompt (only if non-timeout failure) -----
  if (!result && attempt1Error) {
    const isTimeout = attempt1Error instanceof DOMException && attempt1Error.name === 'AbortError';

    if (!isTimeout) {
      console.log(`[generate-without-logo][req-${reqId}] ATTEMPT 2 — image_retry (prompt simplificado)`);
      try {
        // F38.1 (D1): fecha o run 1 (eventos call-level da tentativa falha — sem
        // assinatura, id null) e abre NOVO run para a nova tentativa
        // (novo operationRunId — 6.4 test 3).
        await flushCallEvents(null);
        run = new AiCostTracker().startRun("visual_signature");
        // F38.2.1 (D3): retry = NOVO run → novo snapshot (valores vigentes agora).
        economicSnapshot = await resolveEconomicSnapshot();
        currentAttemptNumber = 1;
        const aiGenerator = new AiImageGenerator();
        const retryResult = await aiGenerator.generate({
          storeId: id,
          storeName: store.name,
          segment: store.segment,
          brandColor: store.brand_color ?? '',
          tone: store.tone_of_voice ?? 'profissional',
          signal: abortController.signal,
          attempt: 1,
          simplifiedPrompt: true,
          onCall: handleCall, // F38.1 (D11): call-level do retry com custo real
        });

        const artDirectorOutput: VisualSignatureArtDirectorOutput = {
          creative_description: `Assinatura visual para ${store.name} (${store.segment}) — gerada via retry`,
          suggested_colors: store.brand_color ? [store.brand_color] : [],
          visual_direction: 'Personalizada (retry)',
          elements_used: ['nome da loja'],
        };

        if (retryResult.tier === 'typographic') {
          throw new Error('identity_art_director_failed: Typographic fallback não é permitido para geração sem logo');
        }

        const signatureType = retryResult.tier === 'image_direct' ? 'ai_generated' : 'automatic_generated';

        console.log(`[generate-without-logo][req-${reqId}] persistindo signature do retry...`);
        const signature = await persistSignature({
          store_id: id,
          storage_path: retryResult.storagePath,
          asset_url: retryResult.assetUrl,
          type: signatureType,
          status: 'draft',
          generation_mode: body.rejectionContext ? 'automatic' : 'user_choice',
          prompt: retryResult.prompt,
          metadata: {
            ...retryResult.metadata,
            artDirectorOutput,
          },
        });

      const retryInputSnapshot: VisualSignatureMetadataInputSnapshot = {
        name: store.name,
        segment: store.segment,
        subsegment: store.subsegment,
        tone_of_voice: store.tone_of_voice,
        positioning: store.positioning,
        short_description: store.short_description,
        slogan: store.slogan,
        city: store.city,
        state: store.state,
        brand_color: store.brand_color,
        accent_color: null,
      };

      await supabase
        .from('store_visual_signatures')
        .update({
          metadata: {
            ...(signature.metadata ?? {}),
            input_snapshot: retryInputSnapshot,
            artDirectorOutput: {
              visual_direction: 'Personalizada (retry)',
              content_used: {
                store_name: true,
                city: !!store.city,
                state: !!store.state,
                slogan: !!store.slogan,
              },
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', signature.id);

      result = {
        signature,
        artDirectorOutput,
        metadataArtDirectorOutput: {
          visual_direction: 'Personalizada (retry)',
          content_used: {
            store_name: true,
            city: !!store.city,
            state: !!store.state,
            slogan: !!store.slogan,
          },
        },
        assetUrl: retryResult.assetUrl,
      };
      console.log(`[generate-without-logo][req-${reqId}] ATTEMPT 2 — sucesso`, { assetUrl: result.assetUrl, signatureId: result.signature.id });
      } catch (retryErr) {
        console.log(`[generate-without-logo][req-${reqId}] ATTEMPT 2 — falhou`, { message: retryErr instanceof Error ? retryErr.message : 'erro' });
      }
    }
  }

  clearTimeout(timeoutId);

  // ----- SUCCESS PATH: persist credit_tx_id and insert event -----
  if (result) {
    const inputSnapshot: VisualSignatureMetadataInputSnapshot = {
      name: store.name,
      segment: store.segment,
      subsegment: store.subsegment,
      tone_of_voice: store.tone_of_voice,
      positioning: store.positioning,
      short_description: store.short_description,
      slogan: store.slogan,
      city: store.city,
      state: store.state,
      brand_color: store.brand_color,
      accent_color: null,
    };

    const updatedMetadata: Record<string, unknown> = {
      ...(result.signature.metadata ?? {}),
      input_snapshot: inputSnapshot,
      ...(result.metadataArtDirectorOutput ? { artDirectorOutput: result.metadataArtDirectorOutput } : {}),
    };
    if (creditTxId) {
      updatedMetadata.credit_tx_id = creditTxId;
    }
    if (cost) {
      updatedMetadata.operation_key = cost.operationKey;
      updatedMetadata.operation_cost_credits = cost.costCredits;
      updatedMetadata.operation_cost_source = cost.source;
    }

    await supabase
      .from('store_visual_signatures')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', result.signature.id);

    const promptVersion = attempt1Error ? PROMPT_VERSION_SIMPLIFIED : PROMPT_VERSION_ART_DIRECTOR;
    console.log(`[generate-without-logo][req-${reqId}] inserindo generation_event (success)...`, { promptVersion });

    // F38.1 (D7/D11): grava os eventos call-level do run (visual_signature_image +
    // visual_signature_validation) com custo/tokens reais e visual_signature_id (D2).
    await flushCallEvents(result.signature.id);

    await insertGenerationEvent({
      store_id: id,
      generation_type: 'visual_signature',
      provider: 'openai',
      attempt_number: 1,
      status: 'success',
      duration_ms: Math.round(performance.now() - startTime),
      prompt_version: promptVersion,
      asset_generated: true,
      asset_id: result.signature.id,
      has_logo: false,
      has_generated_signature: true,
      has_brand_profile: false,
      input_data_hash: `${store.name}-${store.segment}-1`,
      // F38.1 (D1/D2/D6): run context + visual_signature_id no delivery marker
      // (sem cost/tokens = delivery marker: custo NULL + duration_is_pipeline — D1/D6)
      operation_run_id: run.operationRunId,
      trace_id: run.traceId,
      operation_run_type: 'visual_signature',
      visual_signature_id: result.signature.id,
      // F38.2.1 (D3): snapshot do run vigente no delivery (APENAS valores —
      // o tracker define a origem captured_at_generation na gravação).
      usd_brl_rate_at_generation: economicSnapshot.usdBrlRateAtGeneration,
      credit_value_brl_at_generation: economicSnapshot.creditValueBrlAtGeneration,
    });

    console.log(`[generate-without-logo][req-${reqId}] enviando response success`);
    return NextResponse.json({
      success: true,
      assetUrl: result.assetUrl,
      signatureId: result.signature.id,
      artDirectorOutput: result.artDirectorOutput,
    });
  }

  // ----- FAILURE PATH: refund credit and return error -----
  const finalMessage = attempt1Error instanceof Error ? attempt1Error.message : 'Erro interno';
  const isStorageError = finalMessage.includes('Failed to upload to Storage');
  const isTimeout = attempt1Error instanceof DOMException && attempt1Error.name === 'AbortError';

  console.log(`[generate-without-logo][req-${reqId}] falha total`, { message: finalMessage, timeout: isTimeout });

  // Refund credit on technical failure
  if (creditTxId) {
    try {
      const creditService = new CreditService();
      await creditService.refundCredit(creditTxId, isTimeout ? 'timeout' : (isStorageError ? 'storage_error' : 'generation_error'), { metadata: { feature: "visual_signature", mode, operationId } });
      console.log(`[generate-without-logo][req-${reqId}] crédito estornado: ${creditTxId}`);
    } catch (refundErr) {
      console.error(`[generate-without-logo][req-${reqId}] erro no estorno:`, refundErr);
    }
  }

  if (mode !== 'substitution' && !isStorageError) {
    console.log(`[generate-without-logo][req-${reqId}] setando logo_status=failed...`);
    await supabase
      .from('stores')
      .update({ logo_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  const promptVersion = isTimeout ? PROMPT_VERSION_ART_DIRECTOR : PROMPT_VERSION_SIMPLIFIED;
  console.log(`[generate-without-logo][req-${reqId}] inserindo generation_event (failed)...`, { promptVersion });

  // F38.1 (D7/D11): eventos call-level pendentes do run (ex.: imagem gerada mas
  // validação rejeitou) são gravados mesmo na falha — sem assinatura, sem id.
  await flushCallEvents(null);

  await insertGenerationEvent({
    store_id: id,
    generation_type: 'visual_signature',
    provider: 'openai',
    attempt_number: 1,
    status: isTimeout ? 'timeout' : 'failed',
    duration_ms: Math.round(performance.now() - startTime),
    error_type: isStorageError ? 'storage_upload_failed' : (isTimeout ? 'timeout' : 'generation_error'),
    prompt_version: promptVersion,
    asset_generated: false,
    has_logo: false,
    has_generated_signature: false,
    has_brand_profile: false,
    // F38.1 (D1/D2/D6): run context no delivery failed (sem cost/tokens = delivery)
    operation_run_id: run.operationRunId,
    trace_id: run.traceId,
    operation_run_type: 'visual_signature',
    visual_signature_id: null,
    // F38.2.1 (D3): snapshot do run vigente no delivery failed (APENAS valores)
    usd_brl_rate_at_generation: economicSnapshot.usdBrlRateAtGeneration,
    credit_value_brl_at_generation: economicSnapshot.creditValueBrlAtGeneration,
  });

  console.log(`[generate-without-logo][req-${reqId}] enviando response error`);
  const errorMsg = isStorageError
    ? 'Não conseguimos salvar a assinatura visual gerada. Pode ter ocorrido uma instabilidade temporária no armazenamento. Tente novamente.'
    : isTimeout
      ? 'A geração da assinatura visual excedeu o tempo limite. Pode haver instabilidade temporária no serviço de IA. Tente novamente.'
      : 'Não foi possível criar sua assinatura visual agora. Pode haver instabilidade temporária no serviço de IA, problema de conexão ou servidor. Tente novamente mais tarde.';

  return NextResponse.json({
    success: false,
    error_type: isStorageError ? 'storage_upload_failed' : (isTimeout ? 'timeout' : 'generation_error'),
    error: errorMsg,
    message: finalMessage,
  }, { status: isStorageError ? 503 : 500 });
  } finally {
    generationLocks.delete(id);
    clearTimeout(lockTimeoutId);
    console.log(`[generate-without-logo][req-${reqId}] lock liberado (finally)`);
  }
});
