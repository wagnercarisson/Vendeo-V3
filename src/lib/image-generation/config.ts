// F46-07 (D5/D8): a escolha de modelo/provider NÃO é configurável por env-var —
// é do registry em código (`src/lib/ai/model-registry.ts`). Restam apenas
// variáveis operacionais (qualidade, tamanho, timeout, debug, limites).

// ─── Image Quality Defaults ────────────────────────────────────────────────
export const IMAGE_GENERATION_QUALITY =
  process.env.IMAGE_GENERATION_QUALITY || "auto";

// ─── Default Image Size ────────────────────────────────────────────────────
export const IMAGE_GENERATION_SIZE = "1024x1024";

// ─── Payload Size Limits ──────────────────────────────────────────────────
export const MAX_PRODUCT_IMAGE_BASE64_SIZE = 4 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_FILE_SIZE = 1 * 1024 * 1024;
export const MAX_CAMPAIGN_IMAGES = 4; // 1 primary + 3 auxiliares (D3/D10)
export const MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE = 8 * 1024 * 1024; // teto agregado do productImages[] (D10)

// ─── Global Timeout ───────────────────────────────────────────────────────
export const IMAGE_GENERATION_GLOBAL_TIMEOUT_MS =
  Number(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS) || 300000;

// ─── Debug / Telemetry ────────────────────────────────────────────────────
export const IMAGE_GENERATION_DEBUG =
  process.env.IMAGE_GENERATION_DEBUG === "true";