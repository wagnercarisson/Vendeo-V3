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
 *
 * v2 (quick 261017-cdi) — fundos RECRIADOS passam a priorizar a identidade da
 * loja: estúdio/ambientado citam a paleta da loja; `original` permanece sem
 * imposição de paleta. As instruções anteriores são SUBSTITUÍDAS (sem acúmulo).
 */
export const PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION =
  "48.2.6-background-direction-v2";

/** Frozen prompt instructions for each background direction. */
export const PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS = Object.freeze({
  studio:
    "Use um fundo de estúdio discreto na paleta da loja, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
  ambient:
    "Crie um cenário coerente com o produto, incorporando a paleta da loja em elementos do ambiente, sem prejudicar a leitura.",
  original:
    "Mantenha o cenário da imagem enviada como base; não substitua o ambiente por outro.",
} as const satisfies Record<ProductOneToOneBackgroundDirection, string>);

/**
 * Direções em que o fundo é RECRIADO (studio/ambient) e, portanto, recebem a
 * orientação comum de contraste. `original` é excluído (preserva o cenário).
 */
export const PRODUCT_1_1_RECREATED_BACKGROUND_DIRECTIONS = Object.freeze([
  "studio",
  "ambient",
] as const satisfies readonly ProductOneToOneBackgroundDirection[]);

export function isRecreatedBackgroundDirection(
  direction: ProductOneToOneBackgroundDirection,
): boolean {
  return (PRODUCT_1_1_RECREATED_BACKGROUND_DIRECTIONS as readonly string[]).includes(
    direction,
  );
}

/**
 * Orientação comum emitida UMA única vez, SOMENTE para fundos recriados
 * (studio/ambient): contraste do produto e legibilidade do logo/assinatura.
 */
export const PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION =
  "Garanta contraste para destacar o produto e manter legível o logo ou a assinatura da loja." as const;

export interface ProductOneToOneBackgroundSelection {
  readonly direction: ProductOneToOneBackgroundDirection;
}

export function preserveProductOneToOneBackground(
  direction: ProductOneToOneBackgroundDirection,
): ProductOneToOneBackgroundSelection {
  return Object.freeze({ direction });
}
