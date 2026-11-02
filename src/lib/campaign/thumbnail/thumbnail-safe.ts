import {
  generateCampaignThumbnail,
  type ThumbnailContext,
  type ThumbnailResult,
} from "./thumbnail-generator";

function sanitizedErrorCode(error: unknown): string {
  if (error instanceof Error) return error.name || "error";
  return "unknown";
}

/**
 * Único ponto usado pelos call sites de produção.
 *
 * O gerador já tem contrato "nunca lança"; este wrapper é defesa em
 * profundidade: mesmo que o gerador regrida e lance, a miniatura não derruba
 * a campanha, o crédito, a entrega ou a recuperação.
 */
export async function generateCampaignThumbnailSafely(input: {
  originalPath: string;
  originalBuffer: Buffer;
  context: ThumbnailContext | null;
  campaignId?: string;
}): Promise<ThumbnailResult> {
  try {
    const result = await generateCampaignThumbnail(input);

    // Falhas esperadas e desabilitações inesperadas não são silenciosas, mas
    // também não lançam nem alteram a campanha. `ineligible_path` é esperado
    // (ex.: chamada defensiva) e não gera ruído.
    if (result.status === "failed") {
      console.warn("[thumbnail] generation failed", {
        campaignId: input.campaignId ?? null,
        originalPath: input.originalPath,
        reason: result.reason,
      });
    } else if (
      result.status === "skipped" &&
      result.reason !== "ineligible_path"
    ) {
      console.warn("[thumbnail] generation skipped", {
        campaignId: input.campaignId ?? null,
        originalPath: input.originalPath,
        reason: result.reason,
      });
    }

    return result;
  } catch (error) {
    console.warn("[thumbnail] unexpected failure", {
      campaignId: input.campaignId ?? null,
      originalPath: input.originalPath,
      code: sanitizedErrorCode(error),
    });
    return { status: "failed", reason: "thumbnail_unexpected_error" };
  }
}
