// ─── Image Generation Model ────────────────────────────────────────────────
// Used by OpenAIImageProvider for image generation via Responses API.
export const IMAGE_GENERATION_MODEL =
  process.env.IMAGE_GENERATION_MODEL || "gpt-image-2";

// ─── Vision Review Model ───────────────────────────────────────────────────
// Used by InputValidationService (pre-generation) and ImageReviewService (post-generation).
export const VISION_REVIEW_MODEL =
  process.env.VISION_REVIEW_MODEL || "gpt-4o";

// ─── Image Quality Defaults ────────────────────────────────────────────────
export const IMAGE_GENERATION_QUALITY =
  process.env.IMAGE_GENERATION_QUALITY || "auto";

// ─── Default Image Size ────────────────────────────────────────────────────
export const IMAGE_GENERATION_SIZE = "1024x1024";

// ─── Payload Size Limits ──────────────────────────────────────────────────
// Maximum base64-encoded product image payload size (~4MB).
export const MAX_PRODUCT_IMAGE_BASE64_SIZE = 4 * 1024 * 1024;

// Maximum file size before base64 encoding (~1MB).
export const MAX_PRODUCT_IMAGE_FILE_SIZE = 1 * 1024 * 1024;
