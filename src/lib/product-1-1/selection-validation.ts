export const ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE =
  "original_background_requires_exactly_one_product_image" as const;

export type OriginalBackgroundValidation =
  | { readonly valid: true; readonly error: null }
  | {
      readonly valid: false;
      readonly error: typeof ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE;
    };

export function validateOriginalBackground(input: {
  readonly productImageCount: number;
}): OriginalBackgroundValidation {
  if (input.productImageCount === 1) {
    return { valid: true, error: null };
  }

  return {
    valid: false,
    error: ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE,
  };
}

/** Identity/reference images are deliberately excluded from the product count. */
export function countProductImages(input: {
  readonly productImages: readonly unknown[];
  readonly identityImages: readonly unknown[];
}): number {
  return input.productImages.length;
}
