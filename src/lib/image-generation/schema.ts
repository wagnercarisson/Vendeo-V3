import { z } from "zod";

// ─── Generate Image Request ───────────────────────────────────────────────
// Input received from POST /api/campaign/generate-image.
// productImageDataUrl is required — Phase 4.3 product+offer flow requires it.

export const GenerateImageRequestSchema = z.object({
  productName: z.string().min(1),
  storeName: z.string().min(1),
  storeSegment: z.string().min(1),
  storeTone: z.string().optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  originalPriceCents: z.number().int().nonnegative().optional(),
  discountedPriceCents: z.number().int().positive(),
  badgeText: z.string().optional(),
  hook: z.string().optional(),
  cta: z.string().optional(),
  description: z.string().optional(),
  objective: z.string().optional(),
  campaignDetails: z.string().optional(),
  additionalDetails: z.string().optional(),
  targetChannel: z.string().optional(),
  format: z.string().optional(),
  validity: z.string().optional(),
  availabilityNotes: z.string().optional(),
  sensitiveConstraints: z.string().optional(),
  storeLogoUrl: z.string().optional(),
  brandProfile: z.object({
    brand_colors_chosen: z.array(z.string()).optional(),
    safe_color_tokens: z.record(z.string()).optional(),
    visual_style: z.string().nullable().optional(),
    visual_tone: z.string().nullable().optional(),
    brand_personality: z.string().nullable().optional(),
    campaign_guidelines: z.string().nullable().optional(),
    campaign_brief: z.string().nullable().optional(),
    logoVariantUrl: z.string().nullable().optional(),
  }).optional(),
  productImageDataUrl: z.string().min(1, "Imagem do produto é obrigatória"),
  inputValidationOverride: z
    .object({
      productImageCheck: z.literal("user_confirmed_continue").optional(),
    })
    .optional(),
});

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;

// ─── Success Response (200) ───────────────────────────────────────────────
// Normal success or auto-fix success.

export const GenerateImageSuccessResponseSchema = z.object({
  imageDataUrl: z.string(),
  inputCorrections: z
    .object({
      productName: z.object({
        from: z.string(),
        to: z.string(),
        reason: z.string(),
      }),
    })
    .optional(),
});

export type GenerateImageSuccessResponse = z.infer<
  typeof GenerateImageSuccessResponseSchema
>;

// ─── Needs User Action Response (409) ─────────────────────────────────────
// Returned when input validation detects a conflict or low-confidence match.

export const GenerateImageNeedsUserActionResponseSchema = z.object({
  status: z.literal("needs_user_action"),
  reason: z.union([
    z.literal("product_image_conflict"),
    z.literal("product_image_low_confidence"),
    z.literal("product_image_strong_conflict"),
  ]),
  message: z.string(),
  suggestedProductName: z.string().optional(),
});

export type GenerateImageNeedsUserActionResponse = z.infer<
  typeof GenerateImageNeedsUserActionResponseSchema
>;

// ─── Input Validation Types ───────────────────────────────────────────────
// Pre-generation classification results from InputValidationService.

export type InputValidationResult =
  | { classification: "match"; confidence: number; inferredCategory?: string }
  | {
      classification: "auto-fix";
      confidence: number;
      correctedProductName: string;
      reason: string;
      inferredCategory?: string;
    }
  | {
      classification: "conflict";
      confidence: number;
      suggestedProductName?: string;
      reason: string;
      inferredCategory?: string;
    }
  | {
      classification: "strong_conflict";
      confidence: number;
      suggestedProductName?: string;
      reason: string;
      inferredCategory?: string;
    }
  | {
      classification: "low-confidence";
      confidence: number;
      reason: string;
      inferredCategory?: string;
    };

// ─── Generation Progress Types ────────────────────────────────────────────

export type GenerationPhase = "input_validation" | "prompt_assembly" | "image_generation" | "quality_review" | "done";

export type GenerationPhaseStatus = "pending" | "running" | "complete" | "skipped" | "failed";

export interface GenerationPhaseEvent {
  phase: GenerationPhase;
  status: GenerationPhaseStatus;
  message?: string;
  detail?: string;
}

// ─── Image Review Types ───────────────────────────────────────────────────
// Post-generation quality review results from ImageReviewService.

export interface ReviewIssue {
  type: string;
  severity: "critical" | "minor";
  description: string;
}

export interface ValidationContext {
  inputCorrection?: {
    field: "productName";
    from: string;
    to: string;
    reason: string;
  };
  allowedConflicts?: Array<{
    type: "product_image_conflict" | "product_image_low_confidence";
    userAction: "user_confirmed_continue" | "accepted_suggestion";
  }>;
  overrides?: {
    productImageCheck?: "user_confirmed_continue";
  };
}

export interface ImageReviewResult {
  passed: boolean;
  issues: ReviewIssue[];
  failureType?: "empty_review" | "insufficient_image" | "review_low_confidence" | "generated_product_mismatch";
}

// ─── Error Response Types ─────────────────────────────────────────────────
// Structured error codes for controlled failures.

export type GenerationErrorCode =
  | "no_image_in_response"
  | "empty_review"
  | "insufficient_image"
  | "input_low_confidence"
  | "review_low_confidence"
  | "review_error"
  | "product_image_conflict"
  | "product_image_strong_conflict"
  | "generated_product_mismatch"
  | "provider_error"
  | "provider_auth_error"
  | "provider_timeout"
  | "invalid_data"
  | "global_timeout";

export interface GenerationError {
  phase: string;
  code: GenerationErrorCode;
  message: string;
  detail?: string;
  httpStatus: number;
  retryable: boolean;
  requiresUserAction?: boolean;
}
