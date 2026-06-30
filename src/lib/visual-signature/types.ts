import type { ColorCluster } from '@/lib/brand-assets/types';
export type { ColorCluster };
import { findClosestProbeCluster } from '@/lib/brand-assets/color-probe';

export type VisualSignatureType =
  | "ai_generated"
  | "automatic_generated"
  | "fallback_typographic";

export type VisualSignatureStatus = "draft" | "active" | "archived";

export type GenerationMode = "user_choice" | "automatic" | "fallback";

export type GenerationTier = "image_direct" | "image_retry" | "typographic";

export type CascadeAttemptStatus = "failed" | "rejected" | "timeout";

export interface CascadeAttempt {
  tier: "image_direct" | "image_retry";
  provider: string;
  model: string;
  elapsedMs: number;
  status: CascadeAttemptStatus;
  errorCode: string;
  errorMessageSanitized: string;
}

export interface VisualSignatureMetadata {
  generation_tier: GenerationTier;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  fallbackReason?: string;
  previousAttempts?: CascadeAttempt[];
  totalElapsedMs?: number;
  generationParams?: Record<string, unknown>;
  artDirectorOutput?: VisualSignatureArtDirectorOutput | VisualSignatureMetadataArtDirectorOutput;
  input_snapshot?: VisualSignatureMetadataInputSnapshot;
}

export interface VisualSignatureRecord {
  id: string;
  store_id: string;
  storage_path: string;
  asset_url: string;
  type: VisualSignatureType;
  status: VisualSignatureStatus;
  generation_mode: GenerationMode | null;
  prompt: string | null;
  metadata: VisualSignatureMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVisualSignatureInput {
  store_id: string;
  storage_path: string;
  asset_url: string;
  type: VisualSignatureType;
  status: VisualSignatureStatus;
  generation_mode?: GenerationMode;
  prompt?: string;
  metadata?: VisualSignatureMetadata;
}

export interface VisualSignatureSnapshot {
  visualSignatureUrl: string | null;
  visualSignatureType: VisualSignatureType | null;
}

export type CascadeResult =
  | {
      tier: "image_direct" | "image_retry";
      assetUrl: string;
      storagePath: string;
      mimeType: "image/png";
      prompt: string;
      metadata: VisualSignatureMetadata;
      aiResponseMessage?: string;
    }
  | {
      tier: "typographic";
      assetUrl: string;
      storagePath: string;
      mimeType: "image/svg+xml";
      prompt?: string;
      metadata?: VisualSignatureMetadata;
      aiResponseMessage?: string;
    };

export type GenerateVariationsResult =
  | { variations: CascadeResult[]; success: true }
  | { success: false; error: string };

export type LogoStatus = 'uploaded' | 'generated' | 'explicit_none' | 'failed' | 'exhausted' | null;

export type GenerationEventType = 'visual_signature' | 'brand_profile_without_logo' | 'brand_profile_with_logo';

export type GenerationEventStatus = 'success' | 'failed' | 'rejected' | 'timeout';

export interface GenerationEventRecord {
  id: string;
  store_id: string;
  generation_type: GenerationEventType;
  provider: string | null;
  model: string | null;
  duration_ms: number | null;
  estimated_cost_usd: number | null;
  attempt_number: number;
  status: GenerationEventStatus;
  error_type: string | null;
  prompt_version: string | null;
  approved: boolean | null;
  rejected: boolean | null;
  asset_generated: boolean | null;
  asset_id: string | null;
  has_logo: boolean | null;
  has_generated_signature: boolean | null;
  has_brand_profile: boolean | null;
  input_data_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GenerationEventInsert {
  store_id: string;
  generation_type: GenerationEventType;
  provider?: string | null;
  model?: string | null;
  duration_ms?: number | null;
  estimated_cost_usd?: number | null;
  attempt_number?: number;
  status: GenerationEventStatus;
  error_type?: string | null;
  prompt_version?: string | null;
  approved?: boolean | null;
  rejected?: boolean | null;
  asset_generated?: boolean | null;
  asset_id?: string | null;
  has_logo?: boolean | null;
  has_generated_signature?: boolean | null;
  has_brand_profile?: boolean | null;
  input_data_hash?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VisualSignatureArtDirectorOutput {
  creative_description: string;
  suggested_colors: string[];
  visual_direction: string;
  elements_used: string[];
}

export interface VisualSignatureMetadataInputSnapshot {
  name: string;
  segment: string;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  city: string | null;
  state: string | null;
  brand_color: string | null;
  accent_color: string | null;
}

export interface IntendedPalette {
  primary: string;
  accent: string;
  background: string;
  support: string[];
}

export interface ResolvedPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export interface ColorUsage {
  primary: string;
  accent: string;
  support: string;
  background: string;
}

export type VisionFailureReason = 'api_error' | 'invalid_json' | 'no_choice' | 'hex_outside_observed_colors';

export type VisionAdjudicationAudit =
  | { status: 'success'; reason: string; prompt_suffix: string }
  | { status: 'failed'; reason: VisionFailureReason; details?: string; attemptedAt: string };

export interface ColorValidationEntry {
  intended: string | null;
  resolved: string;
  presence: 'confirmed' | 'ambiguous' | 'not_confirmed' | 'unchecked';
  delta_e: number | null;
  role_source: 'art_director' | 'vision_adjudication' | 'heuristic';
  resolution: 'accepted' | 'accepted_unverified' | 'corrected_by_vision' | 'selected_by_heuristic';
  resolved_from_cluster?: { hex: string; classification: string; frequency: number; delta_e: number } | null;
  note?: string;
}

export interface ColorValidationResolved {
  global_status: 'all_confirmed' | 'vision_adjudicated' | 'probe_unavailable' | 'fallback_heuristic';
  primary: ColorValidationEntry;
  accent: ColorValidationEntry;
  secondary: ColorValidationEntry;
  background: ColorValidationEntry;
  support_colors: string[];
  support_details?: ColorValidationEntry[];
  vision_adjudication?: VisionAdjudicationAudit;
}

export interface ColorValidationFailed {
  global_status: 'vision_failed';
  vision_adjudication: VisionAdjudicationAudit;
}

export type ColorValidation = ColorValidationResolved | ColorValidationFailed;

export interface SupportCorrection {
  index: number;
  color: string;
}

export interface RawVisionCorrections {
  primary: string | null;
  accent: string | null;
  background: string | null;
  support: SupportCorrection[];
}

export interface RawVisionAdjudication {
  corrections: RawVisionCorrections;
  reason: string;
}

export interface NormalizedVisionAdjudication {
  palette: IntendedPalette;
  reason: string;
}

export interface VisualSignatureMetadataArtDirectorOutput {
  visual_direction: string;
  content_used: {
    store_name: boolean;
    city: boolean;
    state: boolean;
    slogan: boolean;
  };
  visual_elements?: string[];
  intended_palette?: IntendedPalette;
  color_usage?: ColorUsage;
}

export type RestoreEligibilityReason = 'ok' | 'critical_drift' | 'missing_metadata';

export interface RestoreEligibility {
  can_restore: boolean;
  drift_fields: string[];
  requires_regeneration: boolean;
  reason: RestoreEligibilityReason;
}

export interface VisualSignatureWithoutLogoInput {
  storeId: string;
  storeName: string;
  segment: string;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  city: string | null;
  state: string | null;
  brandColor: string | null;
  rejectionContext?: {
    reason: string;
    attempt: number;
  } | null;
}

export interface BrandProfilerInput {
  storeId: string;
  storeName: string;
  segment: string;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  city: string | null;
  state: string | null;
  brandColor: string | null;
  artDirectorOutput: VisualSignatureArtDirectorOutput;
  visualSignatureId: string;
  assetUrl: string;
  referenceCardUrl?: string | null;
  intendedPalette?: IntendedPalette | null;
  previousBrandColors?: Array<string | null>;
  mode?: 'reuse' | 'regenerate';
  contentUsed?: {
    store_name: boolean;
    city: boolean;
    state: boolean;
    slogan: boolean;
  } | null;
}

export interface BrandProfilerWithoutLogoResult {
  logo_colors_detected: string[];
  safe_color_tokens: ResolvedPalette;
  visual_style: string;
  visual_tone: string;
  typography_direction: string;
  brand_personality: string;
  campaign_guidelines: string;
  campaign_brief: string;
  inferred_primary_color: string;
  inferred_accent_color: string;
  confidence_score: number;
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export class VisionAdjudicationError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'VisionAdjudicationError';
    this.code = code;
  }
}

export function normalizeIntendedPalette(raw: unknown): IntendedPalette | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const primary = typeof obj.primary === 'string' && HEX_REGEX.test(obj.primary) ? obj.primary.toUpperCase() : null;
  const accent = typeof obj.accent === 'string' && HEX_REGEX.test(obj.accent) ? obj.accent.toUpperCase() : null;
  const background = typeof obj.background === 'string' && HEX_REGEX.test(obj.background) ? obj.background.toUpperCase() : null;
  if (!primary || !accent || !background) return null;
  const support = Array.isArray(obj.support)
    ? obj.support.filter((s): s is string => typeof s === 'string' && HEX_REGEX.test(s)).map(s => s.toUpperCase())
    : [];
  return { primary, accent, background, support };
}

export function intendedToResolved(intended: IntendedPalette, supportResolved: string[]): ResolvedPalette {
  return {
    primary: intended.primary,
    secondary: supportResolved[0] ?? intended.primary,
    accent: intended.accent,
    background: intended.background,
  };
}

export function composeSupport(original: string[], contestedIndices: number[], corrections: SupportCorrection[]): string[] {
  const correctionMap = new Map<number, string>();
  for (const c of corrections) {
    correctionMap.set(c.index, c.color);
  }
  return original.map((color, index) => {
    if (contestedIndices.includes(index) && correctionMap.has(index)) {
      return correctionMap.get(index)!;
    }
    return color;
  });
}

export function resolveRole(
  roleValue: string,
  visionValue: string | null,
  isContested: boolean
): string {
  if (!isContested) return roleValue;
  if (visionValue === null) {
    throw new VisionAdjudicationError(`Contested role resolved as null`, 'no_choice');
  }
  return visionValue;
}

function validateHex(hex: unknown): hex is string {
  return typeof hex === 'string' && HEX_REGEX.test(hex);
}

function revalidateVisionHex(hex: string, clusters: ColorCluster[], label: string): void {
  const match = findClosestProbeCluster(hex, clusters);
  if (!match.cluster || match.deltaE > 18) {
    throw new VisionAdjudicationError(
      `${label} HEX ${hex} rejected — ∆E ${match.deltaE.toFixed(1)} > 18`,
      'hex_outside_observed_colors'
    );
  }
}

export function validateRawVisionAdjudication(raw: unknown): { corrections: Record<string, unknown>; reason: string } & { supportCorrections: SupportCorrection[] } {
  if (!raw || typeof raw !== 'object') {
    throw new VisionAdjudicationError('Raw is not an object', 'invalid_json');
  }
  const obj = raw as Record<string, unknown>;
  const correctionsRaw = obj.corrections;
  if (!correctionsRaw || typeof correctionsRaw !== 'object') {
    throw new VisionAdjudicationError('Missing corrections in raw', 'invalid_json');
  }
  const corrections = correctionsRaw as Record<string, unknown>;
  const reason = typeof obj.reason === 'string' ? obj.reason : '';

  if (corrections.primary !== undefined && corrections.primary !== null && !validateHex(corrections.primary)) {
    throw new VisionAdjudicationError('corrections.primary must be null or valid hex', 'invalid_json');
  }
  if (corrections.accent !== undefined && corrections.accent !== null && !validateHex(corrections.accent)) {
    throw new VisionAdjudicationError('corrections.accent must be null or valid hex', 'invalid_json');
  }
  if (corrections.background !== undefined && corrections.background !== null && !validateHex(corrections.background)) {
    throw new VisionAdjudicationError('corrections.background must be null or valid hex', 'invalid_json');
  }
  if (!Array.isArray(corrections.support)) {
    throw new VisionAdjudicationError('corrections.support must be an array', 'invalid_json');
  }

  const supportCorrections = corrections.support as SupportCorrection[];
  const seenIndices = new Set<number>();
  for (const sc of supportCorrections) {
    if (typeof sc.index !== 'number' || typeof sc.color !== 'string' || !HEX_REGEX.test(sc.color)) {
      throw new VisionAdjudicationError('Invalid support correction entry', 'invalid_json');
    }
    if (seenIndices.has(sc.index)) {
      throw new VisionAdjudicationError(`Duplicate support index ${sc.index}`, 'invalid_json');
    }
    seenIndices.add(sc.index);
  }

  return { corrections, reason, supportCorrections };
}

export function normalizeAdjudication(
  raw: unknown,
  fallback: IntendedPalette,
  contestedRoles: string[],
  contestedSupportIndices: number[],
  nonArtifactClusters: ColorCluster[]
): NormalizedVisionAdjudication {
  const { corrections, reason, supportCorrections } = validateRawVisionAdjudication(raw);

  const primaryVision = typeof corrections.primary === 'string' ? corrections.primary.toUpperCase() : null;
  const accentVision = typeof corrections.accent === 'string' ? corrections.accent.toUpperCase() : null;
  const backgroundVision = typeof corrections.background === 'string' ? corrections.background.toUpperCase() : null;

  const isPrimaryContested = contestedRoles.includes('primary');
  const isAccentContested = contestedRoles.includes('accent');
  const isBackgroundContested = contestedRoles.includes('background');

  if (isPrimaryContested && primaryVision !== null) {
    revalidateVisionHex(primaryVision, nonArtifactClusters, 'primary');
  }
  if (isAccentContested && accentVision !== null) {
    revalidateVisionHex(accentVision, nonArtifactClusters, 'accent');
  }
  if (isBackgroundContested && backgroundVision !== null) {
    revalidateVisionHex(backgroundVision, nonArtifactClusters, 'background');
  }

  const primary = resolveRole(fallback.primary, primaryVision, isPrimaryContested);
  const accent = resolveRole(fallback.accent, accentVision, isAccentContested);
  const background = resolveRole(fallback.background, backgroundVision, isBackgroundContested);

  const filteredSupportCorrections = supportCorrections.filter(sc =>
    sc.index >= 0 && sc.index < fallback.support.length
  );
  const filteredContested = contestedSupportIndices.filter(idx =>
    idx >= 0 && idx < fallback.support.length
  );
  const correctedIndices = new Set(filteredSupportCorrections.map(sc => sc.index));
  for (const idx of filteredContested) {
    if (!correctedIndices.has(idx)) {
      throw new VisionAdjudicationError(`Missing correction for contested support index ${idx}`, 'no_choice');
    }
  }

  for (const sc of filteredSupportCorrections) {
    if (filteredContested.includes(sc.index)) {
      revalidateVisionHex(sc.color.toUpperCase(), nonArtifactClusters, `support[${sc.index}]`);
    }
  }

  const support = composeSupport(fallback.support, filteredContested, filteredSupportCorrections);

  const palette: IntendedPalette = {
    primary,
    accent,
    background,
    support,
  };

  return { palette, reason };
}
