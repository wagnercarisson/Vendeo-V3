// ─── Image Generation Models ───────────────────────────────────────────────
// Mainline model for responses.create() — must support the image_generation tool.
export const IMAGE_GENERATION_RESPONSES_MODEL =
  process.env.IMAGE_GENERATION_RESPONSES_MODEL || "gpt-5.5";

// GPT Image model used by Image API generation/edit fallback.
// Do NOT pass this as the responses.create() model.
export const GPT_IMAGE_MODEL =
  process.env.GPT_IMAGE_MODEL || "gpt-image-2";

// Model used for the Image API edit fallback.
export const IMAGE_EDIT_FALLBACK_MODEL =
  process.env.IMAGE_EDIT_FALLBACK_MODEL || GPT_IMAGE_MODEL;

// ─── Vision Review Model ───────────────────────────────────────────────────
export const VISION_REVIEW_MODEL =
  process.env.VISION_REVIEW_MODEL || "gpt-4o";

// ─── Image Quality Defaults ────────────────────────────────────────────────
export const IMAGE_GENERATION_QUALITY =
  process.env.IMAGE_GENERATION_QUALITY || "auto";

// ─── Default Image Size ────────────────────────────────────────────────────
export const IMAGE_GENERATION_SIZE = "1024x1024";

// ─── Payload Size Limits ──────────────────────────────────────────────────
export const MAX_PRODUCT_IMAGE_BASE64_SIZE = 4 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_FILE_SIZE = 1 * 1024 * 1024;

// ─── Global Timeout ───────────────────────────────────────────────────────
export const IMAGE_GENERATION_GLOBAL_TIMEOUT_MS =
  Number(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS) || 300000;

// ─── Provider Switch (Phase 4.3.3) ─────────────────────────────────────────
// Supported values: "openai" (default), "gemini" (future)
export const IMAGE_PROVIDER =
  process.env.IMAGE_PROVIDER || "openai";

// ─── Debug / Telemetry ────────────────────────────────────────────────────
export const IMAGE_GENERATION_DEBUG =
  process.env.IMAGE_GENERATION_DEBUG === "true";