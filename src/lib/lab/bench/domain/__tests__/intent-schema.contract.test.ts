import { describe, expect, it } from "vitest";
import { BenchOfferSchema, BenchProductSchema, BenchRunInputSchema } from "../schemas";

const baseRun = {
  operationId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  storeId: "00000000-0000-4000-8000-000000000003",
  presetId: "preset",
  prompt: "prompt",
  references: ["bench/00000000-0000-4000-8000-000000000002/inputs/0.png"],
  confirmed: true as const,
};

describe("bench intent schema domain refinements", () => {
  it.each([
    [{ name: "Produto", originalPriceCents: 1000, priceCents: 500 }, "offer", true],
    [{ name: "Produto", originalPriceCents: 1000, priceCents: 500 }, "spotlight", false],
    [{ name: "Produto", priceCents: 500 }, "offer", true],
    [{ name: "Produto", priceCents: 500 }, "spotlight", true],
    [{ name: "Produto", priceCents: 500 }, "exclusive", false],
    [{ name: "Produto" }, "spotlight", true],
    [{ name: "Produto" }, "exclusive", true],
    [{ name: "Produto" }, "offer", false],
    [{ name: "Produto", originalPriceCents: 1000 }, "offer", false],
  ] as const)("validates %j with %s", (product, campaignIntent, valid) => {
    expect(
      BenchRunInputSchema.safeParse({
        ...baseRun,
        product,
        offer: { campaignIntent },
      }).success,
    ).toBe(valid);
  });

  it("retains incompatible validity values while reporting the domain error", () => {
    const offer = { campaignIntent: "spotlight" as const, validUntil: "2026-10-20" };
    const result = BenchOfferSchema.safeParse(offer);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(offer);

    const run = BenchRunInputSchema.safeParse({
      ...baseRun,
      product: { name: "Produto", priceCents: 500 },
      offer,
    });
    expect(run.success).toBe(false);
    if (!run.success) {
      expect(run.error.issues).toContainEqual(
        expect.objectContaining({ message: "bench_validity_only_allowed_for_offer" }),
      );
    }
    expect(offer.validUntil).toBe("2026-10-20");
  });

  it("preserves validity parsing for Offer and rejects it for Exclusive", () => {
    expect(BenchOfferSchema.safeParse({ campaignIntent: "offer", validUntil: "2026-10-20" }).success).toBe(true);
    const exclusive = BenchRunInputSchema.safeParse({
      ...baseRun,
      product: { name: "Produto" },
      offer: { campaignIntent: "exclusive", validity: "até amanhã" },
    });
    expect(exclusive.success).toBe(false);
    if (!exclusive.success) {
      expect(exclusive.error.issues).toContainEqual(
        expect.objectContaining({ message: "bench_validity_only_allowed_for_offer" }),
      );
    }
  });

  it("keeps product schema structural and fails only on cross-field run validation", () => {
    expect(BenchProductSchema.safeParse({ name: "Produto", originalPriceCents: 1000 }).success).toBe(true);
    const result = BenchRunInputSchema.safeParse({
      ...baseRun,
      product: { name: "Produto", originalPriceCents: 1000 },
      offer: { campaignIntent: "offer" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "bench_intent_price_incompatible" }),
      );
    }
  });
});
