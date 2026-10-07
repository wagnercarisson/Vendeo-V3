import { PRODUCT_PROMPT_BLOCK_LABELS, type ProductPromptPolicy } from "./types";

export const PRODUTO_POLICY_VERSION = "48.2.6-produto-v4";

const SINGLE_IMAGE_INSTRUCTION =
  "Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.";
const MULTI_IMAGE_HIERARCHY =
  "A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.";
const IMAGE_FIDELITY_INSTRUCTION =
  "Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.";

export const produtoPolicy: ProductPromptPolicy = {
  id: "policy.tipoConteudo.produto",
  dimension: "tipoConteudo",
  value: "produto",
  version: PRODUTO_POLICY_VERSION,
  contributions(context) {
    const referenceCount = context.references?.length ?? 0;
    const imageInstructions =
      referenceCount === 1
        ? [SINGLE_IMAGE_INSTRUCTION]
        : referenceCount > 1
          ? [MULTI_IMAGE_HIERARCHY, IMAGE_FIDELITY_INSTRUCTION]
          : ["Produto como elemento principal da peça."];

    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.product,
        lines: [
          ...imageInstructions,
          "Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.",
          "Textos obrigatórios: exiba cada texto integralmente uma única vez.",
        ],
      },
    ];
  },
};
