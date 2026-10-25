import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { TextOnlyInferenceInput, TextOnlyInferenceResult } from './types';
import type { AiCallInfo } from '@/lib/ai-cost/types';
import { defaultAiGateway, withOnCallTelemetry } from '@/lib/ai';
import type {
  AiInvocationMessage,
  AiInvocationRequest,
  AiInvoker,
  AiTelemetryContext,
} from '@/lib/ai';
import { AiInvocationError } from '@/lib/ai';

/** Espelha o default do registry para `brand_profile_text` (F46 D1). */
const DEFAULT_MODEL = 'gpt-4o';

export class BrandTextOnlyInferenceError extends Error {
  public readonly metadata: { provider: string; model: string; elapsedMs: number; errorType: string };
  constructor(message: string, metadata: { provider: string; model: string; elapsedMs: number; errorType: string }) {
    super(message);
    this.name = 'BrandTextOnlyInferenceError';
    this.metadata = metadata;
  }
}

/**
 * InferÃªncia de identidade visual apenas por texto (F46-03).
 *
 * Executa via camada Ãºnica (`invoke("brand_profile_text")`) â€” NÃƒO instancia
 * `new OpenAI()` nem lÃª env-var de modelo. Exige um `AiTelemetryContext`
 * injetado pelo caller (a persistÃªncia Ã© do sink).
 */
export class BrandTextOnlyInferenceService {
  private promptLoader = new PromptLoader();
  private readonly invoker: AiInvoker;

  constructor(invoker: AiInvoker = defaultAiGateway) {
    this.invoker = invoker;
  }

  async infer(
    input: TextOnlyInferenceInput,
    timeoutMs: number = 30000,
    /** F38.1 (D7/D11): callback best-effort com o envelope jÃ¡ produzido (brand_profile_text). Opcional â€” nunca bloqueia. */
    onCall?: (info: AiCallInfo) => void | Promise<void>,
    /** F46-03 (D9): contexto de telemetria do caller (run/sink obrigatÃ³rio). */
    telemetry?: AiTelemetryContext,
  ): Promise<TextOnlyInferenceResult> {
    const startTime = Date.now();

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new BrandTextOnlyInferenceError('OPENAI_API_KEY nÃ£o configurada', {
          provider: 'openai',
          model: DEFAULT_MODEL,
          elapsedMs: 0,
          errorType: 'missing_api_key',
        });
      }

      return {
        safe_color_tokens: { primary: '#CC0000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' },
        visual_style: 'mock â€” desenvolvimento',
        visual_tone: 'mock â€” desenvolvimento',
        typography_direction: 'mock â€” desenvolvimento',
        brand_personality: 'mock â€” desenvolvimento',
        campaign_guidelines: 'mock â€” desenvolvimento',
        campaign_brief: 'mock â€” desenvolvimento',
        inferred_primary_color: '#CC0000',
        inferred_accent_color: '#CC0000',
        confidence_score: 0.1,
      };
    }

    if (!telemetry) {
      throw new BrandTextOnlyInferenceError(
        '[BrandTextOnlyInferenceService] AiTelemetryContext Ã© obrigatÃ³rio para invoke("brand_profile_text")',
        { provider: 'openai', model: DEFAULT_MODEL, elapsedMs: 0, errorType: 'missing_telemetry' },
      );
    }

    let effectiveModel = DEFAULT_MODEL;

    try {
      let userColorsSection = '';
      if (input.userPrimaryColor || input.userAccentColor) {
        userColorsSection = `## PreferÃªncia de Cores do Lojista\n\nO lojista escolheu manualmente as seguintes cores. Considere como SINAL DE PREFERÃŠNCIA, nÃ£o como regra obrigatÃ³ria â€” vocÃª pode adotar, ajustar ou descartar conforme seu julgamento profissional:\n\n`;
        if (input.userPrimaryColor) {
          userColorsSection += `- **Cor primÃ¡ria escolhida:** ${input.userPrimaryColor}\n`;
        }
        if (input.userAccentColor) {
          userColorsSection += `- **Cor de destaque escolhida:** ${input.userAccentColor}\n`;
        }
        userColorsSection += `\nInstruÃ§Ã£o: avalie se as cores escolhidas sÃ£o adequadas para o segmento e perfil da loja. Se forem apropriadas, incorpore-as. Se nÃ£o forem ideais, sugira alternativas melhores no mesmo espectro.`;
      }

      const prompt = this.promptLoader.load('store-brand-inference', {
        storeName: input.storeName,
        segment: input.segment,
        subsegment: input.subsegment ?? '',
        tone_of_voice: input.toneOfVoice ?? '',
        positioning: input.positioning ?? '',
        short_description: input.shortDescription ?? '',
        slogan: input.slogan ?? '',
        city: input.city ?? '',
        state: input.state ?? '',
        userColorsSection,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const userContent =
        'Gere a identidade visual para esta loja com base nos dados cadastrais fornecidos.';
      const messages: AiInvocationMessage[] = [
        { role: 'system', content: prompt },
        { role: 'user', content: userContent },
      ];
      const request: AiInvocationRequest = {
        prompt: userContent,
        messages,
        responseFormat: 'json_object',
        maxTokens: 2000,
        signal: controller.signal,
      };

      let result;
      try {
        result = await this.invoker.invoke(
          'brand_profile_text',
          request,
          withOnCallTelemetry(telemetry, onCall),
        );
        effectiveModel = result.model || DEFAULT_MODEL;
      } finally {
        clearTimeout(timeoutId);
      }

      const raw = JSON.parse(result.content ?? '{}');

      const safeColorTokens = raw.safe_color_tokens ?? { primary: '#000000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' };

      const inferenceResult: TextOnlyInferenceResult = {
        safe_color_tokens: safeColorTokens,
        visual_style: String(raw.visual_style ?? ''),
        visual_tone: String(raw.visual_tone ?? ''),
        typography_direction: String(raw.typography_direction ?? ''),
        brand_personality: String(raw.brand_personality ?? ''),
        campaign_guidelines: String(raw.campaign_guidelines ?? ''),
        campaign_brief: String(raw.campaign_brief ?? ''),
        inferred_primary_color: String(raw.inferred_primary_color ?? safeColorTokens.primary ?? '#000000'),
        inferred_accent_color: String(raw.inferred_accent_color ?? safeColorTokens.accent ?? '#CC0000'),
        confidence_score: typeof raw.confidence_score === 'number' ? Math.max(0, Math.min(1, raw.confidence_score)) : 0,
      };

      return inferenceResult;
    } catch (err) {
      const elapsedMs = Date.now() - startTime;

      const isTimeout =
        (err instanceof AiInvocationError && err.kind === 'timeout') ||
        (err instanceof Error && err.name === 'AbortError');

      if (isTimeout) {
        throw new BrandTextOnlyInferenceError('InferÃªncia excedeu o tempo limite', {
          provider: 'openai',
          model: effectiveModel,
          elapsedMs,
          errorType: 'timeout',
        });
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof BrandTextOnlyInferenceError ? err.metadata.errorType : 'api_error';

      throw new BrandTextOnlyInferenceError(errorMessage, {
        provider: 'openai',
        model: effectiveModel,
        elapsedMs,
        errorType,
      });
    }
  }
}

