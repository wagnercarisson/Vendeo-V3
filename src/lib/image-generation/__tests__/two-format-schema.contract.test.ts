import { describe, expect, it } from "vitest";

import {
  ContinueTwoFormatRequestSchema,
  NewFlowGenerateImageRequestSchema,
} from "../schema";

const BASE = {
  storeId: "11111111-1111-4111-8111-111111111111",
  productName: "Produto",
  campaignId: "22222222-2222-4222-8222-222222222222",
  operationId: "33333333-3333-4333-8333-333333333333",
  backgroundDirection: "studio",
  productImages: [
    {
      role: "primary",
      source: "upload",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,AAAA",
    },
  ],
} as const;

describe("F60.7 C1 — schema conjunto", () => {
  it("aceita o par conjunto exato e preserva 1:1/9:16", () => {
    for (const format of ["1:1", "9:16", "1:1+9:16"]) {
      const result = NewFlowGenerateImageRequestSchema.safeParse({
        ...BASE,
        campaignFormat: format,
      });
      expect(result.success, format).toBe(true);
    }
  });

  it("recusa formatos desconhecidos, listas e campos extras", () => {
    for (const campaignFormat of ["16:9", ["1:1", "9:16"], null, 123]) {
      expect(
        NewFlowGenerateImageRequestSchema.safeParse({
          ...BASE,
          campaignFormat,
        }).success,
      ).toBe(false);
    }
    expect(
      NewFlowGenerateImageRequestSchema.safeParse({
        ...BASE,
        campaignFormat: "1:1+9:16",
        squareDeliveryId: "44444444-4444-4444-8444-444444444444",
      }).success,
    ).toBe(false);
  });

  it("continuidade conjunta é estrita e usa requestId", () => {
    const operationId = "22222222-2222-4222-8222-222222222222";
    const requestId = "55555555-5555-4555-8555-555555555555";
    expect(
      ContinueTwoFormatRequestSchema.safeParse({ operationId, requestId }).success,
    ).toBe(true);
    expect(
      ContinueTwoFormatRequestSchema.safeParse({
        operationId,
        requestId,
        campaignFormat: "1:1+9:16",
      }).success,
    ).toBe(false);
    expect(
      ContinueTwoFormatRequestSchema.safeParse({
        operationId,
        requestIds: { base: requestId, expansion: requestId },
      }).success,
    ).toBe(false);
  });
});
