import { PRODUCT_PROMPT_BLOCK_LABELS, type ProductPromptPolicy } from "./types";

export const OFERTA_POLICY_VERSION = "48.2.6-oferta-v1";

export const ofertaPolicy: ProductPromptPolicy = {
  id: "policy.intencao.oferta",
  dimension: "intencao",
  value: "oferta",
  version: OFERTA_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.commercial,
        lines: [
          "Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.",
        ],
      },
      { block: PRODUCT_PROMPT_BLOCK_LABELS.intent, lines: [] },
    ];
  },
};
