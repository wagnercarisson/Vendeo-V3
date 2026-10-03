import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

export const DESTAQUE_POLICY_VERSION = "48.2.6-destaque-v1";

export const destaquePolicy: BenchPromptPolicy = {
  id: "policy.intencao.destaque",
  dimension: "intencao",
  value: "destaque",
  version: DESTAQUE_POLICY_VERSION,
  contributions() {
    return [{
      block: PROMPT_BLOCK_LABELS.commercial,
      lines: ["Destaque: priorize a apresentação do produto; preço informado é secundário."],
    }];
  },
};
