import {
  PRODUCT_PROMPT_BLOCK_LABELS,
  type PromptPolicyContribution,
} from "./types";

export const GENERAL_INTEGRITY_POLICY_VERSION =
  "48.2.5-general-integrity-v1";

export const PRODUCT_1_1_GENERAL_INTEGRITY_LINES = Object.freeze([
  "Use português correto e natural.",
  "Evite caracteres, símbolos ou pontuação duplicados ou anômalos.",
  "Não corrija silenciosamente os textos de entrada.",
] as const);

export const productOneToOneGeneralIntegrityPolicy = Object.freeze({
  version: GENERAL_INTEGRITY_POLICY_VERSION,
  contributions(): readonly PromptPolicyContribution[] {
    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.constraints,
        lines: PRODUCT_1_1_GENERAL_INTEGRITY_LINES,
      },
    ];
  },
});
