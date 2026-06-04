import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import { AiImageGenerator } from '@/lib/visual-signature/ai-image-generator';
import { persistSignature } from '@/lib/visual-signature/persistence';
import type {
  VisualSignatureWithoutLogoInput,
  VisualSignatureArtDirectorOutput,
  VisualSignatureRecord,
} from '@/lib/visual-signature/types';

export interface VisualSignatureGenerationResult {
  signature: VisualSignatureRecord;
  artDirectorOutput: VisualSignatureArtDirectorOutput;
  assetUrl: string;
}

export class StoreIdentityArtDirectorService {
  private promptLoader: PromptLoader;
  private aiImageGenerator: AiImageGenerator;

  constructor(opts?: { promptLoader?: PromptLoader; aiImageGenerator?: AiImageGenerator }) {
    this.promptLoader = opts?.promptLoader ?? new PromptLoader();
    this.aiImageGenerator = opts?.aiImageGenerator ?? new AiImageGenerator();
  }

  async generate(
    input: VisualSignatureWithoutLogoInput,
    signal?: AbortSignal
  ): Promise<VisualSignatureGenerationResult> {
    const rejectionContextStr = input.rejectionContext
      ? `### URGENTE: FEEDBACK DO LOJISTA (PRIORIDADE MÁXIMA)
A versão anterior (tentativa ${input.rejectionContext.attempt}) foi REJEITADA pelo lojista.
${
  input.rejectionContext.reason
    ? `MOTIVO DA REJEIÇÃO: "${input.rejectionContext.reason}"`
    : 'MOTIVO: O lojista não gostou da direção anterior.'
}

INSTRUÇÕES OBRIGATÓRIAS PARA ESTA NOVA GERAÇÃO:
1. O feedback acima TEM PRIORIDADE ABSOLUTA sobre a "Cor da marca" original ou qualquer instrução anterior.
2. Se o lojista pediu uma cor específica, USE A COR PEDIDA.
3. Se houver feedback específico, atenda ao feedback mas, a menos que o feedback cite explicitamente, mantenha a assinatura visual alinhada aos propósitos da loja (segmento, tom de voz, intenção e contexto).
4. Se o lojista não gostou do estilo, MUDE COMPLETAMENTE a direção criativa. Não faça apenas ajustes finos.
5. Ignore a {{brandColor}} original se ela entrar em conflito com o que o lojista pediu no feedback acima.`
      : '';

    console.log('[identity-art-director] carregando prompt store-identity-art-director...');
    const loadedPrompt = this.promptLoader.load('store-identity-art-director', {
      storeName: input.storeName,
      segment: input.segment,
      subsegment: input.subsegment ?? '',
      tone_of_voice: input.tone_of_voice ?? '',
      positioning: input.positioning ?? '',
      short_description: input.short_description ?? '',
      slogan: input.slogan ?? '',
      city: input.city ?? '',
      state: input.state ?? '',
      brandColor: input.brandColor ?? 'NÃO DEFINIDA (Escolha uma paleta coerente com o segmento)',
      rejectionContext: rejectionContextStr,
    });
    console.log('[identity-art-director] prompt carregado', { promptLength: loadedPrompt.length });

    const tone = input.tone_of_voice ?? 'profissional';
    console.log('[identity-art-director] tone resolvido', { tone });
    console.log('[identity-art-director] chamando AiImageGenerator.generate()...');

    try {
      const result = await this.aiImageGenerator.generate({
        storeId: input.storeId,
        storeName: input.storeName,
        segment: input.segment,
        brandColor: input.brandColor ?? '',
        tone,
        signal,
        attempt: input.rejectionContext ? (input.rejectionContext.attempt + 1) : 1,
        customPrompt: loadedPrompt, // Passing the full identity art director prompt
      });
      console.log('[identity-art-director] AiImageGenerator retornou', { tier: result.tier, assetUrl: result.assetUrl });

      const artDirectorOutput: VisualSignatureArtDirectorOutput = {
        creative_description: `Assinatura visual para ${input.storeName} (${input.segment})`,
        suggested_colors: input.brandColor ? [input.brandColor] : [],
        visual_direction: 'Personalizada',
        elements_used: ['nome da loja'],
      };

      if (result.tier === 'typographic') {
        console.log('[identity-art-director] typographic fallback detectado — lançando erro');
        throw new Error('identity_art_director_failed: Typographic fallback não é permitido para geração sem logo');
      }

      const tier = result.tier ?? 'image_direct';
      const signatureType = tier === 'image_direct' ? 'ai_generated' : 'automatic_generated';

      console.log('[identity-art-director] persistindo signature...');
      const signature = await persistSignature({
        store_id: input.storeId,
        storage_path: result.storagePath,
        asset_url: result.assetUrl,
        type: signatureType,
        status: 'draft',
        generation_mode: input.rejectionContext ? 'automatic' : 'user_choice',
        prompt: result.prompt,
        metadata: {
          ...result.metadata,
          artDirectorOutput,
        },
      });
      console.log('[identity-art-director] signature persistida', { signatureId: signature.id });

      return {
        signature,
        artDirectorOutput,
        assetUrl: result.assetUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log('[identity-art-director] catch — erro', { message, stack: error instanceof Error ? error.stack : '' });
      throw new Error(`identity_art_director_failed: ${message}`);
    }
  }
}
