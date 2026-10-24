import type {
  ColorUsage,
  VisualSignatureMetadataArtDirectorOutput,
} from "./types";
import { normalizeIntendedPalette } from "./types";

/**
 * F47.1 (D9) — parsing e proveniência da intenção criativa.
 *
 * O parser NUNCA apresenta valores sintéticos de fallback como se fossem
 * direção retornada pelo modelo. `content_used` e `visual_direction` também são
 * validados em runtime: array/objeto inválido, indicadores não booleanos e
 * direção vazia não são aceitos como resposta válida.
 */

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
  | "invalid_content_used"
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
const CONTENT_USED_KEYS = ["store_name", "city", "state", "slogan"] as const;

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function paletteStatus(
  intendedPalette: unknown,
): {
  status: "present_normalized" | "absent" | "invalid";
  normalized: ReturnType<typeof normalizeIntendedPalette>;
} {
  if (intendedPalette === undefined || intendedPalette === null) {
    return { status: "absent", normalized: null };
  }
  const normalized = normalizeIntendedPalette(intendedPalette);
  return {
    status: normalized ? "present_normalized" : "invalid",
    normalized,
  };
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

function validatedVisualElements(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((item) => typeof item === "string")) return undefined;
  return value;
}

/**
 * Separa PARSING de APLICAÇÃO DE FALLBACK. O retorno sempre contém o output
 * utilizável e a proveniência explícita.
 */
export function parseCreativeIntent(
  aiResponseMessage: string | undefined,
): CreativeIntentParseResult {
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
      if (!isPlainObject(raw)) {
        return fallbackResult({
          status: "invalid_json",
          reason: "invalid_json",
          palette: "absent",
          contentUsedPresent: false,
        });
      }
      parsed = raw;
    } catch {
      return fallbackResult({
        status: "invalid_json",
        reason: "invalid_json",
        palette: "absent",
        contentUsedPresent: false,
      });
    }

    const palette = paletteStatus(parsed.intended_palette);
    const rawDirection = parsed.visual_direction;
    const visualDirection =
      typeof rawDirection === "string" ? rawDirection.trim() : "";

    const rawContentUsed = parsed.content_used;
    if (rawContentUsed === undefined || rawContentUsed === null) {
      return fallbackResult({
        status: "incomplete_json",
        reason: !visualDirection
          ? "missing_visual_direction"
          : "missing_content_used",
        palette: palette.status,
        contentUsedPresent: false,
      });
    }

    if (!isPlainObject(rawContentUsed)) {
      return fallbackResult({
        status: "incomplete_json",
        reason: "invalid_content_used",
        palette: palette.status,
        contentUsedPresent: false,
      });
    }

    if (!visualDirection) {
      return fallbackResult({
        status: "incomplete_json",
        reason: "missing_visual_direction",
        palette: palette.status,
        contentUsedPresent: true,
      });
    }

    const invalidIndicator = CONTENT_USED_KEYS.find((key) => {
      if (!Object.prototype.hasOwnProperty.call(rawContentUsed, key)) {
        return false;
      }
      return typeof rawContentUsed[key] !== "boolean";
    });
    if (invalidIndicator) {
      return fallbackResult({
        status: "incomplete_json",
        reason: "invalid_content_used",
        palette: palette.status,
        contentUsedPresent: true,
      });
    }

    const contentUsedRecord = rawContentUsed;
    let validatedColorUsage: ColorUsage | undefined;
    const cu = parsed.color_usage;
    if (
      cu &&
      isPlainObject(cu) &&
      typeof cu.primary === "string" &&
      typeof cu.accent === "string" &&
      typeof cu.support === "string" &&
      typeof cu.background === "string"
    ) {
      validatedColorUsage = cu as unknown as ColorUsage;
    }

    return {
      output: {
        visual_direction: visualDirection,
        content_used: {
          store_name:
            (contentUsedRecord.store_name as boolean | undefined) ?? true,
          city: (contentUsedRecord.city as boolean | undefined) ?? false,
          state: (contentUsedRecord.state as boolean | undefined) ?? false,
          slogan: (contentUsedRecord.slogan as boolean | undefined) ?? false,
        },
        visual_elements: validatedVisualElements(parsed.visual_elements),
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
