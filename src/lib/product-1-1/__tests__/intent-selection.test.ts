import { describe, expect, it } from "vitest";
import {
  PRODUCT_1_1_INTENT_LABELS,
  PRODUCT_1_1_INTENT_VALUES,
  preserveProductOneToOneIntent,
} from "../intent-selection";

describe("Product 1:1 explicit intent contract", () => {
  it("exposes exactly the three selectable intents and human labels", () => {
    expect(PRODUCT_1_1_INTENT_VALUES).toEqual([
      "offer",
      "spotlight",
      "exclusive",
    ]);
    expect(PRODUCT_1_1_INTENT_LABELS).toEqual({
      offer: "Oferta",
      spotlight: "Destaque",
      exclusive: "Exclusivo",
    });
  });

  it.each(PRODUCT_1_1_INTENT_VALUES)(
    "preserves the explicitly selected intent %s without price inference",
    (intent) => {
      expect(preserveProductOneToOneIntent(intent)).toEqual({ intent });
    },
  );
});
