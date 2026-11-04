import {
  PRODUCT_PROMPT_BLOCK_LABELS,
  type ProductPromptPolicy,
} from "@/lib/product-1-1/policies/types";

/**
 * F59 — Política de formato do Produto vertical 9:16.
 *
 * Contribuição única no bloco de intenção (nunca cria rótulo novo), com
 * percentuais como instrução principal e pixels SEMPRE rotulados como
 * referência de entrega 1080 × 1920. Não promete cobertura de plataforma.
 */
export const FORMATO_9_16_POLICY_VERSION = "f59-9-16-v1" as const;

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
          "Formato: vertical 9:16 (história/reels, imagem estática).",
          "O fundo ou a cena devem preencher todo o quadro, de borda a borda, sem letterbox, faixas vazias, molduras ou bordas.",
          "Mantenha o essencial dentro da área protegida: topo 14%, base 35%, laterais 6% e canto inferior direito 30% da largura por 40% da altura.",
          "Se precisar de referência em pixels, use apenas a referência de entrega 1080 × 1920 (topo 269 px, base 672 px, laterais 65 px, canto inferior direito 324 × 768 px); não trate esses números como coordenadas do canvas de geração 1152 × 2048.",
          "Não desenhar guias, marcas de corte ou zonas reservadas visíveis.",
          "A peça deve ser compreensível sozinha, sem depender de legenda externa.",
        ],
      },
    ];
  },
});
