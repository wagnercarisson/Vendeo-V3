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
    return await generateCampaignThumbnail(input);
  } catch (error) {
    console.warn("[thumbnail] unexpected failure", {
      campaignId: input.campaignId ?? null,
      originalPath: input.originalPath,
      code: sanitizedErrorCode(error),
    });
    return { status: "failed", reason: "thumbnail_unexpected_error" };
  }
}
