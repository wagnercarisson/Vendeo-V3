export const PRODUCT_1_1_BACKGROUND_LABELS = Object.freeze({
  studio: "Fundo de estúdio",
  ambient: "Cenário ambientado",
  original: "Manter cenário original",
} as const);

export type ProductOneToOneBackgroundDirection =
  keyof typeof PRODUCT_1_1_BACKGROUND_LABELS;

/**
 * Versão do conteúdo de direção de fundo. Incorporada do baseline aprovado do
 * laboratório (quick 261009-u3h) e exposta em `policyVersions.fundo` como
 * evidência — sem schema/migration (mesmo record já persistido).
 */
export const PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION =
  "48.2.6-background-direction-v1";

/** Frozen prompt instructions; copied from the validated bench values. */
export const PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS = Object.freeze({
  studio:
    "Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
  ambient:
    "Crie um cenário ambientado coerente com o produto e a marca, sem prejudicar a leitura.",
  original:
    "Mantenha o cenário da imagem enviada como base; não substitua o ambiente por outro.",
} as const satisfies Record<ProductOneToOneBackgroundDirection, string>);

export interface ProductOneToOneBackgroundSelection {
  readonly direction: ProductOneToOneBackgroundDirection;
}

export function preserveProductOneToOneBackground(
  direction: ProductOneToOneBackgroundDirection,
): ProductOneToOneBackgroundSelection {
  return Object.freeze({ direction });
}
