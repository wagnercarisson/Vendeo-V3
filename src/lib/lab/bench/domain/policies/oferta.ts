import { PROMPT_BLOCK_LABELS } from "../prompt-composer";
import type { BenchPromptPolicy } from "./types";

/**
 * Política `oferta` (F48.2.4, D3/D7) — orientação **comercial**, sem posições
 * fixas nem coordenadas rígidas.
 *
 * Contribui **somente** em:
 *  - `[CONDIÇÕES COMERCIAIS]` — hierarquia comercial (preço promocional com maior
 *    peso; preço original secundário quando informado; selo/validade/textos
 *    comerciais com hierarquia; leitura imediata; legibilidade; acabamento
 *    comercial; liberdade de arranjo; proibição de inventar preço/desconto/
 *    validade/textos comerciais);
 *  - `[INTENÇÃO E FORMATO]` — a intenção em linguagem natural ("Oferta").
 *
 * **Atribuição exclusiva (D7):** esta política **não** declara nenhuma orientação
 * de produto (elemento principal, fidelidade de aparência/embalagem, uso das
 * referências, proibição de inventar produto/benefícios) — essas pertencem
 * exclusivamente à política `produto`.
 */

export const OFERTA_POLICY_VERSION = "48.2.6-oferta-v1";

export const ofertaPolicy: BenchPromptPolicy = {
  id: "policy.intencao.oferta",
  dimension: "intencao",
  value: "oferta",
  version: OFERTA_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PROMPT_BLOCK_LABELS.commercial,
        lines: ["Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais."],
      },
      {
        block: PROMPT_BLOCK_LABELS.intent,
        lines: [],
      },
    ];
  },
};
