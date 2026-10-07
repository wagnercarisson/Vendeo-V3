export const PRODUCT_1_1_BACKGROUND_LABELS = Object.freeze({
  studio: "Fundo de estúdio",
  ambient: "Cenário ambientado",
  original: "Manter cenário original",
} as const);

export type ProductOneToOneBackgroundDirection =
  keyof typeof PRODUCT_1_1_BACKGROUND_LABELS;

/** Frozen prompt instructions; copied from the validated bench values. */
export const PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS = Object.freeze({
  studio:
    "Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
  ambient:
    "Crie um cenário ambientado coerente com o produto e a marca, sem prejudicar a leitura.",
  original:
    "Mantenha o cenário da imagem enviada como base; não o substitua por outro.",
} as const satisfies Record<ProductOneToOneBackgroundDirection, string>);

export interface ProductOneToOneBackgroundSelection {
  readonly direction: ProductOneToOneBackgroundDirection;
}

export function preserveProductOneToOneBackground(
  direction: ProductOneToOneBackgroundDirection,
): ProductOneToOneBackgroundSelection {
  return Object.freeze({ direction });
}
