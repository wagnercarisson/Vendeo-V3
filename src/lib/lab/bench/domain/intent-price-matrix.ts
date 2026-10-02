import type { CampaignIntent } from "@/lib/campaign/types";
import { availableIntents } from "./intent-options";

export type BenchIntentPriceValidation =
  | { valid: true; error: null }
  | { valid: false; error: "bench_intent_price_incompatible" };

/** Shared intent options with the bench-only invalid isolated-original-price case. */
export function availableBenchIntents(
  originalPriceCents: number | null | undefined,
  discountedPriceCents: number | null | undefined,
): CampaignIntent[] {
  const original = originalPriceCents ?? 0;
  const sale = discountedPriceCents ?? 0;
  if (original > 0 && sale <= 0) return [];
  return availableIntents(original, discountedPriceCents);
}

export function validateBenchIntentPrice(
  originalPriceCents: number | null | undefined,
  discountedPriceCents: number | null | undefined,
  intent: CampaignIntent,
): BenchIntentPriceValidation {
  const valid = availableBenchIntents(originalPriceCents, discountedPriceCents).includes(intent);
  return valid
    ? { valid: true, error: null }
    : { valid: false, error: "bench_intent_price_incompatible" };
}
