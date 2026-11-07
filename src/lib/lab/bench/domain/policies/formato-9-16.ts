import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

/**
 * Política de formato `9:16` (quick 261107-hcx) — composição **vertical e
 * equilibrada** em linguagem natural, sem congelar layout e sem impor posições.
 *
 * O `1:1` permanece na política existente (`formato-1-1.ts`), byte a byte. O
 * tamanho efetivo (`1152x2048`) e a validação dimensional vivem no resolvedor
 * interno `bench-format.ts`, não no texto do prompt.
 */

export const FORMATO_9_16_POLICY_VERSION = "261107-formato-9-16-v1";

export const formato916Policy: BenchPromptPolicy = {
  id: "policy.formato.9-16",
  dimension: "formato",
  value: "9:16",
  version: FORMATO_9_16_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PROMPT_BLOCK_LABELS.intent,
        lines: [
          "Formato: vertical 9:16, com composição vertical e equilibrada (sem congelar o layout).",
        ],
      },
    ];
  },
};
