import type { CampaignIntent } from "@/lib/campaign/types";

/** Pure bench authority for intent inference/options; mirrors the production hook. */
export function inferIntent(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null,
): CampaignIntent {
  const hasOriginal = originalPriceCents > 0;
  const hasDiscounted = (discountedPriceCents ?? 0) > 0;
  if (hasOriginal && hasDiscounted) return "offer";
  if (hasDiscounted) return "spotlight";
  return "exclusive";
}

export function availableIntents(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null,
): CampaignIntent[] {
  const inferred = inferIntent(originalPriceCents, discountedPriceCents);
  if (inferred === "offer") return ["offer"];
  if ((discountedPriceCents ?? 0) > 0) return ["offer", "spotlight"];
  return ["spotlight", "exclusive"];
}
