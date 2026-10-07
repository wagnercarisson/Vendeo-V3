import { PRODUCT_PROMPT_BLOCK_LABELS, type ProductPromptPolicy } from "./types";

export const FORMATO_1_1_POLICY_VERSION = "48.2.4-formato-1-1-v1";

export const formato11Policy: ProductPromptPolicy = {
  id: "policy.formato.1-1",
  dimension: "formato",
  value: "1:1",
  version: FORMATO_1_1_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.intent,
        lines: [
          "Formato: quadrado 1:1, com composição quadrada e equilibrada (sem congelar o layout).",
        ],
      },
    ];
  },
};
