import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPolicyContext, BenchPromptPolicy } from "./types";

/**
 * Política `produto` (F48.2.5, D1/D1a/D4) — orientação de **produto**, sem posições
 * fixas nem coordenadas rígidas.
 *
 * Contribui **exclusivamente** em `[PRODUTO E IMAGENS DE REFERÊNCIA]` com:
 * instruções de nome e imagem conforme referências, descrição semanticamente
 * fiel e textos obrigatórios literais; sem invenção de produto.
 *
 * **Atribuição exclusiva (D7):** esta política **não** declara nenhuma orientação
 * comercial (hierarquia de preço, selo, validade, textos comerciais,
 * legibilidade, invenção de preço/desconto/validade) — essas pertencem
 * exclusivamente à política `oferta`.
 */

export const PRODUTO_POLICY_VERSION = "48.2.6-produto-v4";

const SINGLE_IMAGE_INSTRUCTION = "Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.";
const MULTI_IMAGE_HIERARCHY = "A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.";
const IMAGE_FIDELITY_INSTRUCTION = "Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.";

export const produtoPolicy: BenchPromptPolicy = {
  id: "policy.tipoConteudo.produto",
  dimension: "tipoConteudo",
  value: "produto",
  version: PRODUTO_POLICY_VERSION,
  contributions(context: BenchPolicyContext) {
    const referenceCount = context.references?.length ?? 0;
    const imageInstructions = referenceCount === 1
      ? [SINGLE_IMAGE_INSTRUCTION]
      : referenceCount > 1
        ? [MULTI_IMAGE_HIERARCHY, IMAGE_FIDELITY_INSTRUCTION]
        : ["Produto como elemento principal da peça."];

    return [
      {
        block: PROMPT_BLOCK_LABELS.product,
        lines: [
          ...imageInstructions,
          "Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.",
          "Textos obrigatórios: exiba cada texto integralmente uma única vez.",
        ],
      },
    ];
  },
};
