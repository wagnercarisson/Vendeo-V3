import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

/**
 * Política de formato `1:1` (F48.2.4, D4/D7) — composição **quadrada e
 * equilibrada** em linguagem natural ("quadrado 1:1"), **sem congelar layout** e
 * sem impor posições. Formatos futuros entram como novas políticas; nenhuma regra
 * de formato vive no núcleo.
 */

export const FORMATO_1_1_POLICY_VERSION = "48.2.4-formato-1-1-v1";

export const formato11Policy: BenchPromptPolicy = {
  id: "policy.formato.1-1",
  dimension: "formato",
  value: "1:1",
  version: FORMATO_1_1_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PROMPT_BLOCK_LABELS.intent,
        lines: ["Formato: quadrado 1:1, com composição quadrada e equilibrada (sem congelar o layout)."],
      },
    ];
  },
};
