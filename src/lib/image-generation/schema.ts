import { z } from "zod";
import type { CampaignIntent } from "@/lib/campaign/types";
import { MAX_CAMPAIGN_IMAGES } from "@/lib/image-generation/config";

// ─── Generate Image Request ───────────────────────────────────────────────
// Input received from POST /api/campaign/generate-image.
// productImageDataUrl is required — Phase 4.3 product+offer flow requires it.

// ─── Product Image Input ──────────────────────────────────────────────────
// Item do productImages[] (D2/D3/D10). Sem `id` — a rota gera/normaliza (D5).
export const ProductImageInputSchema = z
  .object({
    role: z.enum(["primary", "variation", "combo_item", "reference"]),
    source: z.enum(["upload", "camera"]),
    mimeType: z.string(),
    dataUrl: z.string().min(1), // base64 (transporte); snapshot NUNCA persiste
  })
  .strict();

export const GenerateImageRequestSchema = z.object({
  storeId: z.string().uuid(),
  productName: z.string().min(1),
  originalPriceCents: z.number().int().nonnegative().optional(),
  discountedPriceCents: z.number().int().positive().optional(),
  campaignIntent: z
    .enum(["offer", "spotlight", "exclusive"])
    .optional()
    .default("offer"),
  preserveImageContext: z.boolean().optional(),
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
  productImageDataUrl: z.string().min(1).optional(), // era required (:30) — preservação comportamental (D2)
  productImages: z
    .array(ProductImageInputSchema)
    .min(1)
    .max(MAX_CAMPAIGN_IMAGES)
    .superRefine((imgs, ctx) => {
      const primary = imgs.filter((i) => i.role === "primary").length;
      if (primary !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["productImages"],
          message: `Deve existir exatamente 1 imagem com role "primary" (recebido: ${primary})`,
        });
      }
    })
    .optional(),
  mandatoryArtworkText: z.string().optional(),
  // F43 (D5): override com semântica distinta de user_confirmed_continue.
  // Matriz de semântica:
  // - "brief_review_confirmed"  → revisou o brief e confirmou → pula a IA de visão (fase input_validation = skipped)
  // - "user_confirmed_continue" → 409 + insistiu → pula a IA de visão (fase input_validation = skipped)
  // - (sem override)            → validação IA roda (rede de segurança)
  inputValidationOverride: z
    .object({
      productImageCheck: z
        .union([
          z.literal("user_confirmed_continue"), // 409 + insistiu (comportamento atual)
          z.literal("brief_review_confirmed"), // NOVO — revisou o brief e confirmou (D5)
        ])
        .optional(),
    })
    .optional(),
}).strict();

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

export type ReviewIssueType =
  | "wrong_price"
  | "wrong_product_name"
  | "wrong_store_name"
  | "illegible_text"
  | "invented_information"
  | "deformed_product"
  | "weak_visual_quality"
  | "empty_review"
  | "insufficient_image"
  | "review_low_confidence"
  | "generated_product_mismatch"
  | "product_image_conflict"
  | "product_image_low_confidence"
  | "wrong_cta"
  | "bad_composition"
  | "invented_badge"
  | "distorted_product"
  | "commercial_tone_mismatch";

export interface ReviewIssue {
  type: ReviewIssueType;
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
    productImageCheck?: "user_confirmed_continue" | "brief_review_confirmed";
  };
}

export interface ImageReviewResult {
  passed: boolean;
  issues: ReviewIssue[];
  failureType: "empty_review" | "insufficient_image" | "review_low_confidence" | "generated_product_mismatch" | null;
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
