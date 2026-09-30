import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

/**
 * Política de estrutura `peca-unica` (F48.2.4, D5/D7) — contribui em
 * `[INTENÇÃO E FORMATO]` com "peça única".
 */

export const PECA_UNICA_POLICY_VERSION = "48.2.4-peca-unica-v1";

export const pecaUnicaPolicy: BenchPromptPolicy = {
  id: "policy.estrutura.peca-unica",
  dimension: "estrutura",
  value: "peca-unica",
  version: PECA_UNICA_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PROMPT_BLOCK_LABELS.intent,
        lines: ["Estrutura: peça única."],
      },
    ];
  },
};
