import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { TextOnlyInferenceInput, TextOnlyInferenceResult } from './types';
import OpenAI from 'openai';

export class BrandTextOnlyInferenceError extends Error {
  public readonly metadata: { provider: string; model: string; elapsedMs: number; errorType: string };
  constructor(message: string, metadata: { provider: string; model: string; elapsedMs: number; errorType: string }) {
    super(message);
    this.name = 'BrandTextOnlyInferenceError';
    this.metadata = metadata;
  }
}

export class BrandTextOnlyInferenceService {
  private promptLoader = new PromptLoader();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async infer(input: TextOnlyInferenceInput): Promise<TextOnlyInferenceResult> {
    const startTime = Date.now();

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new BrandTextOnlyInferenceError('OPENAI_API_KEY não configurada', {
          provider: 'openai',
          model: process.env.OPENAI_TEXT_ONLY_INFERENCE_MODEL ?? 'gpt-4o',
          elapsedMs: 0,
          errorType: 'missing_api_key',
        });
      }

      return {
        safe_color_tokens: { primary: '#CC0000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' },
        visual_style: 'mock — desenvolvimento',
        visual_tone: 'mock — desenvolvimento',
        typography_direction: 'mock — desenvolvimento',
        brand_personality: 'mock — desenvolvimento',
        campaign_guidelines: 'mock — desenvolvimento',
        campaign_brief: 'mock — desenvolvimento',
        inferred_primary_color: '#CC0000',
        inferred_accent_color: '#CC0000',
        confidence_score: 0.1,
      };
    }

    try {
      let userColorsSection = '';
      if (input.userPrimaryColor || input.userAccentColor) {
        userColorsSection = `## Preferência de Cores do Lojista\n\nO lojista escolheu manualmente as seguintes cores. Considere como SINAL DE PREFERÊNCIA, não como regra obrigatória — você pode adotar, ajustar ou descartar conforme seu julgamento profissional:\n\n`;
        if (input.userPrimaryColor) {
          userColorsSection += `- **Cor primária escolhida:** ${input.userPrimaryColor}\n`;
        }
        if (input.userAccentColor) {
          userColorsSection += `- **Cor de destaque escolhida:** ${input.userAccentColor}\n`;
        }
        userColorsSection += `\nInstrução: avalie se as cores escolhidas são adequadas para o segmento e perfil da loja. Se forem apropriadas, incorpore-as. Se não forem ideais, sugira alternativas melhores no mesmo espectro.`;
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

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_TEXT_ONLY_INFERENCE_MODEL ?? 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Gere a identidade visual para esta loja com base nos dados cadastrais fornecidos.' },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}');
      const elapsedMs = Date.now() - startTime;

      const safeColorTokens = raw.safe_color_tokens ?? { primary: '#000000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' };

      const result: TextOnlyInferenceResult = {
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

      return result;
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof BrandTextOnlyInferenceError ? err.metadata.errorType : 'api_error';

      throw new BrandTextOnlyInferenceError(errorMessage, {
        provider: 'openai',
        model: process.env.OPENAI_TEXT_ONLY_INFERENCE_MODEL ?? 'gpt-4o',
        elapsedMs,
        errorType,
      });
    }
  }
}
