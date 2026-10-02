import { describe, expect, it } from "vitest";
import {
  availableBenchIntents,
  validateBenchIntentPrice,
} from "../intent-price-matrix";

describe("intent-price matrix", () => {
  it.each([
    [1000, 500, ["offer"]],
    [0, 500, ["offer", "spotlight"]],
    [0, 0, ["spotlight", "exclusive"]],
    [0, undefined, ["spotlight", "exclusive"]],
    [0, null, ["spotlight", "exclusive"]],
  ] as const)("available options for %s / %s", (original, sale, expected) => {
    expect(availableBenchIntents(original, sale)).toEqual(expected);
  });

  it.each([
    [1000, 500, "offer", true],
    [1000, 500, "spotlight", false],
    [0, 500, "offer", true],
    [0, 500, "spotlight", true],
    [0, 500, "exclusive", false],
    [0, 0, "spotlight", true],
    [0, null, "exclusive", true],
    [1000, 0, "offer", false],
    [1000, undefined, "exclusive", false],
  ] as const)("validates %s / %s / %s", (original, sale, intent, valid) => {
    const result = validateBenchIntentPrice(original, sale, intent);
    expect(result.valid).toBe(valid);
    if (!valid) expect(result.error).toBe("bench_intent_price_incompatible");
  });
});
