import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { StoreIdentityArtDirectorService } from '@/lib/visual-signature/identity-art-director';
import { insertGenerationEvent } from '@/lib/visual-signature/generation-events';
import type { VisualSignatureRecord } from '@/lib/visual-signature/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROUTE_TIMEOUT_MS = Number(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS) || 300000;

const generationLocks = new Map<string, boolean>();

let requestCounter = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = ++requestCounter;
  const { id } = await params;
  console.log(`[generate-without-logo][req-${reqId}] 1/11 request recebido`, { storeId: id });

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

  console.log(`[generate-without-logo][req-${reqId}] 2/11 carregando store...`);
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

  // Requirement 1: Limit to 3 generations total per store
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
    }, { status: 403 }); // Adding status 403 as it is an exhaustion error
  }

  const newAttempt = totalCount + 1;
  console.log(`[generate-without-logo][req-${reqId}] next attempt number (quota based):`, newAttempt);

  console.log(`[generate-without-logo][req-${reqId}] 3/11 incrementando attempts no DB...`);
  const { error: attemptError } = await supabase
    .from('stores')
    .update({ visual_signature_attempts: newAttempt, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (attemptError) {
    console.log(`[generate-without-logo][req-${reqId}] falha ao incrementar attempts`, attemptError.message);
    generationLocks.delete(id);
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }
  console.log(`[generate-without-logo][req-${reqId}] attempts incrementado OK (session update)`);

  console.log(`[generate-without-logo][req-${reqId}] 4/11 instanciando StoreIdentityArtDirectorService...`);
  const service = new StoreIdentityArtDirectorService();
  console.log(`[generate-without-logo][req-${reqId}] serviço instanciado`);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[generate-without-logo][req-${reqId}] ⏰ SERVER TIMEOUT ${ROUTE_TIMEOUT_MS}ms atingido, abortando...`);
    abortController.abort();
  }, ROUTE_TIMEOUT_MS);

  const combinedSignal = request.signal;
  request.signal.addEventListener('abort', () => {
    console.log(`[generate-without-logo][req-${reqId}] request abortado pelo cliente`);
    abortController.abort();
    clearTimeout(timeoutId);
  }, { once: true });

  try {
    console.log(`[generate-without-logo][req-${reqId}] 5/11 chamando service.generate()...`);
    const result = await service.generate(
      {
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
          ? { ...body.rejectionContext, attempt: totalCount } // sync attempt to totalCount for consistency
          : null,
      },
      abortController.signal
    );
    console.log(`[generate-without-logo][req-${reqId}] 6/11 service.generate() retornou`, { assetUrl: result.assetUrl, signatureId: result.signature.id });
    clearTimeout(timeoutId);

    console.log(`[generate-without-logo][req-${reqId}] 7/11 inserindo generation_event (success)...`);
    await insertGenerationEvent({
      store_id: id,
      generation_type: 'visual_signature',
      provider: 'openai',
      attempt_number: newAttempt,
      status: 'success',
      asset_generated: true,
      asset_id: result.signature.id,
      has_logo: false,
      has_generated_signature: true,
      has_brand_profile: false,
      input_data_hash: `${store.name}-${store.segment}-${newAttempt}`,
    });
    console.log(`[generate-without-logo][req-${reqId}] 8/11 generation_event inserido`);

    console.log(`[generate-without-logo][req-${reqId}] 9/11 enviando response success`);
    generationLocks.delete(id);
    console.log(`[generate-without-logo][req-${reqId}] lock liberado`);
    return NextResponse.json({
      success: true,
      assetUrl: result.assetUrl,
      signatureId: result.signature.id,
      artDirectorOutput: result.artDirectorOutput,
      attempt: newAttempt,
      totalGenerated: newAttempt,
      maxAttempts: 3,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    generationLocks.delete(id);
    const message = err instanceof Error ? err.message : 'Erro interno';
    const isStorageError = message.includes('Failed to upload to Storage');
    const timeoutSource = (err instanceof DOMException && err.name === 'AbortError') ? 'server' : 'unexpected';
    
    console.log(`[generate-without-logo][req-${reqId}] 10/11 catch — erro no fluxo timeout_source=${timeoutSource}`, { message, stack: err instanceof Error ? err.stack : '' });

    // Only set failed if it's not a storage error (to allow retries without burning quota if possible, though currently quota is based on count)
    // Actually, if it failed here, we DON'T increment attempts in a way that blocks the user if it was a technical error
    
    if (!isStorageError) {
      console.log(`[generate-without-logo][req-${reqId}] setando logo_status=failed...`);
      await supabase
        .from('stores')
        .update({ logo_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    console.log(`[generate-without-logo][req-${reqId}] inserindo generation_event (failed)...`);
    await insertGenerationEvent({
      store_id: id,
      generation_type: 'visual_signature',
      provider: 'openai',
      attempt_number: newAttempt,
      status: 'failed',
      error_type: isStorageError ? 'storage_upload_failed' : 'generation_error',
      asset_generated: false,
      has_logo: false,
      has_generated_signature: false,
      has_brand_profile: false,
    });

    console.log(`[generate-without-logo][req-${reqId}] 11/11 enviando response error`, { message });
    
    return NextResponse.json({
      success: false,
      error_type: isStorageError ? 'storage_upload_failed' : 'generation_error',
      error: isStorageError 
        ? 'Não conseguimos salvar a assinatura visual gerada. Pode ter ocorrido uma instabilidade temporária no armazenamento. Tente novamente.'
        : 'Falha ao gerar assinatura visual. Tente novamente.',
      message: message,
      attempt: newAttempt,
      shouldConsumeAttempt: false,
      maxAttempts: 3,
    }, { status: isStorageError ? 503 : 500 });
  }
}
