import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import type {
  BrandProfilerInput,
  BrandProfilerWithoutLogoResult,
} from '@/lib/visual-signature/types';
import type {
  BrandProfileRecord,
} from '@/lib/brand-assets/types';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(value: string): boolean {
  return HEX_REGEX.test(value);
}

/**
 * Validates and normalizes a hex color. Returns null for invalid/missing values.
 * Never invents a color — caller must provide a fallback from a valid source.
 */
function sanitizeHex(value: string | null | undefined): string | null {
  if (value && isValidHex(value)) return value.toUpperCase();
  return null;
}

/**
 * Filters an array to only valid hex values. Never invents colors.
 */
function sanitizeHexArray(colors: string[]): string[] {
  return colors.filter(isValidHex).map(c => c.toUpperCase());
}

/**
 * Converts RGB to Hex string. Each channel is clamped 0-255, rounded,
 * and padded to exactly 2 hex digits. Output is always #RRGGBB (7 chars).
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const clamped = Math.max(0, Math.min(255, Math.round(x)));
    return clamped.toString(16).padStart(2, '0').toUpperCase();
  }).join('');
}

/**
 * Checks if a color is neutral (white/gray/black/off-white)
 */
function isNeutral(r: number, g: number, b: number): boolean {
  if (r > 240 && g > 240 && b > 240) return true;
  if (r > 230 && g > 225 && b > 215 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 20) return true;
  return false;
}

/** Checks if a hex color is neutral by converting to RGB */
function isNeutralHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return isNeutral(r, g, b);
}

/**
 * Picks the best primary color from a validated palette.
 * Prioritizes chromatic (non-neutral) colors; avoids white, black, grays.
 * Returns null only if the palette is empty.
 */
function pickPrimaryFromPalette(colors: string[]): string | null {
  const chromatic = colors.filter(c => !isNeutralHex(c));
  return chromatic.length > 0 ? chromatic[0] : (colors[0] ?? null);
}

/**
 * Picks the best accent color from a validated palette.
 * Prefers a chromatic color different from primary.
 * Returns primary as fallback, or null if palette is empty.
 */
function pickAccentFromPalette(colors: string[], primary: string | null): string | null {
  const chromatic = colors.filter(c => !isNeutralHex(c) && c !== primary);
  if (chromatic.length > 0) return chromatic[chromatic.length > 1 ? 1 : 0];
  const nonPrimary = colors.filter(c => c !== primary);
  return nonPrimary.length > 0 ? nonPrimary[0] : primary;
}

export class BrandProfilerWithoutLogoError extends Error {
  public readonly metadata: {
    provider: string;
    model: string;
    elapsedMs: number;
    errorType: string;
  };

  constructor(
    message: string,
    metadata: {
      provider: string;
      model: string;
      elapsedMs: number;
      errorType: string;
    }
  ) {
    super(message);
    this.name = 'BrandProfilerWithoutLogoError';
    this.metadata = metadata;
  }
}

export interface BrandProfileGenerationResult {
  profile: BrandProfileRecord;
  success: true;
}

export class BrandProfilerWithoutLogoService {
  private promptLoader: PromptLoader;
  private openai: OpenAI;

  constructor() {
    this.promptLoader = new PromptLoader();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Extracts dominant colors from the image buffer using sharp
   */
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

      return sorted.length > 0 ? sorted.slice(0, 5) : ['#666666'];
    } catch (err) {
      console.error('[BrandProfiler] sharp extraction failed:', err);
      return [];
    }
  }

  async generate(input: BrandProfilerInput): Promise<BrandProfileGenerationResult> {
    const startTime = Date.now();

    // 1. Check if we already have a profile for THIS visual signature (any status)
    // Reuse even if outdated — switching back to a previously-approved signature
    // should NOT trigger a new GPT call.
    // Use order().limit(1) instead of maybeSingle() because existing
    // duplicate profiles cause maybeSingle() to return null silently.
    const { data: existingProfiles } = await supabase
      .from('store_brand_profiles')
      .select('*')
      .eq('store_id', input.storeId)
      .eq('visual_signature_id', input.visualSignatureId)
      .in('status', ['synced', 'outdated'])
      .eq('source', 'without_logo')
      .order('updated_at', { ascending: false })
      .limit(1);
    const existingProfile = existingProfiles?.[0] ?? null;

    if (existingProfile) {
      console.log(`[BrandProfiler] Found existing profile (${existingProfile.status}) for signature ${input.visualSignatureId}, reusing.`);
      // Re-activate if outdated
      if (existingProfile.status === 'outdated') {
        await supabase
          .from('store_brand_profiles')
          .update({ status: 'synced', updated_at: new Date().toISOString() })
          .eq('id', existingProfile.id);
      }
      return { profile: existingProfile as BrandProfileRecord, success: true };
    }

    // 2. Extract deterministic colors from image
    // Requirement 2: Deterministic extraction first
    let extractedColors: string[] = [];
    try {
      console.log(`[BrandProfiler] Downloading asset from ${input.assetUrl} for color extraction...`);
      const response = await fetch(input.assetUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        extractedColors = await this.extractColorsFromBuffer(buffer);
        console.log(`[BrandProfiler] Extracted colors:`, extractedColors);
      }
    } catch (err) {
      console.error(`[BrandProfiler] Error extracting colors from image:`, err);
      extractedColors = input.artDirectorOutput.suggested_colors;
    }

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new BrandProfilerWithoutLogoError(
          'OPENAI_API_KEY não configurada',
          {
            provider: 'openai',
            model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
            elapsedMs: 0,
            errorType: 'missing_api_key',
          }
        );
      }

      const safeExtracted = sanitizeHexArray(extractedColors);
      const mockPrimary = pickPrimaryFromPalette(safeExtracted);
      const mockAccent = pickAccentFromPalette(safeExtracted, mockPrimary);
      const mockProfile = await this.persistProfile(input, {
        logo_colors_detected: safeExtracted,
        safe_color_tokens: {
          primary: mockPrimary ?? '#666666',
          secondary: '#999999',
          accent: mockAccent ?? mockPrimary ?? '#666666',
          background: '#FFFFFF',
        },
        visual_style: 'mock — desenvolvimento',
        visual_tone: 'mock — desenvolvimento',
        typography_direction: 'mock — desenvolvimento',
        brand_personality: 'mock — desenvolvimento',
        campaign_guidelines: 'mock — desenvolvimento',
        campaign_brief: 'mock — desenvolvimento',
        inferred_primary_color: mockPrimary ?? '#666666',
        inferred_accent_color: mockAccent ?? mockPrimary ?? '#666666',
        confidence_score: 0.1,
      });

      return { profile: mockProfile, success: true };
    }

    try {
      const prompt = this.promptLoader.load('store-brand-profiler', {
        storeName: input.storeName,
        segment: input.segment,
        subsegment: input.subsegment ?? '',
        tone_of_voice: input.tone_of_voice ?? '',
        positioning: input.positioning ?? '',
        short_description: input.short_description ?? '',
        slogan: input.slogan ?? '',
        city: input.city ?? '',
        state: input.state ?? '',
        creativeDescription: input.artDirectorOutput.creative_description,
        suggestedColors: JSON.stringify(extractedColors),
        visualDirection: input.artDirectorOutput.visual_direction,
        elementsUsed: JSON.stringify(input.artDirectorOutput.elements_used),
      });

      const model = process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o'; // Prefer gpt-4o for vision
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise visualmente a assinatura visual aprovada e gere o perfil de marca. Extraia as cores REAIS presentes na imagem.' },
              {
                type: 'image_url',
                image_url: {
                  url: input.assetUrl,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}');
      const elapsedMs = Date.now() - startTime;

      // Colors MUST come from deterministic extraction only.
      // GPT may suggest colors in its response, but they are often hallucinated
      // (e.g. #00FF00, #800080) and can desvirtuar campanhas.
      // We use GPT ONLY for semantic brand analysis (style, tone, personality, etc.).
      const safePalette = sanitizeHexArray(extractedColors);
      const primaryColor = pickPrimaryFromPalette(safePalette);
      const accentColor = pickAccentFromPalette(safePalette, primaryColor);

      const result: BrandProfilerWithoutLogoResult = {
        logo_colors_detected: safePalette.length > 0 ? safePalette : ['#666666'],
        safe_color_tokens: {
          primary: primaryColor ?? '#666666',
          secondary: '#999999',
          accent: accentColor ?? primaryColor ?? '#666666',
          background: '#FFFFFF',
        },
        visual_style: String(raw.visual_style ?? ''),
        visual_tone: String(raw.visual_tone ?? ''),
        typography_direction: String(raw.typography_direction ?? ''),
        brand_personality: String(raw.brand_personality ?? ''),
        campaign_guidelines: String(raw.campaign_guidelines ?? ''),
        campaign_brief: String(raw.campaign_brief ?? ''),
        inferred_primary_color: primaryColor ?? '#666666',
        inferred_accent_color: accentColor ?? primaryColor ?? '#666666',
        confidence_score:
          typeof raw.confidence_score === 'number'
            ? Math.max(0, Math.min(1, raw.confidence_score))
            : 0.5,
      };

    const profile = await this.persistProfile(input, result);

    // Sync inferred color back to stores table for consistency
    if (result.inferred_primary_color) {
      console.log(`[BrandProfiler] Syncing primary color ${result.inferred_primary_color} to store ${input.storeId}`);
      await supabase
        .from('stores')
        .update({ brand_color: result.inferred_primary_color })
        .eq('id', input.storeId);
    }

    return { profile, success: true };
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType =
        err instanceof BrandProfilerWithoutLogoError
          ? err.metadata.errorType
          : 'api_error';

      await this.persistFailedProfile(input, errorMessage, extractedColors);

      throw new BrandProfilerWithoutLogoError(errorMessage, {
        provider: 'openai',
        model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
        elapsedMs,
        errorType,
      });
    }
  }

  private async persistProfile(
    input: BrandProfilerInput,
    result: BrandProfilerWithoutLogoResult
  ): Promise<BrandProfileRecord> {
    const safeLogoColors = sanitizeHexArray(result.logo_colors_detected);
    const palette = safeLogoColors.length > 0 ? safeLogoColors : ['#666666'];
    const safePrimary = sanitizeHex(result.inferred_primary_color)
      ?? pickPrimaryFromPalette(palette)
      ?? '#666666';
    const safeAccent = sanitizeHex(result.inferred_accent_color)
      ?? pickAccentFromPalette(palette, safePrimary)
      ?? safePrimary;

    const st = result.safe_color_tokens;
    const safeTokens = {
      primary: sanitizeHex(st.primary) ?? safePrimary,
      secondary: sanitizeHex(st.secondary) ?? '#999999',
      accent: sanitizeHex(st.accent) ?? safeAccent,
      background: sanitizeHex(st.background) ?? '#FFFFFF',
    };

    const profileData = {
      store_id: input.storeId,
      source: 'without_logo',
      active_logo_asset_id: null,
      visual_signature_id: input.visualSignatureId,
      logo_colors_detected: palette,
      brand_colors_chosen: palette.slice(0, 3),
      safe_color_tokens: safeTokens,
      visual_style: result.visual_style,
      visual_tone: result.visual_tone,
      typography_direction: result.typography_direction,
      brand_personality: result.brand_personality,
      campaign_guidelines: result.campaign_guidelines,
      campaign_brief: result.campaign_brief,
      inferred_primary_color: safePrimary,
      inferred_accent_color: safeAccent,
      confidence_score: result.confidence_score,
      metadata: {
        art_director_output: input.artDirectorOutput,
        asset_url: input.assetUrl,
      },
      version: 1,
      status: 'synced' as const,
    };

    // UPSERT: never create duplicate profiles for the same visual_signature_id.
    // Check for an existing profile first — update it if found, insert if not.
    // Use order().limit(1) to avoid the duplicate-profile bug with maybeSingle().
    const { data: existingProfiles } = await supabase
      .from('store_brand_profiles')
      .select('id')
      .eq('visual_signature_id', input.visualSignatureId)
      .order('updated_at', { ascending: false })
      .limit(1);
    const existingProfileId = existingProfiles?.[0]?.id ?? null;

    let data: BrandProfileRecord;
    let error: any;

    if (existingProfileId) {
      console.log(`[BrandProfiler] Updating existing profile ${existingProfileId} for signature ${input.visualSignatureId}`);
      const result_ = await supabase
        .from('store_brand_profiles')
        .update(profileData)
        .eq('id', existingProfileId)
        .select()
        .single();
      data = result_.data as BrandProfileRecord;
      error = result_.error;
    } else {
      console.log(`[BrandProfiler] No existing profile for signature ${input.visualSignatureId}, inserting new one.`);
      // Ensure no other synced profile exists for this store before inserting
      await this.markPreviousSyncedOutdated(input.storeId);
      const result_ = await supabase
        .from('store_brand_profiles')
        .insert(profileData)
        .select()
        .single();
      data = result_.data as BrandProfileRecord;
      error = result_.error;
    }

    if (error) {
      throw new Error(`Failed to persist brand profile: ${error.message}`);
    }

    return data;
  }

  private async persistFailedProfile(
    input: BrandProfilerInput,
    errorMessage: string,
    extractedColors: string[] = []
  ): Promise<void> {
    const rawColors = extractedColors.length > 0 ? extractedColors : input.artDirectorOutput.suggested_colors;
    const palette = sanitizeHexArray(rawColors);
    const finalPalette = palette.length > 0 ? palette : ['#666666'];
    const primary = pickPrimaryFromPalette(finalPalette) ?? '#666666';
    const accent = pickAccentFromPalette(finalPalette, primary) ?? primary;

    const failedData = {
      store_id: input.storeId,
      source: 'without_logo',
      active_logo_asset_id: null,
      visual_signature_id: input.visualSignatureId,
      logo_colors_detected: finalPalette,
      brand_colors_chosen: finalPalette.slice(0, 3),
      safe_color_tokens: {
        primary,
        secondary: '#999999',
        accent,
        background: '#FFFFFF',
      },
      visual_style: null,
      visual_tone: null,
      typography_direction: null,
      brand_personality: null,
      campaign_guidelines: null,
      campaign_brief: null,
      confidence_score: null,
      metadata: {
        error: errorMessage,
        art_director_output: input.artDirectorOutput,
        extracted_colors: extractedColors,
      },
      version: 1,
      status: 'failed' as const,
    };

    // UPSERT to prevent duplicate failed profiles for the same visual_signature_id
    // Use order().limit(1) to avoid the duplicate-profile bug with maybeSingle().
    const { data: existingProfiles } = await supabase
      .from('store_brand_profiles')
      .select('id')
      .eq('visual_signature_id', input.visualSignatureId)
      .order('updated_at', { ascending: false })
      .limit(1);
    const existingProfileId = existingProfiles?.[0]?.id ?? null;

    let error: any;
    if (existingProfileId) {
      const result = await supabase
        .from('store_brand_profiles')
        .update(failedData)
        .eq('id', existingProfileId);
      error = result.error;
    } else {
      const result = await supabase
        .from('store_brand_profiles')
        .insert(failedData);
      error = result.error;
    }

    if (error) {
      console.error('[BrandProfiler] Failed to persist failed profile:', error.message);
    }
  }

  private async markPreviousSyncedOutdated(storeId: string): Promise<void> {
    const { error } = await supabase
      .from('store_brand_profiles')
      .update({ status: 'outdated' })
      .eq('store_id', storeId)
      .eq('status', 'synced');

    if (error) {
      console.error('[BrandProfiler] Failed to mark previous profile outdated:', error.message);
    }
  }
}
