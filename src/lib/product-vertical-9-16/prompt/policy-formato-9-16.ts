import {
  PRODUCT_PROMPT_BLOCK_LABELS,
  type ProductPromptPolicy,
} from "@/lib/product-1-1/policies/types";

/**
 * F59 — Política de formato do Produto vertical 9:16.
 *
 * Contribuição ÚNICA no bloco de intenção (nunca cria rótulo novo). O prompt
 * artístico usa apenas percentuais e a política aprovada; pixels, downscale e
 * observações internas de homologação ficam fora do prompt e continuam
 * disponíveis em `safe-area.ts` para validação técnica.
 */
export const FORMATO_9_16_POLICY_VERSION = "f59-9-16-v2" as const;

export const formato916Policy: ProductPromptPolicy = Object.freeze({
  id: "policy.formato.9-16",
  dimension: "formato",
  value: "9:16",
  version: FORMATO_9_16_POLICY_VERSION,
  contributions() {
    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.intent,
        lines: [
          "A arte é vertical, em proporção 9:16. Preencha todo o canvas com fundo ou ambientação, sem bordas ou faixas vazias.",
          "Reserve para possíveis sobreposições da plataforma: os 14% superiores, os 35% inferiores e os 6% de cada lateral. Reserve também o retângulo do canto inferior direito correspondente a 30% da largura e 40% da altura.",
          "Nessas regiões, mantenha apenas fundo ou elementos não essenciais. Posicione o ativo da loja, todos os textos e as partes essenciais do produto fora dessas regiões.",
          "Não desenhe as áreas reservadas, guias ou marcas de corte.",
          "A peça deve ser compreensível sozinha, sem depender de legenda externa.",
        ],
      },
    ];
  },
});
