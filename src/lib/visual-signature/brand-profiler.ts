import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import OpenAI from 'openai';
import type {
  BrandProfilerInput,
  BrandProfilerWithoutLogoResult,
  IntendedPalette,
  ResolvedPalette,
  ColorValidation,
  ColorValidationEntry,
  ColorValidationResolved,
  ColorValidationFailed,
  VisionAdjudicationAudit,
  ColorCluster as VSColorCluster,
} from '@/lib/visual-signature/types';
import { normalizeIntendedPalette, intendedToResolved, normalizeAdjudication, VisionAdjudicationError } from '@/lib/visual-signature/types';
import type {
  BrandProfileRecord,
  ColorCluster,
} from '@/lib/brand-assets/types';
import { probeColors, findClosestProbeCluster } from '@/lib/brand-assets/color-probe';

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

  private async downloadAssetBuffer(assetUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(assetUrl);
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    } catch (err) {
      console.error(`[BrandProfiler] Failed to download asset:`, err);
    }
    return null;
  }

  private getAllNonArtifactClusters(probe: import('@/lib/brand-assets/types').ColorProbeResult): ColorCluster[] {
    return [
      ...probe.dominant_pixels,
      ...probe.dark_ink_candidates,
      ...probe.neutral_candidates,
      ...probe.background_candidates,
      ...probe.small_but_structural,
    ];
  }

  private classifyPresence(deltaE: number): 'confirmed' | 'ambiguous' | 'not_confirmed' {
    if (deltaE <= 18) return 'confirmed';
    if (deltaE <= 25) return 'ambiguous';
    return 'not_confirmed';
  }

  private selectObservedColors(
    clusters: ColorCluster[],
    contestedHexes: string[]
  ): ColorCluster[] {
    const mandatory = new Set<ColorCluster>();
    for (const hex of contestedHexes) {
      const closest = findClosestProbeCluster(hex, clusters);
      if (closest.cluster) mandatory.add(closest.cluster);
    }

    const classifications: ColorCluster['classification'][] = ['dominant', 'dark_ink', 'neutral', 'background', 'structural'];
    for (const cls of classifications) {
      const candidates = clusters.filter(c => c.classification === cls);
      if (candidates.length > 0) {
        const best = candidates.reduce((a, b) => a.frequency > b.frequency ? a : b);
        mandatory.add(best);
      }
    }

    const remaining = clusters.filter(c => !mandatory.has(c))
      .sort((a, b) => b.frequency - a.frequency);

    const selected = [...mandatory, ...remaining].slice(0, 12);

    const deduped: ColorCluster[] = [];
    for (const c of selected) {
      const tooClose = deduped.find(e => {
        const d = Math.sqrt(
          Math.pow(e.rgb[0] - c.rgb[0], 2) +
          Math.pow(e.rgb[1] - c.rgb[1], 2) +
          Math.pow(e.rgb[2] - c.rgb[2], 2)
        );
        return d <= 6;
      });
      if (!tooClose || mandatory.has(c)) deduped.push(c);
    }

    return deduped;
  }

  private buildPromptContext(
    variant: 'happy_path' | 'divergence' | 'legacy',
    input: BrandProfilerInput,
    extra: Record<string, string> = {}
  ): string {
    const base: Record<string, string> = {
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
      suggestedColors: JSON.stringify(input.artDirectorOutput.suggested_colors),
      visualDirection: input.artDirectorOutput.visual_direction,
      elementsUsed: JSON.stringify(input.artDirectorOutput.elements_used),
      ...extra,
    };

    if (variant === 'happy_path') {
      base.happyPath = 'true';
    } else if (variant === 'divergence') {
      base.divergencePath = 'true';
    }

    return this.promptLoader.load('store-brand-profiler', base);
  }

  async generate(input: BrandProfilerInput): Promise<BrandProfileGenerationResult> {
    const startTime = Date.now();

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
      if (existingProfile.status === 'outdated') {
        await supabase
          .from('store_brand_profiles')
          .update({ status: 'synced', updated_at: new Date().toISOString() })
          .eq('id', existingProfile.id);
      }
      return { profile: existingProfile as BrandProfileRecord, success: true };
    }

    const buffer = await this.downloadAssetBuffer(input.assetUrl);
    let probeResult: import('@/lib/brand-assets/types').ColorProbeResult | null = null;
    if (buffer) {
      probeResult = await probeColors(buffer);
    }

    const nonArtifactClusters = probeResult
      ? this.getAllNonArtifactClusters(probeResult)
      : [];

    // --- PATH 1: intendedPalette provided → presence validation + optional vision arbitration ---
    if (input.intendedPalette) {
      if (!process.env.OPENAI_API_KEY) {
        if (process.env.NODE_ENV === 'production') {
          throw new BrandProfilerWithoutLogoError('OPENAI_API_KEY não configurada', {
            provider: 'openai',
            model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
            elapsedMs: 0, errorType: 'missing_api_key',
          });
        }
        return this.mockGenerate(input, probeResult);
      }

      return this.generateWithIntendedPalette(input, buffer, probeResult, nonArtifactClusters, startTime);
    }

    // --- PATH 2: No intendedPalette (retry/legacy) → fallback heuristic ---
    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new BrandProfilerWithoutLogoError('OPENAI_API_KEY não configurada', {
          provider: 'openai',
          model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
          elapsedMs: 0, errorType: 'missing_api_key',
        });
      }
      return this.mockGenerate(input, probeResult);
    }

    return this.generateWithFallback(input, probeResult, nonArtifactClusters, startTime);
  }

  private async mockGenerate(
    input: BrandProfilerInput,
    probeResult: import('@/lib/brand-assets/types').ColorProbeResult | null
  ): Promise<BrandProfileGenerationResult> {
    const colors = this.extractProbeColors(probeResult) ?? ['#666666'];
    const safeExtracted = sanitizeHexArray(colors);
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

  private extractProbeColors(probeResult: import('@/lib/brand-assets/types').ColorProbeResult | null): string[] {
    if (!probeResult) return [];
    const brandClusters = [
      ...probeResult.dominant_pixels,
      ...probeResult.small_but_structural,
      ...probeResult.dark_ink_candidates,
    ];
    const seen = new Set<string>();
    return brandClusters
      .filter(c => { if (seen.has(c.hex)) return false; seen.add(c.hex); return true; })
      .slice(0, 5)
      .map(c => c.hex);
  }

  private async generateWithIntendedPalette(
    input: BrandProfilerInput,
    buffer: Buffer | null,
    probeResult: import('@/lib/brand-assets/types').ColorProbeResult | null,
    nonArtifactClusters: ColorCluster[],
    startTime: number
  ): Promise<BrandProfileGenerationResult> {
    const intended = input.intendedPalette!;
    const roles: { role: string; hex: string }[] = [
      { role: 'primary', hex: intended.primary },
      { role: 'accent', hex: intended.accent },
      { role: 'background', hex: intended.background },
      ...intended.support.map((hex, i) => ({ role: `support[${i}]`, hex })),
    ];

    let allConfirmed = true;
    let probeUnavailable = false;
    const contestedRoles: string[] = [];
    const contestedSupportIndices: number[] = [];
    const rolePresence: Map<string, { presence: ColorValidationEntry['presence']; deltaE: number | null; cluster: ColorCluster | null }> = new Map();

    if (nonArtifactClusters.length === 0) {
      probeUnavailable = true;
    } else {
      for (const { role, hex } of roles) {
        const match = findClosestProbeCluster(hex, nonArtifactClusters);
        const presence = this.classifyPresence(match.deltaE);
        rolePresence.set(role, { presence, deltaE: match.deltaE, cluster: match.cluster });
        if (presence === 'ambiguous' || presence === 'not_confirmed') {
          allConfirmed = false;
          if (role.startsWith('support[')) {
            const idx = parseInt(role.slice(8, -1), 10);
            contestedSupportIndices.push(idx);
          } else {
            contestedRoles.push(role);
          }
        }
      }
    }

    if (probeUnavailable) {
      return this.handleProbeUnavailable(input, intended, startTime);
    }

    if (allConfirmed) {
      return this.handleAllConfirmed(input, intended, nonArtifactClusters, rolePresence, startTime);
    }

    return this.handleDivergence(input, intended, buffer, nonArtifactClusters, rolePresence, contestedRoles, contestedSupportIndices, startTime);
  }

  private async handleProbeUnavailable(
    input: BrandProfilerInput,
    intended: IntendedPalette,
    startTime: number
  ): Promise<BrandProfileGenerationResult> {
    const resolved = intendedToResolved(intended, intended.support);
    const safeColors = sanitizeResolvedPalette(resolved);

    const result: BrandProfilerWithoutLogoResult = {
      logo_colors_detected: input.artDirectorOutput.suggested_colors,
      safe_color_tokens: safeColors,
      visual_style: '', visual_tone: '', typography_direction: '',
      brand_personality: '', campaign_guidelines: '', campaign_brief: '',
      inferred_primary_color: safeColors.primary,
      inferred_accent_color: safeColors.accent,
      confidence_score: 0.5,
    };

    const colorValidation: ColorValidationResolved = {
      global_status: 'probe_unavailable',
      primary: makeValidationEntry(intended.primary, safeColors.primary, 'unchecked', null, 'art_director', 'accepted_unverified'),
      accent: makeValidationEntry(intended.accent, safeColors.accent, 'unchecked', null, 'art_director', 'accepted_unverified'),
      secondary: makeValidationEntry(null, safeColors.secondary, 'unchecked', null, 'art_director', 'accepted_unverified'),
      background: makeValidationEntry(intended.background, safeColors.background, 'unchecked', null, 'art_director', 'accepted_unverified'),
      support_colors: intended.support,
    };

    const prompt = this.buildPromptContext('happy_path', input);
    const visionResult = await this.callVision(input, prompt);
    const enriched = this.mergeSemanticFields(result, visionResult);

    const profile = await this.persistProfile(input, enriched, colorValidation);
    await this.syncStores(input.storeId, safeColors);
    return { profile, success: true };
  }

  private async handleAllConfirmed(
    input: BrandProfilerInput,
    intended: IntendedPalette,
    nonArtifactClusters: ColorCluster[],
    rolePresence: Map<string, { presence: ColorValidationEntry['presence']; deltaE: number | null; cluster: ColorCluster | null }>,
    startTime: number
  ): Promise<BrandProfileGenerationResult> {
    const resolved = intendedToResolved(intended, intended.support);
    const safeColors = sanitizeResolvedPalette(resolved);

    const result: BrandProfilerWithoutLogoResult = {
      logo_colors_detected: this.extractProbeColorsFromClusters(nonArtifactClusters),
      safe_color_tokens: safeColors,
      visual_style: '', visual_tone: '', typography_direction: '',
      brand_personality: '', campaign_guidelines: '', campaign_brief: '',
      inferred_primary_color: safeColors.primary,
      inferred_accent_color: safeColors.accent,
      confidence_score: 0.9,
    };

    const supportDetails = intended.support.map((hex, i) => {
      const presence = rolePresence.get(`support[${i}]`);
      return makeValidationEntry(hex, hex, presence?.presence ?? 'unchecked', presence?.deltaE ?? null, 'art_director', 'accepted');
    });

    const colorValidation: ColorValidationResolved = {
      global_status: 'all_confirmed',
      primary: makeValidationEntry(intended.primary, safeColors.primary, rolePresence.get('primary')?.presence ?? 'confirmed', rolePresence.get('primary')?.deltaE ?? null, 'art_director', 'accepted'),
      accent: makeValidationEntry(intended.accent, safeColors.accent, rolePresence.get('accent')?.presence ?? 'confirmed', rolePresence.get('accent')?.deltaE ?? null, 'art_director', 'accepted'),
      secondary: makeValidationEntry(null, safeColors.secondary, 'unchecked', null, 'art_director', 'accepted'),
      background: makeValidationEntry(intended.background, safeColors.background, rolePresence.get('background')?.presence ?? 'confirmed', rolePresence.get('background')?.deltaE ?? null, 'art_director', 'accepted'),
      support_colors: intended.support,
      support_details: supportDetails,
    };

    const prompt = this.buildPromptContext('happy_path', input);
    const visionResult = await this.callVision(input, prompt);
    const enriched = this.mergeSemanticFields(result, visionResult);

    const profile = await this.persistProfile(input, enriched, colorValidation);
    await this.syncStores(input.storeId, safeColors);
    return { profile, success: true };
  }

  private async handleDivergence(
    input: BrandProfilerInput,
    intended: IntendedPalette,
    buffer: Buffer | null,
    nonArtifactClusters: ColorCluster[],
    rolePresence: Map<string, { presence: ColorValidationEntry['presence']; deltaE: number | null; cluster: ColorCluster | null }>,
    contestedRoles: string[],
    contestedSupportIndices: number[],
    startTime: number
  ): Promise<BrandProfileGenerationResult> {
    const contestedHexes: string[] = [];
    for (const role of contestedRoles) {
      const hex = intended[role as keyof IntendedPalette];
      if (typeof hex === 'string') contestedHexes.push(hex);
    }
    for (const idx of contestedSupportIndices) {
      if (idx < intended.support.length) contestedHexes.push(intended.support[idx]);
    }

    const observedClusters = this.selectObservedColors(nonArtifactClusters, contestedHexes);
    const observedColorsStr = observedClusters.map(c => `- ${c.hex} (${c.classification}, ${(c.frequency * 100).toFixed(1)}%)`).join('\n');
    const contestedRolesStr = [...contestedRoles, ...contestedSupportIndices.map(i => `support[${i}]`)].map(r => {
      const hex = r.startsWith('support[')
        ? intended.support[parseInt(r.slice(8, -1), 10)]
        : intended[r as keyof IntendedPalette] as string;
      const pres = rolePresence.get(r);
      return `- **${r}**: ${hex} (∆E ${pres?.deltaE?.toFixed(1) ?? 'N/A'}, ${pres?.presence})`;
    }).join('\n');

    const prompt = this.buildPromptContext('divergence', input, {
      contestedRoles: contestedRolesStr,
      observedColors: observedColorsStr,
    });

    try {
      const visionResult = await this.callVisionFull(input, prompt);
      const raw = JSON.parse(visionResult);
      const correctionsObj = {
        corrections: raw.corrections,
        reason: raw.reason ?? '',
      };

      const normalized = normalizeAdjudication(
        correctionsObj,
        intended,
        contestedRoles,
        contestedSupportIndices,
        nonArtifactClusters
      );

      const resolved = intendedToResolved(normalized.palette, normalized.palette.support);
      const safeColors = sanitizeResolvedPalette(resolved);
      const supportResolved = normalized.palette.support;

      const result: BrandProfilerWithoutLogoResult = {
        logo_colors_detected: this.extractProbeColorsFromClusters(nonArtifactClusters),
        safe_color_tokens: safeColors,
        visual_style: String(raw.visual_style ?? ''),
        visual_tone: String(raw.visual_tone ?? ''),
        typography_direction: String(raw.typography_direction ?? ''),
        brand_personality: String(raw.brand_personality ?? ''),
        campaign_guidelines: String(raw.campaign_guidelines ?? ''),
        campaign_brief: String(raw.campaign_brief ?? ''),
        inferred_primary_color: safeColors.primary,
        inferred_accent_color: safeColors.accent,
        confidence_score: typeof raw.confidence_score === 'number' ? Math.max(0, Math.min(1, raw.confidence_score)) : 0.7,
      };

      const promptSuffix = contestedRoles.length > 0 || contestedSupportIndices.length > 0
        ? `analyze_and_correct_${[...contestedRoles, ...contestedSupportIndices.map(i => `support${i}`)].join('_')}`
        : 'analyze_only';

      const visionAudit: VisionAdjudicationAudit = {
        status: 'success',
        reason: raw.reason ?? '',
        prompt_suffix: promptSuffix,
      };

      const supportDetails = intended.support.map((hex, i) => {
        const presence = rolePresence.get(`support[${i}]`);
        const correctedHex = supportResolved[i] ?? hex;
        return makeValidationEntry(
          hex,
          correctedHex,
          presence?.presence ?? 'unchecked',
          presence?.deltaE ?? null,
          contestedSupportIndices.includes(i) ? 'vision_adjudication' : 'art_director',
          contestedSupportIndices.includes(i) ? 'corrected_by_vision' : 'accepted'
        );
      });

      const colorValidation: ColorValidationResolved = {
        global_status: 'vision_adjudicated',
        primary: makeValidationEntry(intended.primary, safeColors.primary, rolePresence.get('primary')?.presence ?? 'confirmed', rolePresence.get('primary')?.deltaE ?? null, contestedRoles.includes('primary') ? 'vision_adjudication' : 'art_director', contestedRoles.includes('primary') ? 'corrected_by_vision' : 'accepted'),
        accent: makeValidationEntry(intended.accent, safeColors.accent, rolePresence.get('accent')?.presence ?? 'confirmed', rolePresence.get('accent')?.deltaE ?? null, contestedRoles.includes('accent') ? 'vision_adjudication' : 'art_director', contestedRoles.includes('accent') ? 'corrected_by_vision' : 'accepted'),
        secondary: makeValidationEntry(null, safeColors.secondary, 'unchecked', null, 'art_director', 'accepted'),
        background: makeValidationEntry(intended.background, safeColors.background, rolePresence.get('background')?.presence ?? 'confirmed', rolePresence.get('background')?.deltaE ?? null, contestedRoles.includes('background') ? 'vision_adjudication' : 'art_director', contestedRoles.includes('background') ? 'corrected_by_vision' : 'accepted'),
        support_colors: supportResolved,
        support_details: supportDetails,
        vision_adjudication: visionAudit,
      };

      const profile = await this.persistProfile(input, result, colorValidation);
      await this.syncStores(input.storeId, safeColors);
      return { profile, success: true };
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof VisionAdjudicationError ? err.code : 'api_error';

      const failureReason: import('@/lib/visual-signature/types').VisionFailureReason =
        errorType === 'no_choice' || errorType === 'invalid_json' || errorType === 'hex_outside_observed_colors' || errorType === 'api_error'
          ? errorType
          : 'api_error';

      const visionFailedAudit: VisionAdjudicationAudit = {
        status: 'failed',
        reason: failureReason,
        details: errorMessage,
        attemptedAt: new Date().toISOString(),
      };

      const failedValidation: ColorValidationFailed = {
        global_status: 'vision_failed',
        vision_adjudication: visionFailedAudit,
      };

      await this.persistFailedProfile(input, errorMessage, [], failedValidation);

      throw new BrandProfilerWithoutLogoError(errorMessage, {
        provider: 'openai',
        model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
        elapsedMs,
        errorType,
      });
    }
  }

  private async generateWithFallback(
    input: BrandProfilerInput,
    probeResult: import('@/lib/brand-assets/types').ColorProbeResult | null,
    nonArtifactClusters: ColorCluster[],
    startTime: number
  ): Promise<BrandProfileGenerationResult> {
    const brandColor = input.brandColor;

    let safeColors: ResolvedPalette;
    let logoColors: string[];
    let globalStatus: ColorValidationResolved['global_status'];

    if (nonArtifactClusters.length > 0) {
      const dominant = nonArtifactClusters
        .filter(c => c.classification === 'dominant' && c.saturation >= 0.1 && c.luminance >= 0.25)
        .sort((a, b) => b.frequency - a.frequency);

      const structural = nonArtifactClusters
        .filter(c => c.classification === 'structural')
        .sort((a, b) => b.frequency - a.frequency);

      const bgCandidates = nonArtifactClusters
        .filter(c => c.classification === 'background')
        .sort((a, b) => b.edgeRatio - a.edgeRatio);

      const primaryHex = dominant[0]?.hex ?? brandColor ?? '#666666';
      const secondHex = dominant.length > 1 ? dominant[1].hex : (structural[0]?.hex ?? primaryHex);
      const accentHex = secondHex;
      const bgHex = bgCandidates[0]?.hex ?? nonArtifactClusters.sort((a, b) => b.edgeRatio - a.edgeRatio)[0]?.hex ?? '#FFFFFF';

      safeColors = { primary: primaryHex, secondary: secondHex, accent: accentHex, background: bgHex };
      logoColors = this.extractProbeColorsFromClusters(nonArtifactClusters);
      globalStatus = 'fallback_heuristic';
    } else {
      const primary = brandColor ?? '#666666';
      safeColors = {
        primary,
        secondary: primary,
        accent: primary,
        background: '#FFFFFF',
      };
      logoColors = [primary];
      globalStatus = 'fallback_heuristic';
    }

    const result: BrandProfilerWithoutLogoResult = {
      logo_colors_detected: logoColors,
      safe_color_tokens: safeColors,
      visual_style: '', visual_tone: '', typography_direction: '',
      brand_personality: '', campaign_guidelines: '', campaign_brief: '',
      inferred_primary_color: safeColors.primary,
      inferred_accent_color: safeColors.accent,
      confidence_score: 0.5,
    };

    const roleSource: ColorValidationEntry['role_source'] = 'heuristic';
    const resolution: ColorValidationEntry['resolution'] = 'selected_by_heuristic';

    const colorValidation: ColorValidationResolved = {
      global_status: globalStatus,
      primary: makeValidationEntry(null, safeColors.primary, 'unchecked', null, roleSource, resolution),
      accent: makeValidationEntry(null, safeColors.accent, 'unchecked', null, roleSource, resolution),
      secondary: makeValidationEntry(null, safeColors.secondary, 'unchecked', null, roleSource, resolution),
      background: makeValidationEntry(null, safeColors.background, 'unchecked', null, roleSource, resolution),
      support_colors: [],
    };

    const prompt = this.buildPromptContext('legacy', input);
    const visionResult = await this.callVision(input, prompt);
    const enriched = this.mergeSemanticFields(result, visionResult);

    const profile = await this.persistProfile(input, enriched, colorValidation);
    await this.syncStores(input.storeId, safeColors);
    return { profile, success: true };
  }

  private extractProbeColorsFromClusters(clusters: ColorCluster[]): string[] {
    const brandClusters = clusters.filter(c =>
      c.classification === 'dominant' || c.classification === 'structural' || c.classification === 'dark_ink'
    );
    const seen = new Set<string>();
    return brandClusters
      .filter(c => { if (seen.has(c.hex)) return false; seen.add(c.hex); return true; })
      .slice(0, 5)
      .map(c => c.hex);
  }

  private async callVision(input: BrandProfilerInput, prompt: string): Promise<string> {
    const model = process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o';
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analise visualmente a assinatura visual aprovada e gere o perfil de marca.' },
            { type: 'image_url', image_url: { url: input.assetUrl, detail: 'low' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });
    return response.choices[0]?.message?.content ?? '{}';
  }

  private async callVisionFull(input: BrandProfilerInput, prompt: string): Promise<string> {
    const model = process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o';
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analise visualmente a assinatura visual aprovada, corrija as cores contestadas e gere o perfil de marca completo.' },
            { type: 'image_url', image_url: { url: input.assetUrl, detail: 'low' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    });
    return response.choices[0]?.message?.content ?? '{}';
  }

  private mergeSemanticFields(result: BrandProfilerWithoutLogoResult, visionJson: string): BrandProfilerWithoutLogoResult {
    try {
      const raw = JSON.parse(visionJson);
      return {
        ...result,
        visual_style: String(raw.visual_style ?? result.visual_style),
        visual_tone: String(raw.visual_tone ?? result.visual_tone),
        typography_direction: String(raw.typography_direction ?? result.typography_direction),
        brand_personality: String(raw.brand_personality ?? result.brand_personality),
        campaign_guidelines: String(raw.campaign_guidelines ?? result.campaign_guidelines),
        campaign_brief: String(raw.campaign_brief ?? result.campaign_brief),
        confidence_score: typeof raw.confidence_score === 'number'
          ? Math.max(0, Math.min(1, raw.confidence_score))
          : result.confidence_score,
      };
    } catch {
      return result;
    }
  }

  private async syncStores(storeId: string, safeColors: ResolvedPalette): Promise<void> {
    console.log(`[BrandProfiler] Syncing colors to store ${storeId}: primary=${safeColors.primary}, accent=${safeColors.accent}`);
    await supabase
      .from('stores')
      .update({
        brand_color: safeColors.primary,
        accent_color: safeColors.accent,
      })
      .eq('id', storeId);
  }

  private getBrandColorsChosen(input: BrandProfilerInput, safeColors: ResolvedPalette): string[] {
    if (input.previousBrandColors && input.previousBrandColors.length > 0) {
      return input.previousBrandColors;
    }
    return [];
  }

  private async persistProfile(
    input: BrandProfilerInput,
    result: BrandProfilerWithoutLogoResult,
    colorValidation?: ColorValidation
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

    const brandColorsChosen = this.getBrandColorsChosen(input, safeTokens);

    const metadata: Record<string, unknown> = {
      art_director_output: input.artDirectorOutput,
      asset_url: input.assetUrl,
    };
    if (colorValidation) {
      metadata.color_validation = colorValidation;
    }

    const profileData = {
      store_id: input.storeId,
      source: 'without_logo',
      active_logo_asset_id: null,
      visual_signature_id: input.visualSignatureId,
      logo_colors_detected: palette,
      brand_colors_chosen: brandColorsChosen,
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
      metadata,
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
    _extractedColors: string[] = [],
    colorValidation?: ColorValidation
  ): Promise<void> {
    const rawColors = _extractedColors.length > 0 ? _extractedColors : input.artDirectorOutput.suggested_colors;
    const palette = sanitizeHexArray(rawColors);
    const finalPalette = palette.length > 0 ? palette : ['#666666'];
    const primary = pickPrimaryFromPalette(finalPalette) ?? '#666666';
    const accent = pickAccentFromPalette(finalPalette, primary) ?? primary;

    const brandColorsChosen = this.getBrandColorsChosen(input, { primary, secondary: '#999999', accent, background: '#FFFFFF' });

    const metadata: Record<string, unknown> = {
      error: errorMessage,
      art_director_output: input.artDirectorOutput,
      extracted_colors: _extractedColors,
    };
    if (colorValidation) {
      metadata.color_validation = colorValidation;
    }

    const failedData = {
      store_id: input.storeId,
      source: 'without_logo',
      active_logo_asset_id: null,
      visual_signature_id: input.visualSignatureId,
      logo_colors_detected: finalPalette,
      brand_colors_chosen: brandColorsChosen,
      safe_color_tokens: {},
      visual_style: null,
      visual_tone: null,
      typography_direction: null,
      brand_personality: null,
      campaign_guidelines: null,
      campaign_brief: null,
      confidence_score: null,
      metadata,
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

function sanitizeResolvedPalette(palette: ResolvedPalette): ResolvedPalette {
  return {
    primary: sanitizeHex(palette.primary) ?? '#666666',
    secondary: sanitizeHex(palette.secondary) ?? '#999999',
    accent: sanitizeHex(palette.accent) ?? '#666666',
    background: sanitizeHex(palette.background) ?? '#FFFFFF',
  };
}

function makeValidationEntry(
  intended: string | null,
  resolved: string,
  presence: ColorValidationEntry['presence'],
  deltaE: number | null,
  roleSource: ColorValidationEntry['role_source'],
  resolution: ColorValidationEntry['resolution']
): ColorValidationEntry {
  return {
    intended,
    resolved,
    presence,
    delta_e: deltaE,
    role_source: roleSource,
    resolution,
  };
}
