import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

/**
 * Política `produto` (F48.2.4, D5/D7) — orientação de **produto**, sem posições
 * fixas nem coordenadas rígidas.
 *
 * Contribui **exclusivamente** em `[PRODUTO E IMAGENS DE REFERÊNCIA]` com:
 * produto como elemento principal; fidelidade de aparência, embalagem e
 * características; uso das imagens/referências do produto; e proibição de
 * inventar produto/benefícios.
 *
 * **Atribuição exclusiva (D7):** esta política **não** declara nenhuma orientação
 * comercial (hierarquia de preço, selo, validade, textos comerciais,
 * legibilidade, invenção de preço/desconto/validade) — essas pertencem
 * exclusivamente à política `oferta`.
 */

export const PRODUTO_POLICY_VERSION = "48.2.4-produto-v1";

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
          "Usar as imagens e referências do produto como base visual, sem inventar elementos.",
          "Não inventar produto, características nem benefícios; usar apenas o que foi informado.",
        ],
      },
    ];
  },
};
