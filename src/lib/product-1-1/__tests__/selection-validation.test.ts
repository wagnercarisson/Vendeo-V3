import { describe, expect, it } from "vitest";
import {
  countProductImages,
  ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE,
  validateOriginalBackground,
} from "../selection-validation";

describe("Product 1:1 selection validation", () => {
  it("accepts Original with exactly one product image", () => {
    expect(validateOriginalBackground({ productImageCount: 1 })).toEqual({
      valid: true,
      error: null,
    });
  });

  it.each([0, 2, 3])(
    "rejects Original with %i product images as a field error",
    (productImageCount) => {
      expect(validateOriginalBackground({ productImageCount })).toEqual({
        valid: false,
        error: ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE,
      });
    },
  );

  it("does not count store identity images as product images", () => {
    expect(
      countProductImages({
        productImages: [{ id: "product-1" }],
        identityImages: [{ id: "logo" }, { id: "signature" }],
      }),
    ).toBe(1);
    expect(
      validateOriginalBackground({
        productImageCount: countProductImages({
          productImages: [{ id: "product-1" }],
          identityImages: [{ id: "logo" }],
        }),
      }),
    ).toEqual({ valid: true, error: null });
  });

  it("does not allow identity-only images to satisfy Original", () => {
    expect(
      countProductImages({ productImages: [], identityImages: [{ id: "logo" }] }),
    ).toBe(0);
    expect(validateOriginalBackground({ productImageCount: 0 }).valid).toBe(false);
  });
});
