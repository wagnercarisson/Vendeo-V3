// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addOutcome,
  classifyStorageFailure,
  emptyCounters,
  isEligibleInventoryPath,
  isMissingObjectError,
  type BackfillReportItem,
} from "../backfill-selection";

const STORE = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

describe("backfill-selection", () => {
  it("aceita apenas paths canônicos do próprio store", () => {
    expect(isEligibleInventoryPath(`${STORE}/${CAMPAIGN}.jpg`, STORE)).toBe(true);
    expect(isEligibleInventoryPath(`${STORE}/${CAMPAIGN}/v2.jpg`, STORE)).toBe(true);
    expect(
      isEligibleInventoryPath(
        `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.jpg`,
        STORE,
      ),
    ).toBe(true);
    expect(isEligibleInventoryPath(`${STORE}/${CAMPAIGN}.jpg`, OTHER)).toBe(false);
  });

  it("exclui inputs, logos, assinaturas, bench e paths arbitrários", () => {
    for (const path of [
      `${STORE}/${CAMPAIGN}/inputs/${OPERATION}.jpg`,
      `${STORE}/logo.png`,
      `${STORE}/signature.png`,
      `bench/${CAMPAIGN}/inputs/1.jpg`,
      `lab/${CAMPAIGN}.jpg`,
      `${STORE}/${CAMPAIGN}.png`,
    ]) {
      expect(isEligibleInventoryPath(path, STORE)).toBe(false);
    }
  });

  it("distingue ausência provada de erro de acesso", () => {
    expect(
      isMissingObjectError({ statusCode: "404", message: "Object not found" }),
    ).toBe(true);
    expect(
      isMissingObjectError({
        statusCode: "404",
        message: "Object does not exist",
      }),
    ).toBe(true);

    for (const error of [
      { statusCode: "404", message: "Bucket not found" },
      { statusCode: "403", message: "Object not found" },
      { statusCode: "401", message: "Unauthorized" },
      { statusCode: "500", message: "Internal error" },
      new Error("network timeout"),
      null,
    ]) {
      expect(isMissingObjectError(error)).toBe(false);
      expect(classifyStorageFailure(error)).toBe("access_error");
    }
  });

  it("agrega contadores por outcome", () => {
    const counters = emptyCounters();
    const base = {
      campaignId: CAMPAIGN,
      storeId: STORE,
      originalPath: `${STORE}/${CAMPAIGN}.jpg`,
      thumbnailPath: `${STORE}/${CAMPAIGN}.thumb-v1.webp`,
      durationMs: 1,
    };
    const items: BackfillReportItem[] = [
      { ...base, outcome: "would_create" },
      { ...base, outcome: "already_exists" },
      { ...base, outcome: "missing_original" },
      { ...base, outcome: "access_error" },
      { ...base, outcome: "ineligible" },
    ];
    for (const item of items) addOutcome(counters, item);

    expect(counters).toMatchObject({
      seen: 5,
      eligible: 4,
      ineligible: 1,
      wouldCreate: 1,
      alreadyExists: 1,
      missingOriginal: 1,
      accessError: 1,
    });
  });
});
