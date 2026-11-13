// @vitest-environment node
import { describe, expect, it } from "vitest";
import { newAcquisitionIds, parseAcquisitionIds } from "../acquisition-ids";

const BASE = "11111111-1111-4111-8111-111111111111";
const EXPANSION = "22222222-2222-4222-8222-222222222222";

describe("acquisition ids", () => {
  it("accepts and normalizes distinct UUIDs", () => {
    expect(parseAcquisitionIds({ base: BASE, expansion: EXPANSION })).toEqual({
      ok: true,
      ids: { base: BASE, expansion: EXPANSION },
    });
    expect(
      parseAcquisitionIds({ base: BASE.toUpperCase(), expansion: EXPANSION }),
    ).toEqual({
      ok: true,
      ids: { base: BASE, expansion: EXPANSION },
    });
  });

  it("rejects same id regardless of case and extra keys", () => {
    expect(
      parseAcquisitionIds({ base: BASE, expansion: BASE.toUpperCase() }),
    ).toEqual({ ok: false, reason: "same_id" });
    expect(
      parseAcquisitionIds({ base: BASE, expansion: EXPANSION, extra: true }),
    ).toEqual({ ok: false, reason: "invalid_pair" });
    expect(parseAcquisitionIds(null)).toEqual({ ok: false, reason: "invalid_pair" });
  });

  it("generates a new distinct pair per call", () => {
    const first = newAcquisitionIds();
    const second = newAcquisitionIds();
    expect(first.base).not.toBe(first.expansion);
    expect(second.base).not.toBe(second.expansion);
    expect(first).not.toEqual(second);
  });
});
