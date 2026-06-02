import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { BrandDirectorResult } from './types';
import OpenAI from 'openai';

export class BrandDirectorAnalysisError extends Error {
  public readonly metadata: { provider: string; model: string; elapsedMs: number; errorType: string };
  constructor(message: string, metadata: { provider: string; model: string; elapsedMs: number; errorType: string }) {
    super(message);
    this.name = 'BrandDirectorAnalysisError';
    this.metadata = metadata;
  }
}

export interface StoreAnalysisInput {
  storeName: string;
  segment: string;
  subsegment?: string;
  city?: string;
  state?: string;
  tone_of_voice?: string;
  positioning?: string;
  short_description?: string;
  slogan?: string;
}

export class BrandDirectorService {
  private promptLoader = new PromptLoader();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async analyze(params: { logoBuffer: Buffer; logoMimeType: string; storeData: StoreAnalysisInput }): Promise<BrandDirectorResult> {
    const startTime = Date.now();

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new BrandDirectorAnalysisError('OPENAI_API_KEY não configurada', {
          provider: 'openai',
          model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
          elapsedMs: 0,
          errorType: 'missing_api_key',
        });
      }

      return {
        logo_colors_detected: ['#CC0000', '#000000'],
        safe_color_tokens: { primary: '#CC0000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' },
        visual_style: 'mock — desenvolvimento',
        visual_tone: 'mock — desenvolvimento',
        typography_direction: 'mock — desenvolvimento',
        brand_personality: 'mock — desenvolvimento',
        campaign_guidelines: 'mock — desenvolvimento',
        campaign_brief: 'mock — desenvolvimento',
        confidence_score: 0.1,
      };
    }

    try {
      const prompt = this.promptLoader.load('store-brand-director-with-logo', {
        storeName: params.storeData.storeName,
        segment: params.storeData.segment,
        subsegment: params.storeData.subsegment ?? '',
        city: params.storeData.city ?? '',
        state: params.storeData.state ?? '',
        tone_of_voice: params.storeData.tone_of_voice ?? '',
        positioning: params.storeData.positioning ?? '',
        short_description: params.storeData.short_description ?? '',
        slogan: params.storeData.slogan ?? '',
      });

      const base64Image = params.logoBuffer.toString('base64');
      const imageDataUrl = `data:${params.logoMimeType};base64,${base64Image}`;

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise o logotipo desta loja e gere o perfil de marca:' },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}');
      const elapsedMs = Date.now() - startTime;

      const result: BrandDirectorResult = {
        logo_colors_detected: Array.isArray(raw.logo_colors_detected) ? raw.logo_colors_detected.slice(0, 5) : [],
        safe_color_tokens: raw.safe_color_tokens ?? { primary: '#000000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' },
        visual_style: String(raw.visual_style ?? ''),
        visual_tone: String(raw.visual_tone ?? ''),
        typography_direction: String(raw.typography_direction ?? ''),
        brand_personality: String(raw.brand_personality ?? ''),
        campaign_guidelines: String(raw.campaign_guidelines ?? ''),
        campaign_brief: String(raw.campaign_brief ?? ''),
        confidence_score: typeof raw.confidence_score === 'number' ? Math.max(0, Math.min(1, raw.confidence_score)) : 0,
      };

      return result;
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof BrandDirectorAnalysisError ? err.metadata.errorType : 'api_error';

      throw new BrandDirectorAnalysisError(errorMessage, {
        provider: 'openai',
        model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
        elapsedMs,
        errorType,
      });
    }
  }
}
