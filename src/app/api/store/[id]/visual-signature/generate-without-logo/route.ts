import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { StoreIdentityArtDirectorService } from '@/lib/visual-signature/identity-art-director';
import { AiImageGenerator } from '@/lib/visual-signature/ai-image-generator';
import { persistSignature } from '@/lib/visual-signature/persistence';
import { insertGenerationEvent } from '@/lib/visual-signature/generation-events';
import type { VisualSignatureArtDirectorOutput } from '@/lib/visual-signature/types';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = ++requestCounter;
  const { id } = await params;
  console.log(`[generate-without-logo][req-${reqId}] 1/12 request recebido`, { storeId: id });

  if (!UUID_REGEX.test(id)) {
    console.log(`[generate-without-logo][req-${reqId}] UUID inválido`);
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  if (generationLocks.get(id)) {
    console.log(`[generate-without-logo][req-${reqId}] BLOQUEADO — geração já em andamento para esta loja`);
    return NextResponse.json({ error: 'Geração já em andamento para esta loja. Aguarde.' }, { status: 429 });
  }
  generationLocks.set(id, true);
  console.log(`[generate-without-logo][req-${reqId}] lock adquirido`);

  let body: { rejectionContext?: { reason: string; attempt: number } };
  try {
    body = await request.json();
    console.log(`[generate-without-logo][req-${reqId}] body parsed`, { rejectionContext: body.rejectionContext });
  } catch {
    body = {};
    console.log(`[generate-without-logo][req-${reqId}] body vazio (JSON parse falhou)`);
  }

  console.log(`[generate-without-logo][req-${reqId}] 2/12 carregando store...`);
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select()
    .eq('id', id)
    .single();

  if (storeError || !store) {
    console.log(`[generate-without-logo][req-${reqId}] store não encontrada`, { error: storeError?.message });
    generationLocks.delete(id);
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }
  console.log(`[generate-without-logo][req-${reqId}] store carregada`, { name: store.name, segment: store.segment });

  const currentAttempts = store.visual_signature_attempts ?? 0;
  console.log(`[generate-without-logo][req-${reqId}] currentAttempts (session)`, currentAttempts);

  const { data: countData, error: countError } = await supabase
    .from('store_visual_signatures')
    .select('id')
    .eq('store_id', id)
    .in('type', ['ai_generated', 'automatic_generated']);

  if (countError) {
    console.log(`[generate-without-logo][req-${reqId}] error counting signatures`, countError.message);
  }

  const totalCount = countData?.length ?? 0;
  console.log(`[generate-without-logo][req-${reqId}] total signatures generated so far:`, totalCount);

  if (totalCount >= 3) {
    console.log(`[generate-without-logo][req-${reqId}] exhausted — already 3 total signatures generated`);
    const { data: archives } = await supabase
      .from('store_visual_signatures')
      .select()
      .eq('store_id', id)
      .in('status', ['active', 'archived', 'draft'])
      .in('type', ['ai_generated', 'automatic_generated'])
      .order('created_at', { ascending: false })
      .limit(3);
    generationLocks.delete(id);
    return NextResponse.json({
      success: false,
      exhausted: true,
      signatures: (archives ?? []).map(s => ({
        id: s.id,
        assetUrl: s.asset_url,
        attempt: 0,
      })),
      totalGenerated: totalCount,
      message: 'Limite de 3 versões atingido. Reavalie as assinaturas geradas.',
    }, { status: 403 });
  }

  const newAttempt = totalCount + 1;
  console.log(`[generate-without-logo][req-${reqId}] next attempt number (quota based):`, newAttempt);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[generate-without-logo][req-${reqId}] ⏰ SERVER TIMEOUT ${ROUTE_TIMEOUT_MS}ms atingido, abortando...`);
    abortController.abort();
  }, ROUTE_TIMEOUT_MS);

  request.signal.addEventListener('abort', () => {
    console.log(`[generate-without-logo][req-${reqId}] request abortado pelo cliente`);
    abortController.abort();
    clearTimeout(timeoutId);
  }, { once: true });

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
      ? { ...body.rejectionContext, attempt: totalCount }
      : null,
  };

  // ----- ATTEMPT 1: image_direct (full art director prompt) -----
  console.log(`[generate-without-logo][req-${reqId}] 3/12 ATTEMPT 1 — image_direct`);
  const service = new StoreIdentityArtDirectorService();

  let result: Awaited<ReturnType<typeof service.generate>> | null = null;
  let attempt1Error: unknown = null;

  try {
    result = await service.generate(serviceInput, abortController.signal);
    console.log(`[generate-without-logo][req-${reqId}] 4/12 ATTEMPT 1 — sucesso`, { assetUrl: result.assetUrl, signatureId: result.signature.id });
  } catch (err) {
    attempt1Error = err;
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    console.log(`[generate-without-logo][req-${reqId}] 4/12 ATTEMPT 1 — falhou timeout=${isTimeout}`, { message: err instanceof Error ? err.message : 'erro' });
  }

  // ----- ATTEMPT 2: image_retry with simplified prompt (only if non-timeout failure) -----
  if (!result && attempt1Error) {
    const isTimeout = attempt1Error instanceof DOMException && attempt1Error.name === 'AbortError';

    if (!isTimeout) {
      console.log(`[generate-without-logo][req-${reqId}] 5/12 ATTEMPT 2 — image_retry (prompt simplificado)`);
      try {
        const aiGenerator = new AiImageGenerator();
        const retryResult = await aiGenerator.generate({
          storeId: id,
          storeName: store.name,
          segment: store.segment,
          brandColor: store.brand_color ?? '',
          tone: store.tone_of_voice ?? 'profissional',
          signal: abortController.signal,
          attempt: newAttempt,
          simplifiedPrompt: true,
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

        console.log(`[generate-without-logo][req-${reqId}] 6/12 persistindo signature do retry...`);
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

        result = {
          signature,
          artDirectorOutput,
          assetUrl: retryResult.assetUrl,
        };
        console.log(`[generate-without-logo][req-${reqId}] 7/12 ATTEMPT 2 — sucesso`, { assetUrl: result.assetUrl, signatureId: result.signature.id });
      } catch (retryErr) {
        console.log(`[generate-without-logo][req-${reqId}] 7/12 ATTEMPT 2 — falhou`, { message: retryErr instanceof Error ? retryErr.message : 'erro' });
      }
    }
  }

  clearTimeout(timeoutId);

  // ----- SUCCESS PATH: increment attempts and insert event -----
  if (result) {
    const attemptNumber = newAttempt;
    console.log(`[generate-without-logo][req-${reqId}] 8/12 incrementando attempts no DB...`);
    await supabase
      .from('stores')
      .update({ visual_signature_attempts: attemptNumber, updated_at: new Date().toISOString() })
      .eq('id', id);

    const promptVersion = attempt1Error ? PROMPT_VERSION_SIMPLIFIED : PROMPT_VERSION_ART_DIRECTOR;
    console.log(`[generate-without-logo][req-${reqId}] 9/12 inserindo generation_event (success)...`, { promptVersion });
    await insertGenerationEvent({
      store_id: id,
      generation_type: 'visual_signature',
      provider: 'openai',
      attempt_number: attemptNumber,
      status: 'success',
      prompt_version: promptVersion,
      asset_generated: true,
      asset_id: result.signature.id,
      has_logo: false,
      has_generated_signature: true,
      has_brand_profile: false,
      input_data_hash: `${store.name}-${store.segment}-${attemptNumber}`,
    });

    console.log(`[generate-without-logo][req-${reqId}] 10/12 enviando response success`);
    generationLocks.delete(id);
    console.log(`[generate-without-logo][req-${reqId}] lock liberado`);
    return NextResponse.json({
      success: true,
      assetUrl: result.assetUrl,
      signatureId: result.signature.id,
      artDirectorOutput: result.artDirectorOutput,
      attempt: attemptNumber,
      totalGenerated: attemptNumber,
      maxAttempts: 3,
    });
  }

  // ----- FAILURE PATH: controlled error, no quota consumed -----
  generationLocks.delete(id);
  const finalMessage = attempt1Error instanceof Error ? attempt1Error.message : 'Erro interno';
  const isStorageError = finalMessage.includes('Failed to upload to Storage');
  const isTimeout = attempt1Error instanceof DOMException && attempt1Error.name === 'AbortError';

  console.log(`[generate-without-logo][req-${reqId}] 11/12 falha total — não consumiu quota`, { message: finalMessage, timeout: isTimeout });

  if (!isStorageError) {
    console.log(`[generate-without-logo][req-${reqId}] setando logo_status=failed...`);
    await supabase
      .from('stores')
      .update({ logo_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  const promptVersion = isTimeout ? PROMPT_VERSION_ART_DIRECTOR : PROMPT_VERSION_SIMPLIFIED;
  console.log(`[generate-without-logo][req-${reqId}] inserindo generation_event (failed)...`, { promptVersion });
  await insertGenerationEvent({
    store_id: id,
    generation_type: 'visual_signature',
    provider: 'openai',
    attempt_number: newAttempt,
    status: isTimeout ? 'timeout' : 'failed',
    error_type: isStorageError ? 'storage_upload_failed' : (isTimeout ? 'timeout' : 'generation_error'),
    prompt_version: promptVersion,
    asset_generated: false,
    has_logo: false,
    has_generated_signature: false,
    has_brand_profile: false,
  });

  console.log(`[generate-without-logo][req-${reqId}] 12/12 enviando response error`);
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
    attempt: newAttempt,
    shouldConsumeAttempt: false,
    maxAttempts: 3,
  }, { status: isStorageError ? 503 : 500 });
}
