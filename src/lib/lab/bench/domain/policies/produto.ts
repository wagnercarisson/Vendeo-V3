import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

/**
 * Política `produto` (F48.2.5, D1/D1a/D4) — orientação de **produto**, sem posições
 * fixas nem coordenadas rígidas.
 *
 * Contribui **exclusivamente** em `[PRODUTO E IMAGENS DE REFERÊNCIA]` com:
 * produto como elemento principal; fidelidade de aparência, embalagem e
 * características; papéis de imagens; nome integral/literal, descrição
 * semanticamente fiel e textos obrigatórios literais; sem invenção de produto.
 *
 * **Atribuição exclusiva (D7):** esta política **não** declara nenhuma orientação
 * comercial (hierarquia de preço, selo, validade, textos comerciais,
 * legibilidade, invenção de preço/desconto/validade) — essas pertencem
 * exclusivamente à política `oferta`.
 */

export const PRODUTO_POLICY_VERSION = "48.2.5-produto-v3";

export const produtoPolicy: BenchPromptPolicy = {
  id: "policy.tipoConteudo.produto",
  dimension: "tipoConteudo",
  value: "produto",
  version: PRODUTO_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PROMPT_BLOCK_LABELS.product,
        lines: [
          "Produto como elemento principal da peça.",
          "Reproduzir com fidelidade a aparência, a embalagem e as características do produto.",
          "Use a imagem principal como representação obrigatória e protagonista do produto. As imagens adicionais são referências auxiliares do mesmo produto; utilize-as quando contribuírem para fidelidade ou composição, sem duplicar o produto nem competir com a imagem principal.",
          "Usar as imagens e referências do produto como base visual, sem inventar elementos.",
          "Exiba o nome do produto inteiro e exatamente como informado e aprovado; não abrevie, omita, parafraseie nem corrija silenciosamente.",
          "Use a descrição como complemento. Pode selecionar, resumir ou adaptar a redação, preservando contexto e significado; não invente características, benefícios, condições ou usos.",
          "Reproduza literalmente as informações explicitamente obrigatórias na arte.",
          "Não represente nem invente outro produto além do informado.",
        ],
      },
    ];
  },
};
