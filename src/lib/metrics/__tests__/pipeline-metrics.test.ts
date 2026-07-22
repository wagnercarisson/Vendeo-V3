import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import {
  getSuccessRate,
  getErrorRate,
  getAvgCost,
  getAvgDuration,
  getCreditsGranted,
  getRefundRate,
  getActiveUsers,
  getVsSuccessRate,
  getVsErrorRate,
  getVsAvgDuration,
  getVsCreditsConsumed,
  getVsRefundRate,
  getVsCreditsRefunded,
} from "../pipeline-metrics";

function selectChain(data: unknown[]) {
  const chain = {
    not: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gte: vi.fn(() => Promise.resolve({ data, count: data.length, error: null })),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: data[0] ?? null, error: null })),
  };
  return chain;
}

function mockSelect(data: unknown[]) {
  const chain = selectChain(data);
  mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));
}

function mockFromImplementation(impl: (table: string) => { select: ReturnType<typeof vi.fn> }) {
  mockFrom.mockImplementation(impl);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSuccessRate", () => {
  it("returns percentage of success events", async () => {
    mockSelect([
      { status: "success" },
      { status: "success" },
      { status: "success" },
      { status: "success" },
      { status: "failed" },
    ]);
    expect(await getSuccessRate(24)).toBe(80);
  });

  it("returns null when no data", async () => {
    mockSelect([]);
    expect(await getSuccessRate(24)).toBeNull();
  });
});

describe("getErrorRate", () => {
  it("returns percentage of failed events", async () => {
    mockSelect([
      { status: "success" },
      { status: "success" },
      { status: "failed" },
    ]);
    expect(await getErrorRate(24)).toBe(33);
  });

  it("returns 0 when no records", async () => {
    mockSelect([]);
    expect(await getErrorRate(24)).toBe(0);
  });
});

describe("getAvgCost", () => {
  it("returns average of estimated_cost_usd", async () => {
    mockSelect([{ estimated_cost_usd: 0.01 }, { estimated_cost_usd: 0.02 }, { estimated_cost_usd: 0.03 }]);
    expect(await getAvgCost(24)).toBeCloseTo(0.02, 2);
  });

  it("returns null when no cost records", async () => {
    mockSelect([]);
    expect(await getAvgCost(24)).toBeNull();
  });
});

describe("getAvgDuration", () => {
  it("returns average duration_ms", async () => {
    mockSelect([{ duration_ms: 10 }, { duration_ms: 20 }, { duration_ms: 30 }]);
    expect(await getAvgDuration(24)).toBe(20);
  });
});

describe("getCreditsGranted", () => {
  it("sums amounts correctly", async () => {
    mockSelect([{ amount: 100 }, { amount: 50 }, { amount: 25 }]);
    expect(await getCreditsGranted(24)).toBe(175);
  });

  it("returns 0 when no data", async () => {
    mockSelect([]);
    expect(await getCreditsGranted(24)).toBe(0);
  });

  it("handles negative amounts gracefully", async () => {
    mockSelect([{ amount: -10 }, { amount: 20 }]);
    expect(await getCreditsGranted(24)).toBe(10);
  });
});

describe("getRefundRate", () => {
  it("ignores VS deductions/refunds completely", async () => {
    mockSelect([
      { id: "c1", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "c2", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "c3", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "c4", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "c5", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "c6", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "c7", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "c8", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "r1", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "c1" },
      { id: "r2", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "c2" },
      { id: "v1", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v2", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v3", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v4", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v5", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "vr1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "v1" },
    ]);
    expect(await getRefundRate(24)).toBe(25);
  });

  it("includes campaign deductions with metadata.feature=campaign_pipeline", async () => {
    mockSelect([
      { id: "d1", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d2", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d3", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d4", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d5", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d6", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d7", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d8", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d9", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d10", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "ref1", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "d1" },
    ]);
    expect(await getRefundRate(24)).toBe(10);
  });

  it("includes legacy campaign deductions (null metadata + campaign_id set)", async () => {
    mockSelect([
      { id: "l1", type: "deduction", amount: 100, campaign_id: "abc-123", metadata: null, reference: null },
      { id: "l2", type: "deduction", amount: 100, campaign_id: "abc-123", metadata: null, reference: null },
      { id: "l3", type: "deduction", amount: 100, campaign_id: "abc-123", metadata: null, reference: null },
      { id: "l4", type: "deduction", amount: 100, campaign_id: "abc-123", metadata: null, reference: null },
      { id: "l5", type: "deduction", amount: 100, campaign_id: "abc-123", metadata: null, reference: null },
      { id: "lr1", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "l1" },
    ]);
    expect(await getRefundRate(24)).toBe(20);
  });

  it("classifies refund via reference inheriting deduction classification", async () => {
    mockSelect([
      { id: "d1", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d2", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d3", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d4", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d5", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d6", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d7", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d8", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d9", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d10", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "v1", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "r1", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "d1" },
      { id: "r2", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "d2" },
      { id: "vr1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "v1" },
    ]);
    expect(await getRefundRate(24)).toBe(20);
  });

  it("excludes anomalies (null metadata + null campaign_id) and orphan refunds", async () => {
    mockSelect([
      { id: "d1", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d2", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d3", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d4", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d5", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d6", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d7", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d8", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d9", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "d10", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "a1", type: "deduction", amount: 99, campaign_id: null, metadata: null, reference: null },
      { id: "a2", type: "deduction", amount: 99, campaign_id: null, metadata: null, reference: null },
      { id: "r1", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "d1" },
      { id: "r2", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "d2" },
      { id: "orphan", type: "refund", amount: -99, campaign_id: null, metadata: null, reference: "nonexistent" },
    ]);
    expect(await getRefundRate(24)).toBe(20);
  });

  it("returns 0 when only VS transactions exist", async () => {
    mockSelect([
      { id: "v1", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v2", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v3", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v4", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v5", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "vr1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "v1" },
    ]);
    expect(await getRefundRate(24)).toBe(0);
  });

  it("returns 0 when empty data", async () => {
    mockSelect([]);
    expect(await getRefundRate(24)).toBe(0);
  });
});

describe("getActiveUsers", () => {
  it("returns count of distinct user_ids", async () => {
    mockSelect([
      { user_id: "a" },
      { user_id: "b" },
      { user_id: "b" },
      { user_id: "c" },
    ]);
    expect(await getActiveUsers(24)).toBe(3);
  });
});

// ─── VS domain ────────────────────────────────────────────────────

describe("getVsSuccessRate", () => {
  it("returns percentage of success events for visual_signature", async () => {
    mockSelect([
      { status: "success" },
      { status: "success" },
      { status: "success" },
      { status: "failed" },
    ]);
    expect(await getVsSuccessRate(24)).toBe(75);
  });

  it("returns null when no data", async () => {
    mockSelect([]);
    expect(await getVsSuccessRate(24)).toBeNull();
  });
});

describe("getVsErrorRate", () => {
  it("returns percentage of failed events for visual_signature", async () => {
    mockSelect([
      { status: "success" },
      { status: "failed" },
      { status: "failed" },
    ]);
    expect(await getVsErrorRate(24)).toBe(67);
  });

  it("returns 0 when no data", async () => {
    mockSelect([]);
    expect(await getVsErrorRate(24)).toBe(0);
  });
});

describe("getVsAvgDuration", () => {
  it("returns average duration for visual_signature events", async () => {
    mockSelect([
      { duration_ms: 5000 },
      { duration_ms: 15000 },
      { duration_ms: 25000 },
    ]);
    expect(await getVsAvgDuration(24)).toBe(15000);
  });

  it("returns null when no data", async () => {
    mockSelect([]);
    expect(await getVsAvgDuration(24)).toBeNull();
  });
});

describe("getVsCreditsConsumed", () => {
  it("sums ABS(amount) for deduction with feature=visual_signature", async () => {
    mockSelect([
      { amount: -1 },
      { amount: -1 },
      { amount: -1 },
    ]);
    expect(await getVsCreditsConsumed(24)).toBe(3);
  });

  it("returns 0 when no data", async () => {
    mockSelect([]);
    expect(await getVsCreditsConsumed(24)).toBe(0);
  });
});

describe("getVsCreditsRefunded", () => {
  it("sums ABS(amount) for refund with metadata.feature=visual_signature", async () => {
    mockSelect([
      { id: "r1", type: "refund", amount: -1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "r2", type: "refund", amount: -2, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
    ]);
    expect(await getVsCreditsRefunded(24)).toBe(3);
  });

  it("classifies refund via reference chain when no VS metadata on refund", async () => {
    // Refund r1 has reference to deduction d1 which has feature="visual_signature"
    // This simulates cross-window: deduction is outside window, refund inside
    const callLog: string[][] = [];
    mockFromImplementation((table: string) => ({
      select: vi.fn(() => {
        const chain = {
          eq: vi.fn(() => chain),
          gte: vi.fn(() => Promise.resolve({
            data: [
              { id: "r1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "d1" },
            ],
            count: 1,
            error: null,
          })),
          in: vi.fn(() => Promise.resolve({
            data: [
              { id: "d1", type: "deduction", amount: -1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
            ],
            error: null,
          })),
          not: vi.fn(() => chain),
          is: vi.fn(() => chain),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
        return chain;
      }),
    }));
    expect(await getVsCreditsRefunded(24)).toBe(1);
  });

  it("returns 0 when no data", async () => {
    mockSelect([]);
    expect(await getVsCreditsRefunded(24)).toBe(0);
  });
});

describe("getVsRefundRate", () => {
  it("returns rate within VS domain (ignores campaign deductions)", async () => {
    mockSelect([
      { id: "v1", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v2", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v3", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "v4", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
      { id: "camp1", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
      { id: "vr1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "v1" },
      { id: "vr2", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "v2" },
    ]);
    expect(await getVsRefundRate(24)).toBe(50);
  });

  it("returns 0 when denominator=0 (no VS deductions)", async () => {
    mockSelect([
      { id: "vr1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "v1" },
    ]);
    expect(await getVsRefundRate(24)).toBe(0);
  });

  it("returns 0 when empty data", async () => {
    mockSelect([]);
    expect(await getVsRefundRate(24)).toBe(0);
  });
});

describe("domain isolation", () => {
  it("VS-only data returns null/0 for campaign metrics", async () => {
    mockSelect([]);
    expect(await getSuccessRate(24)).toBeNull();
    expect(await getErrorRate(24)).toBe(0);
    expect(await getAvgCost(24)).toBeNull();
    expect(await getAvgDuration(24)).toBeNull();
  });

  it("campaign-only data returns null/0 for VS metrics", async () => {
    mockSelect([]);
    expect(await getVsSuccessRate(24)).toBeNull();
    expect(await getVsErrorRate(24)).toBe(0);
    expect(await getVsAvgDuration(24)).toBeNull();
    expect(await getVsCreditsConsumed(24)).toBe(0);
    expect(await getVsCreditsRefunded(24)).toBe(0);
  });
});

describe("cross-window refund reference", () => {
  it("refund inside window referencing campaign deduction outside window is counted in getRefundRate", async () => {
    mockFromImplementation((table: string) => ({
      select: vi.fn(() => {
        const chain = {
          eq: vi.fn(() => chain),
          gte: vi.fn(() => {
            return Promise.resolve({
              data: [
                { id: "d1", type: "deduction", amount: 100, campaign_id: "c1", metadata: null, reference: null },
                { id: "d2", type: "deduction", amount: 100, campaign_id: "c2", metadata: null, reference: null },
                { id: "d3", type: "deduction", amount: 100, campaign_id: "c3", metadata: null, reference: null },
                { id: "d4", type: "deduction", amount: 100, campaign_id: "c4", metadata: null, reference: null },
                { id: "d5", type: "deduction", amount: 100, campaign_id: "c5", metadata: null, reference: null },
                { id: "outsideRefund", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "legacyDeduction" },
              ],
              error: null,
            });
          }),
          in: vi.fn(() => {
            return Promise.resolve({
              data: [
                { id: "legacyDeduction", type: "deduction", amount: 100, campaign_id: "abc-123", metadata: null, reference: null },
              ],
              error: null,
            });
          }),
          not: vi.fn(() => chain),
          is: vi.fn(() => chain),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
        return chain;
      }),
    }));
    // 5 campaign deductions in-window (legacy, with campaign_id set)
    // 1 refund referencing outside deduction — resolved via second query
    // deductionCount in window = 5, refundCount = 1
    expect(await getRefundRate(24)).toBe(20);
  });

  it("refund inside window referencing VS deduction outside window is counted in getVsCreditsRefunded", async () => {
    let callCount = 0;
    mockFromImplementation((table: string) => ({
      select: vi.fn(() => {
        const chain = {
          eq: vi.fn(() => chain),
          gte: vi.fn(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                data: [
                  { id: "r1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "outsideVsDed" },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          }),
          in: vi.fn(() => {
            return Promise.resolve({
              data: [
                { id: "outsideVsDed", type: "deduction", amount: -1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
              ],
              error: null,
            });
          }),
          not: vi.fn(() => chain),
          is: vi.fn(() => chain),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
        return chain;
      }),
    }));
    expect(await getVsCreditsRefunded(24)).toBe(1);
  });

  it("mixed campaign+VS refunds across window boundary are correctly attributed", async () => {
    mockFromImplementation((table: string) => ({
      select: vi.fn(() => {
        const chain = {
          eq: vi.fn(() => chain),
          gte: vi.fn(() => {
            // Every gte call returns the same combined window data
            return Promise.resolve({
              data: [
                { id: "d1", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
                { id: "d2", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
                { id: "v1", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
                { id: "cr1", type: "refund", amount: -100, campaign_id: null, metadata: null, reference: "outsideCampDed" },
                { id: "vr1", type: "refund", amount: -1, campaign_id: null, metadata: null, reference: "outsideVsDed2" },
              ],
              error: null,
            });
          }),
          in: vi.fn(() => {
            // Every in call returns both outside deductions
            return Promise.resolve({
              data: [
                { id: "outsideCampDed", type: "deduction", amount: 100, campaign_id: null, metadata: { feature: "campaign_pipeline" }, reference: null },
                { id: "outsideVsDed2", type: "deduction", amount: 1, campaign_id: null, metadata: { feature: "visual_signature" }, reference: null },
              ],
              error: null,
            });
          }),
          not: vi.fn(() => chain),
          is: vi.fn(() => chain),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
        return chain;
      }),
    }));
    // Campaign refund rate: 1 outside-resolved refund / 2 in-window campaign deductions = 50%
    expect(await getRefundRate(24)).toBe(50);
    // VS refund rate: 1 outside-resolved refund / 1 in-window VS deduction = 100%
    expect(await getVsRefundRate(24)).toBe(100);
  });
});
