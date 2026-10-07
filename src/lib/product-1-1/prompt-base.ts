export const PROMPT_BASE_VERSION = "48.2.6-produto-1-1-v1";

/** Frozen content from the approved F48.2.6 Product 1:1 prompt base. */
export const PROMPT_BASE_CONTENT =
  "Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.";

export interface ProductPromptBase {
  readonly version: typeof PROMPT_BASE_VERSION;
  readonly content: typeof PROMPT_BASE_CONTENT;
}

export const PRODUCT_1_1_PROMPT_BASE: ProductPromptBase = Object.freeze({
  version: PROMPT_BASE_VERSION,
  content: PROMPT_BASE_CONTENT,
});
