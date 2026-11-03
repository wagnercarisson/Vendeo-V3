// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addOutcome,
  buildBackfillKeysetFilter,
  classifyStorageFailure,
  emptyCounters,
  encodeBackfillCursor,
  isEligibleInventoryPath,
  isMissingObjectError,
  isValidBackfillTimestamp,
  parseBackfillCursor,
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
    expect(isEligibleInventoryPath(`${STORE}/${CAMPAIGN}/v3.jpg`, STORE)).toBe(true);
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
      `${STORE}/${CAMPAIGN}/v1.jpg`,
      `${STORE}/${CAMPAIGN}/v4.jpg`,
      `${STORE}/${CAMPAIGN}/v10.jpg`,
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

  it("cursor keyset é único, normalizado e rejeita lixo/offset", () => {
    const cursor = encodeBackfillCursor({
      createdAt: "2026-01-02T03:04:05.000Z",
      campaignId: CAMPAIGN,
    });
    expect(cursor).toBe(`2026-01-02T03:04:05.000Z|${CAMPAIGN}`);
    expect(parseBackfillCursor(cursor)).toEqual({
      createdAt: "2026-01-02T03:04:05.000Z",
      campaignId: CAMPAIGN,
    });

    for (const invalid of [
      null,
      "",
      "42",
      "2026-01-02T03:04:05.000Z",
      `not-a-date|${CAMPAIGN}`,
      "2026-01-02T03:04:05.000Z|not-a-uuid",
    ]) {
      expect(parseBackfillCursor(invalid)).toBeNull();
    }
  });

  it("preserva microssegundos do PostgreSQL (6 casas) sem passar por Date", () => {
    const createdAt = "2026-11-02T12:00:00.123456+00:00";
    const cursor = encodeBackfillCursor({
      createdAt,
      campaignId: CAMPAIGN,
    });

    expect(cursor).toBe(`${createdAt}|${CAMPAIGN}`);
    expect(parseBackfillCursor(cursor)).toEqual({ createdAt, campaignId: CAMPAIGN });
    expect(buildBackfillKeysetFilter({ createdAt, campaignId: CAMPAIGN })).toBe(
      `created_at.gt.${createdAt},and(created_at.eq.${createdAt},id.gt.${CAMPAIGN})`,
    );

    // O timestamp truncado NÃO é aceito como equivalente silencioso.
    expect(
      parseBackfillCursor(`2026-11-02T12:00:00.123Z|${CAMPAIGN}`)?.createdAt,
    ).toBe("2026-11-02T12:00:00.123Z");
  });

  it("valida estritamente o timestamp antes de interpolar no filtro", () => {
    for (const valid of [
      "2026-11-02T12:00:00Z",
      "2026-11-02T12:00:00.1Z",
      "2026-11-02T12:00:00.123456Z",
      "2026-11-02T12:00:00.123456+00:00",
      "2024-02-29T23:59:59.999999-03:00",
    ]) {
      expect(isValidBackfillTimestamp(valid)).toBe(true);
    }

    for (const invalid of [
      "2026-11-02T12:00:00.1234567Z", // 7 casas
      "2026-11-02T12:00:00", // sem timezone
      "2026-02-30T12:00:00Z", // data inexistente
      "2026-13-01T12:00:00Z",
      "2026-11-02T24:00:00Z",
      "2026-11-02T12:60:00Z",
      "2026-11-02T12:00:00+15:00",
      "2026-11-02T12:00:00+14:30",
      "2026-11-02T12:00:00Z|id", // injeção
      "2026-11-02 12:00:00Z",
    ]) {
      expect(isValidBackfillTimestamp(invalid)).toBe(false);
    }

    expect(() =>
      encodeBackfillCursor({
        createdAt: "2026-11-02T12:00:00.1234567Z",
        campaignId: CAMPAIGN,
      }),
    ).toThrow("invalid_cursor_timestamp");
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
