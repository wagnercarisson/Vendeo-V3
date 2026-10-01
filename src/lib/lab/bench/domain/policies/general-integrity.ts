import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptContribution } from "./types";

/** Versão da política geral de integridade linguística (não é dimensão configurável). */
export const GENERAL_INTEGRITY_POLICY_VERSION = "48.2.5-general-integrity-v1";

/**
 * Política geral de texto, aplicada uma vez a toda composição válida.
 *
 * Propriedade limitada a português natural, caracteres/pontuação anômalos e
 * proibição de correção silenciosa. Nome, descrição e textos obrigatórios ficam
 * sob `produto`; preços, datas, selos e condições pertencem a `oferta`.
 */
export const generalIntegrityPolicy = {
  version: GENERAL_INTEGRITY_POLICY_VERSION,
  contributions(): readonly BenchPromptContribution[] {
    return [
      {
        block: PROMPT_BLOCK_LABELS.constraints,
        lines: [
          "Use português correto e natural.",
          "Evite caracteres, símbolos ou pontuação duplicados ou anômalos.",
          "Não corrija silenciosamente os textos de entrada.",
        ],
      },
    ];
  },
};
