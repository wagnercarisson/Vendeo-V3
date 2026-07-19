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
  };
  mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));
}

function mockCount(count: number) {
  const chain = {
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gte: vi.fn(() => Promise.resolve({ data: null, count, error: null })),
    not: vi.fn(() => chain),
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
  it("returns count of grant transactions", async () => {
    mockCount(15);
    expect(await getCreditsGranted(24)).toBe(15);
  });
});

describe("getRefundRate", () => {
  it("returns refund percentage over non-grant transactions", async () => {
    mockSelect([
      { type: "refund" },
      { type: "refund" },
      { type: "deduction" },
      { type: "deduction" },
      { type: "deduction" },
      { type: "deduction" },
      { type: "deduction" },
      { type: "deduction" },
      { type: "deduction" },
      { type: "deduction" },
    ]);
    expect(await getRefundRate(24)).toBe(20);
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
