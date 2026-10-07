import { PRODUCT_PROMPT_BLOCK_LABELS, type ProductPromptPolicy } from "./types";

export const DESTAQUE_POLICY_VERSION = "48.2.6-destaque-v1";

export const destaquePolicy: ProductPromptPolicy = {
  id: "policy.intencao.destaque",
  dimension: "intencao",
  value: "destaque",
  version: DESTAQUE_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.commercial,
        lines: ["Destaque: priorize a apresentação do produto; preço informado é secundário."],
      },
    ];
  },
};
