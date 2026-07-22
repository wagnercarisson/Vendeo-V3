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
} from "../pipeline-metrics";

function mockSelect(data: unknown[]) {
  const chain = {
    not: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gte: vi.fn(() => Promise.resolve({ data, count: data.length, error: null })),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
  };
  mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));
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
