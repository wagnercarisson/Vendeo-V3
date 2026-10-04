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

export const PRODUTO_POLICY_VERSION = "48.2.6-produto-v3";

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
          "A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.",
          "Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.",
          "Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.",
          "Textos obrigatórios: exiba cada texto integralmente uma única vez.",
        ],
      },
    ];
  },
};
