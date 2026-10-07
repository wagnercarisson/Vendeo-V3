import { PRODUCT_PROMPT_BLOCK_LABELS, type ProductPromptPolicy } from "./types";

export const EXCLUSIVO_POLICY_VERSION = "48.2.6-exclusivo-v3";

export const exclusivoPolicy: ProductPromptPolicy = {
  id: "policy.intencao.exclusivo",
  dimension: "intencao",
  value: "exclusivo",
  version: EXCLUSIVO_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.commercial,
        lines: [
          "Exclusivo: apresente o produto sem preço em uma composição editorial, sóbria e arejada, com hierarquia discreta e sem chamadas promocionais. Respeite os selos informados sem inventar informações.",
        ],
      },
    ];
  },
};
