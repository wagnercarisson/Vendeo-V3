import { resolveAiCost } from "@/lib/ai-cost/cost-estimator";
import type { CostResolution } from "@/lib/ai-cost/types";

/**
 * Estimativa de custo de **uma** geração do Laboratório de IA (F48.1, D11/D14).
 *
 * Vive obrigatoriamente em `src/lib/ai/**`: o gate de arquitetura restringe
 * `resolveAiCost(` a este prefixo (a definição em `src/lib/ai-cost/cost-estimator.ts`
 * é a única outra exceção). O laboratório não pode chamar o resolvedor de custo
 * de nenhum outro lugar do repositório.
 *
 * O modo é **leitura pura**: nenhum tracker de custo produtivo é acionado,
 * nenhum evento de geração é persistido e nenhum secret é lido. `usage` é
 * deliberadamente **omitido** — isto é uma estimativa de plano (antes da
 * execução), não o consumo real de uma chamada; o consumo real continua sendo
 * calculado pelo `LabTelemetrySink` a partir do envelope da chamada efetiva.
 *
 * `imageGenerationTool: true` + `generationType: "campaign_image"` são o par
 * exigido para que o componente da tool `image_generation` seja considerado
 * (DV-2): sem ambos, o custo da imagem seria silenciosamente omitido.
 */
export async function estimateLabCampaignImageCost(params: {
  provider: "openai" | "gemini";
  model: string;
}): Promise<CostResolution> {
  return resolveAiCost({
    provider: params.provider,
    model: params.model,
    imageGenerationTool: true,
    generationType: "campaign_image",
  });
}
