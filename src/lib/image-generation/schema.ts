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
  originalPriceCents: z.number().int().positive(),
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
  | { classification: "match"; confidence: number }
  | {
      classification: "auto-fix";
      confidence: number;
      correctedProductName: string;
      reason: string;
    }
  | {
      classification: "conflict";
      confidence: number;
      suggestedProductName?: string;
      reason: string;
    }
  | {
      classification: "low-confidence";
      confidence: number;
      reason: string;
    };

// ─── Image Review Types ───────────────────────────────────────────────────
// Post-generation quality review results from ImageReviewService.

export interface ReviewIssue {
  type: string;
  severity: "critical" | "minor";
  description: string;
}

export interface ImageReviewResult {
  passed: boolean;
  issues: ReviewIssue[];
}

// ─── Error Response Types ─────────────────────────────────────────────────
// Structured error codes for controlled failures.

export type ImageGenerationErrorCode =
  | "payload_too_large"
  | "provider_failure"
  | "invalid_output"
  | "review_failed";

export interface ImageGenerationError {
  code: ImageGenerationErrorCode;
  message: string;
  details?: string;
}
