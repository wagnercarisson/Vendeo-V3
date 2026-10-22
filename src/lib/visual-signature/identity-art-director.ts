import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import { AiImageGenerator } from '@/lib/visual-signature/ai-image-generator';
import { persistSignature } from '@/lib/visual-signature/persistence';
import type {
  VisualSignatureWithoutLogoInput,
  VisualSignatureArtDirectorOutput,
  VisualSignatureMetadataArtDirectorOutput,
  VisualSignatureRecord,
  ColorUsage,
} from '@/lib/visual-signature/types';
import { normalizeIntendedPalette } from '@/lib/visual-signature/types';
import type { AiCallInfo } from '@/lib/ai-cost/types';
import { DeferredAiTelemetrySink } from '@/lib/ai';
import type { AiInvoker, AiTelemetryContext } from '@/lib/ai';
import type { VisualSignatureModelConfigSnapshot } from '@/lib/ai/visual-signature-model-config-service';

export interface VisualSignatureGenerationResult {
  signature: VisualSignatureRecord;
  artDirectorOutput: VisualSignatureArtDirectorOutput;
  metadataArtDirectorOutput: VisualSignatureMetadataArtDirectorOutput | null;
  assetUrl: string;
}

/** F47.1 (D9) — proveniência explícita do parsing da intenção criativa. */
export type CreativeIntentParseStatus =
  | "parsed_json"
  | "no_json"
  | "invalid_json"
  | "incomplete_json"
  | "not_attempted";

export type CreativeIntentFallbackReason =
  | "missing_json"
  | "invalid_json"
  | "missing_visual_direction"
  | "missing_content_used"
  | "exception"
  | null;

export interface CreativeIntentParsingMetadata {
  creative_intent_parse_status: CreativeIntentParseStatus;
  creative_intent_fallback_applied: boolean;
  creative_intent_fallback_reason: CreativeIntentFallbackReason;
  creative_intent_source: "model" | "fallback";
  creative_intent_schema_version: "vs-intent-v1";
  intended_palette_status: "present_normalized" | "absent" | "invalid";
  content_used_present: boolean;
}

export interface CreativeIntentParseResult {
  output: VisualSignatureMetadataArtDirectorOutput;
  metadata: CreativeIntentParsingMetadata;
}

const CREATIVE_INTENT_SCHEMA_VERSION = "vs-intent-v1" as const;

function fallbackCreativeIntentOutput(): VisualSignatureMetadataArtDirectorOutput {
  return {
    visual_direction: "Personalizada",
    content_used: {
      store_name: true,
      city: false,
      state: false,
      slogan: false,
    },
  };
}

function paletteStatus(
  intendedPalette: unknown,
): { status: "present_normalized" | "absent" | "invalid"; normalized: ReturnType<typeof normalizeIntendedPalette> } {
  if (intendedPalette === undefined || intendedPalette === null) {
    return { status: "absent", normalized: null };
  }
  const normalized = normalizeIntendedPalette(intendedPalette);
  return { status: normalized ? "present_normalized" : "invalid", normalized };
}

function fallbackResult(params: {
  status: CreativeIntentParseStatus;
  reason: CreativeIntentFallbackReason;
  palette: "present_normalized" | "absent" | "invalid";
  contentUsedPresent: boolean;
}): CreativeIntentParseResult {
  return {
    output: fallbackCreativeIntentOutput(),
    metadata: {
      creative_intent_parse_status: params.status,
      creative_intent_fallback_applied: true,
      creative_intent_fallback_reason: params.reason,
      creative_intent_source: "fallback",
      creative_intent_schema_version: CREATIVE_INTENT_SCHEMA_VERSION,
      intended_palette_status: params.palette,
      content_used_present: params.contentUsedPresent,
    },
  };
}

/**
 * F47.1 (D9) — separa PARSING de APLICAÇÃO DE FALLBACK.
 *
 * Nunca apresenta valores de fallback como direção do modelo: a proveniência
 * fica explícita em `creative_intent_source`/`creative_intent_fallback_*`.
 * `visual_direction`, `content_used` e `intended_palette` permanecem no contrato.
 */
export function parseCreativeIntent(aiResponseMessage: string | undefined): CreativeIntentParseResult {
  try {
    const message = aiResponseMessage?.trim() ?? "";
    if (message === "") {
      return fallbackResult({
        status: "no_json",
        reason: "missing_json",
        palette: "absent",
        contentUsedPresent: false,
      });
    }

    const jsonMatch = message.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackResult({
        status: "no_json",
        reason: "missing_json",
        palette: "absent",
        contentUsedPresent: false,
      });
    }

    let parsed: Record<string, unknown>;
    try {
      const raw = JSON.parse(jsonMatch[0]) as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return fallbackResult({
          status: "invalid_json",
          reason: "invalid_json",
          palette: "absent",
          contentUsedPresent: false,
        });
      }
      parsed = raw as Record<string, unknown>;
    } catch {
      return fallbackResult({
        status: "invalid_json",
        reason: "invalid_json",
        palette: "absent",
        contentUsedPresent: false,
      });
    }

    const palette = paletteStatus(parsed.intended_palette);
    const contentUsed = parsed.content_used;
    const contentUsedPresent =
      contentUsed !== undefined && contentUsed !== null && typeof contentUsed === "object";

    const visualDirection =
      typeof parsed.visual_direction === "string" ? parsed.visual_direction : null;
    if (!visualDirection || !contentUsedPresent) {
      return fallbackResult({
        status: "incomplete_json",
        reason: !visualDirection ? "missing_visual_direction" : "missing_content_used",
        palette: palette.status,
        contentUsedPresent,
      });
    }

    const contentUsedRecord = contentUsed as Record<string, unknown>;
    let validatedColorUsage: ColorUsage | undefined;
    const cu = parsed.color_usage;
    if (
      cu &&
      typeof cu === "object" &&
      typeof (cu as Record<string, unknown>).primary === "string" &&
      typeof (cu as Record<string, unknown>).accent === "string" &&
      typeof (cu as Record<string, unknown>).support === "string" &&
      typeof (cu as Record<string, unknown>).background === "string"
    ) {
      validatedColorUsage = cu as ColorUsage;
    }

    return {
      output: {
        visual_direction: visualDirection,
        content_used: {
          store_name: (contentUsedRecord.store_name as boolean | undefined) ?? true,
          city: (contentUsedRecord.city as boolean | undefined) ?? false,
          state: (contentUsedRecord.state as boolean | undefined) ?? false,
          slogan: (contentUsedRecord.slogan as boolean | undefined) ?? false,
        },
        visual_elements: Array.isArray(parsed.visual_elements)
          ? (parsed.visual_elements as string[])
          : undefined,
        intended_palette: palette.normalized ?? undefined,
        color_usage: validatedColorUsage,
      },
      metadata: {
        creative_intent_parse_status: "parsed_json",
        creative_intent_fallback_applied: false,
        creative_intent_fallback_reason: null,
        creative_intent_source: "model",
        creative_intent_schema_version: CREATIVE_INTENT_SCHEMA_VERSION,
        intended_palette_status: palette.status,
        content_used_present: true,
      },
    };
  } catch {
    return fallbackResult({
      status: "invalid_json",
      reason: "exception",
      palette: "absent",
      contentUsedPresent: false,
    });
  }
}

export class StoreIdentityArtDirectorService {
  private promptLoader: PromptLoader;
  private aiImageGenerator: AiImageGenerator;
  private readonly visualSignatureConfig?: VisualSignatureModelConfigSnapshot;

  constructor(opts?: {
    promptLoader?: PromptLoader;
    aiImageGenerator?: AiImageGenerator;
    /** F47.1 (D4): gateway congelado da operação (validação local) ou default. */
    invoker?: AiInvoker;
    /** F47.1 (D4): snapshot congelado da configuração dedicada. */
    visualSignatureConfig?: VisualSignatureModelConfigSnapshot;
  }) {
    this.promptLoader = opts?.promptLoader ?? new PromptLoader();
    this.aiImageGenerator =
      opts?.aiImageGenerator ?? new AiImageGenerator({ invoker: opts?.invoker });
    this.visualSignatureConfig = opts?.visualSignatureConfig;
  }

  async generate(
    input: VisualSignatureWithoutLogoInput,
    signal?: AbortSignal,
    /** F38.1 (D7/D11): repassa o callback onCall do caller ao AiImageGenerator —
     * os eventos call-level (visual_signature_image/validation) atravessam o service. */
    onCall?: (info: AiCallInfo) => void | Promise<void>,
    /** F46-04 (D9): contexto de telemetria do caller — encaminhado ao AiImageGenerator
     * (e daí ao validator) para que o sink injetado alcance `invoke`. */
    telemetry?: AiTelemetryContext
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
        onCall, // F38.1 (D11): propaga o onCall do caller (imagem + validação)
        telemetry, // F46-04 (D9): encaminha o contexto de telemetria (sink injetado)
        visualSignatureConfig: this.visualSignatureConfig,
      });
      console.log('[identity-art-director] AiImageGenerator retornou', { tier: result.tier, assetUrl: result.assetUrl });

      if (result.tier === 'typographic') {
        console.log('[identity-art-director] typographic fallback detectado — lançando erro');
        throw new Error('identity_art_director_failed: Typographic fallback não é permitido para geração sem logo');
      }

      const parsedIntent = parseCreativeIntent(result.aiResponseMessage);
      const metadataArtDirectorOutput: VisualSignatureMetadataArtDirectorOutput =
        parsedIntent.output;

      // F47.1 (D9): enriquece o envelope bufferizado da imagem ANTES do flush
      // (um único evento por tentativa; nada é atualizado depois de persistido).
      const activeSink = telemetry?.sink;
      if (activeSink instanceof DeferredAiTelemetrySink) {
        activeSink.enrichLast('visual_signature_image', { ...parsedIntent.metadata });
      }

      const artDirectorOutput: VisualSignatureArtDirectorOutput = {
        creative_description: `Assinatura visual para ${input.storeName} (${input.segment})`,
        suggested_colors: input.brandColor ? [input.brandColor] : [],
        visual_direction: metadataArtDirectorOutput.visual_direction,
        elements_used: ['nome da loja'],
      };

      const tier = result.tier ?? 'image_direct';
      const signatureType = tier === 'image_direct' ? 'ai_generated' : 'automatic_generated';

      console.log('[identity-art-director] persistindo signature...');
      const signature = await persistSignature({
        store_id: input.storeId,
        storage_path: result.storagePath,
        asset_url: null,
        type: signatureType,
        status: 'draft',
        generation_mode: input.rejectionContext ? 'automatic' : 'user_choice',
        prompt: result.prompt,
        metadata: {
          ...result.metadata,
          ...parsedIntent.metadata,
          artDirectorOutput,
        },
      });
      console.log('[identity-art-director] signature persistida', { signatureId: signature.id });

      return {
        signature,
        artDirectorOutput,
        metadataArtDirectorOutput,
        assetUrl: result.assetUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log('[identity-art-director] catch — erro', { message, stack: error instanceof Error ? error.stack : '' });
      throw new Error(`identity_art_director_failed: ${message}`);
    }
  }
}
