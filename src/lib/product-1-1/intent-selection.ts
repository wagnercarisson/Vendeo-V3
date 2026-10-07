import type { CampaignIntent } from "@/lib/campaign/types";

export const PRODUCT_1_1_INTENT_VALUES = Object.freeze([
  "offer",
  "spotlight",
  "exclusive",
] as const satisfies readonly CampaignIntent[]);

export type ProductOneToOneIntent =
  (typeof PRODUCT_1_1_INTENT_VALUES)[number];

export const PRODUCT_1_1_INTENT_LABELS: Readonly<
  Record<ProductOneToOneIntent, string>
> = Object.freeze({
  offer: "Oferta",
  spotlight: "Destaque",
  exclusive: "Exclusivo",
});

/** Explicit selection is carried as chosen; this module never infers by price. */
export interface ProductOneToOneIntentSelection {
  readonly intent: ProductOneToOneIntent;
}

export function preserveProductOneToOneIntent(
  intent: ProductOneToOneIntent,
): ProductOneToOneIntentSelection {
  return Object.freeze({ intent });
}
