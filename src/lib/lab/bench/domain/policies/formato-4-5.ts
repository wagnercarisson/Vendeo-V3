import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

/**
 * Política de formato `4:5` (quick 261107-qvo) — composição **vertical e
 * equilibrada**, em linguagem natural, sem congelar layout e sem impor
 * posições. O tamanho efetivo (`1152x1440`) e a validação ficam no resolvedor
 * interno `bench-format.ts`.
 */

export const FORMATO_4_5_POLICY_VERSION = "261107-formato-4-5-v1";

export const formato45Policy: BenchPromptPolicy = {
  id: "policy.formato.4-5",
  dimension: "formato",
  value: "4:5",
  version: FORMATO_4_5_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PROMPT_BLOCK_LABELS.intent,
        lines: [
          "Formato: vertical 4:5, com composição vertical e equilibrada (sem congelar o layout).",
        ],
      },
    ];
  },
};
