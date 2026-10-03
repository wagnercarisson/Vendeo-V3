import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

export const EXCLUSIVO_POLICY_VERSION = "48.2.6-exclusivo-v1";

export const exclusivoPolicy: BenchPromptPolicy = {
  id: "policy.intencao.exclusivo",
  dimension: "intencao",
  value: "exclusivo",
  version: EXCLUSIVO_POLICY_VERSION,
  contributions() {
    return [{
      block: PROMPT_BLOCK_LABELS.commercial,
      lines: ["Exclusivo: valorize a apresentação sem preço. Preserve os selos informados; não invente atributos nem alegações de exclusividade, escassez ou edição limitada."],
    }];
  },
};
