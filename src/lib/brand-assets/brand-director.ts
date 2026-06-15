import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { BrandDirectorResult } from './types';
import OpenAI from 'openai';
import sharp from 'sharp';

export interface DeterministicColorResult {
  logo_colors_detected: string[];
  safe_color_tokens: { primary: string; secondary: string; accent: string; background: string };
  inferred_primary_color: string;
  inferred_accent_color: string;
}

export class BrandDirectorAnalysisError extends Error {
  public readonly metadata: { provider: string; model: string; elapsedMs: number; errorType: string };
  public readonly deterministicResult: DeterministicColorResult | null;
  constructor(
    message: string,
    metadata: { provider: string; model: string; elapsedMs: number; errorType: string },
    deterministicResult?: DeterministicColorResult | null,
  ) {
    super(message);
    this.name = 'BrandDirectorAnalysisError';
    this.metadata = metadata;
    this.deterministicResult = deterministicResult ?? null;
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
  userPrimaryColor?: string;
  userAccentColor?: string;
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(value: string): boolean {
  return HEX_REGEX.test(value);
}

function sanitizeHexArray(colors: string[]): string[] {
  return colors.filter(isValidHex).map(c => c.toUpperCase());
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const clamped = Math.max(0, Math.min(255, Math.round(x)));
    return clamped.toString(16).padStart(2, '0').toUpperCase();
  }).join('');
}

function isNeutral(r: number, g: number, b: number): boolean {
  if (r > 240 && g > 240 && b > 240) return true;
  if (r > 230 && g > 225 && b > 215 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 20) return true;
  return false;
}

function isNeutralHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return isNeutral(r, g, b);
}

function pickPrimaryFromPalette(colors: string[]): string | null {
  const chromatic = colors.filter(c => !isNeutralHex(c));
  return chromatic.length > 0 ? chromatic[0] : (colors[0] ?? null);
}

function pickAccentFromPalette(colors: string[], primary: string | null): string | null {
  const chromatic = colors.filter(c => !isNeutralHex(c) && c !== primary);
  if (chromatic.length > 0) return chromatic[chromatic.length > 1 ? 1 : 0];
  const nonPrimary = colors.filter(c => c !== primary);
  return nonPrimary.length > 0 ? nonPrimary[0] : primary;
}

export class BrandDirectorService {
  private promptLoader = new PromptLoader();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private async extractColorsFromBuffer(buffer: Buffer): Promise<string[]> {
    try {
      const { data, info } = await sharp(buffer)
        .resize(150, 150, { fit: 'cover' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixelCount = data.length / 3;
      const colorMap = new Map<string, number>();

      for (let i = 0; i < pixelCount; i++) {
        const r = data[i * 3];
        const g = data[i * 3 + 1];
        const b = data[i * 3 + 2];

        if (isNeutral(r, g, b)) continue;

        const quantized = `${Math.min(255, Math.round(r / 32) * 32)},${Math.min(255, Math.round(g / 32) * 32)},${Math.min(255, Math.round(b / 32) * 32)}`;
        colorMap.set(quantized, (colorMap.get(quantized) ?? 0) + 1);
      }

      const sorted = [...colorMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key]) => {
          const [r, g, b] = key.split(',').map(Number);
          return rgbToHex(r, g, b);
        });

      return sorted.length > 0 ? sorted.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  async analyze(params: {
    logoBuffer: Buffer;
    logoMimeType: string;
    storeData: StoreAnalysisInput;
  }): Promise<BrandDirectorResult> {
    const startTime = Date.now();

    // Step 1: Deterministic color extraction from logo (always runs)
    const extractedColors = await this.extractColorsFromBuffer(params.logoBuffer);
    const safePalette = sanitizeHexArray(extractedColors);
    const deterministicPrimary = pickPrimaryFromPalette(safePalette);
    const deterministicAccent = pickAccentFromPalette(safePalette, deterministicPrimary);

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new BrandDirectorAnalysisError('OPENAI_API_KEY não configurada', {
          provider: 'openai',
          model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
          elapsedMs: 0,
          errorType: 'missing_api_key',
        });
      }

      const primary = deterministicPrimary ?? '#CC0000';
      const accent = deterministicAccent ?? '#CC0000';

      return {
        logo_colors_detected: safePalette.length > 0 ? safePalette : ['#CC0000', '#000000'],
        safe_color_tokens: {
          primary,
          secondary: '#666666',
          accent,
          background: '#FFFFFF',
        },
        visual_style: 'mock — desenvolvimento',
        visual_tone: 'mock — desenvolvimento',
        typography_direction: 'mock — desenvolvimento',
        brand_personality: 'mock — desenvolvimento',
        campaign_guidelines: 'mock — desenvolvimento',
        campaign_brief: 'mock — desenvolvimento',
        inferred_primary_color: primary,
        inferred_accent_color: accent,
        confidence_score: 0.1,
      };
    }

    const model = process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o';

    console.log(`[BrandDirector] logo analysis start: model=${model}, mimeType=${params.logoMimeType}, bufferSize=${params.logoBuffer.length} bytes, store=${params.storeData.storeName}`);

    // Step 2: Build deterministic color result (always available as fallback)
    const deterministicResult: DeterministicColorResult = {
      logo_colors_detected: safePalette.length > 0 ? safePalette : [],
      safe_color_tokens: {
        primary: deterministicPrimary ?? '#000000',
        secondary: '#666666',
        accent: deterministicAccent ?? '#CC0000',
        background: '#FFFFFF',
      },
      inferred_primary_color: deterministicPrimary ?? '#000000',
      inferred_accent_color: deterministicAccent ?? '#CC0000',
    };

    try {
      // Step 3: Build user colors section
      let userColorsSection = '';
      if (params.storeData.userPrimaryColor || params.storeData.userAccentColor) {
        userColorsSection = [
          '## Preferência de Cores do Lojista',
          '',
          'O lojista escolheu manualmente as seguintes cores. Considere como SINAL DE PREFERÊNCIA, não como regra obrigatória — você pode adotar, ajustar ou descartar conforme seu julgamento profissional:',
          '',
          ...(params.storeData.userPrimaryColor
            ? [`- **Cor primária escolhida:** ${params.storeData.userPrimaryColor}`]
            : []),
          ...(params.storeData.userAccentColor
            ? [`- **Cor de destaque escolhida:** ${params.storeData.userAccentColor}`]
            : []),
          '',
          'Instrução: avalie se as cores escolhidas são adequadas para o segmento e perfil da loja. Se forem apropriadas, incorpore-as. Se não forem ideais, sugira alternativas melhores no mesmo espectro.',
        ].join('\n');
      }

      // Step 4: Load prompt with user colors
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
        userColorsSection,
      });

      const base64Image = params.logoBuffer.toString('base64');
      const imageDataUrl = `data:${params.logoMimeType};base64,${base64Image}`;

      console.log(`[BrandDirector] calling OpenAI vision: model=${model}, detail=high, maxTokens=3000, dataUrlLength=${imageDataUrl.length}`);

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise o logotipo desta loja e gere o perfil de marca completo em JSON.' },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      });

      const elapsedMs = Date.now() - startTime;
      const rawContent = response.choices[0]?.message?.content ?? '{}';
      const raw = JSON.parse(rawContent);

      const hasVisualStyle = !!(raw.visual_style && String(raw.visual_style).trim());
      const hasConfidence = typeof raw.confidence_score === 'number';

      console.log(`[BrandDirector] OpenAI vision response: success=true, elapsed=${elapsedMs}ms, hasVisualStyle=${hasVisualStyle}, hasConfidence=${hasConfidence}, rawKeys=${Object.keys(raw).join(',')}`);

      if (!hasVisualStyle) {
        const errorMsg = `GPT returned incomplete JSON: visual_style is empty. Raw keys: ${Object.keys(raw).join(',')}`;
        console.error(`[BrandDirector] ${errorMsg}. Full raw: ${JSON.stringify(raw).slice(0, 500)}`);
        throw new BrandDirectorAnalysisError(
          errorMsg,
          { provider: 'openai', model, elapsedMs, errorType: 'incomplete_response' },
          deterministicResult,
        );
      }

      // Step 5: Colors come from deterministic extraction; GPT provides semantic analysis
      const result: BrandDirectorResult = {
        logo_colors_detected: deterministicResult.logo_colors_detected,
        safe_color_tokens: {
          primary: deterministicResult.inferred_primary_color,
          secondary: raw.safe_color_tokens?.secondary ?? '#666666',
          accent: deterministicResult.inferred_accent_color,
          background: raw.safe_color_tokens?.background ?? '#FFFFFF',
        },
        visual_style: String(raw.visual_style ?? ''),
        visual_tone: String(raw.visual_tone ?? ''),
        typography_direction: String(raw.typography_direction ?? ''),
        brand_personality: String(raw.brand_personality ?? ''),
        campaign_guidelines: String(raw.campaign_guidelines ?? ''),
        campaign_brief: String(raw.campaign_brief ?? ''),
        inferred_primary_color: deterministicResult.inferred_primary_color,
        inferred_accent_color: deterministicResult.inferred_accent_color,
        confidence_score: hasConfidence ? Math.max(0, Math.min(1, raw.confidence_score)) : 0.5,
      };

      return result;
    } catch (err) {
      const elapsedMs = Date.now() - startTime;

      if (err instanceof BrandDirectorAnalysisError) {
        console.error(`[BrandDirector] analysis failed: type=${err.metadata.errorType}, elapsed=${elapsedMs}ms, msg=${err.message}`);
        throw err;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[BrandDirector] unexpected error: elapsed=${elapsedMs}ms, msg=${errorMessage}`);

      throw new BrandDirectorAnalysisError(
        errorMessage,
        { provider: 'openai', model, elapsedMs, errorType: 'api_error' },
        deterministicResult,
      );
    }
  }
}
