import type { BenchPromptPolicy } from "./types";

/**
 * Política de tema `nenhum` (F48.2.4, D5/D7) — tema **neutro**: não contribui com
 * nenhuma linha e é **omitido** do prompt. Ainda assim é resolvida/versionada e
 * registrada na evidência.
 */

export const TEMA_NENHUM_POLICY_VERSION = "48.2.4-tema-nenhum-v1";

export const temaNenhumPolicy: BenchPromptPolicy = {
  id: "policy.tema.nenhum",
  dimension: "tema",
  value: "nenhum",
  version: TEMA_NENHUM_POLICY_VERSION,
  contributions() {
    return [];
  },
};
