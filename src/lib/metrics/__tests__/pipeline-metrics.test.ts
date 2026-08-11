import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc, from: vi.fn() },
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
  clearMetricsCache,
  type MetricsBundle,
} from "../pipeline-metrics";

const PRODUCTION_BUNDLE: MetricsBundle = {
  pipeline: { total: 10, success: 8, error: 2, avg_duration_ms: 12000, active_users: 5 },
  vs: { success_rate: 75, error_rate: 25, avg_duration_ms: 15000 },
  wallet: {
    credits_granted: 500, credits_consumed_vs: 20, refund_rate: 10,
    vs_credits_consumed: 20, vs_credits_refunded: 2, vs_refund_rate: 10,
    credits_consumed: 20, credits_refunded_campaign: 1,
  },
};

const TEST_BUNDLE: MetricsBundle = {
  pipeline: { total: 3, success: 2, error: 1, avg_duration_ms: 8000, active_users: 2 },
  vs: { success_rate: 67, error_rate: 33, avg_duration_ms: 10000 },
  wallet: {
    credits_granted: 100, credits_consumed_vs: 5, refund_rate: 0,
    vs_credits_consumed: 5, vs_credits_refunded: 0, vs_refund_rate: 0,
    credits_consumed: 5, credits_refunded_campaign: 0,
  },
};

const ALL_BUNDLE: MetricsBundle = {
  pipeline: { total: 13, success: 10, error: 3, avg_duration_ms: 11000, active_users: 7 },
  vs: { success_rate: 73, error_rate: 27, avg_duration_ms: 14000 },
  wallet: {
    credits_granted: 600, credits_consumed_vs: 25, refund_rate: 8,
    vs_credits_consumed: 25, vs_credits_refunded: 2, vs_refund_rate: 8,
    credits_consumed: 25, credits_refunded_campaign: 1,
  },
};

function mockBundle(bundle: typeof PRODUCTION_BUNDLE) {
  mockRpc.mockImplementation((rpcName: string) =>
    Promise.resolve(
      rpcName === "admin_get_ai_costs"
        ? {
            data: { by_operation_run: [], by_generation_type: [], reconciliation: [] },
            error: null,
          }
        : { data: bundle, error: null },
    ),
  );
}

/** Mock do RPC admin_get_ai_costs (apuração call-level F38.1) com runs controlados. */
function mockAiCosts(
  byOperationRun: Array<Record<string, unknown>>,
  bundle: typeof PRODUCTION_BUNDLE = PRODUCTION_BUNDLE,
) {
  mockRpc.mockImplementation((rpcName: string) =>
    Promise.resolve(
      rpcName === "admin_get_ai_costs"
        ? {
            data: { by_operation_run: byOperationRun, by_generation_type: [], reconciliation: [] },
            error: null,
          }
        : { data: bundle, error: null },
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  clearMetricsCache();
});

// ─── Existing tests (adapted) ──────────────────────────────────────

describe("getSuccessRate", () => {
  it("returns percentage of success events", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getSuccessRate(24)).toBe(80);
  });

  it("returns null when no data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, pipeline: { ...PRODUCTION_BUNDLE.pipeline, total: 0, success: 0, error: 0 } };
    mockBundle(empty);
    expect(await getSuccessRate(24)).toBeNull();
  });
});

describe("getErrorRate", () => {
  it("returns percentage of failed events", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getErrorRate(24)).toBe(20);
  });

  it("returns 0 when no records", async () => {
    const empty = { ...PRODUCTION_BUNDLE, pipeline: { ...PRODUCTION_BUNDLE.pipeline, total: 0, success: 0, error: 0 } };
    mockBundle(empty);
    expect(await getErrorRate(24)).toBe(0);
  });
});

describe("getAvgCost (F38.2 D6 — apuração call-level por entrega)", () => {
  it("calculates the average cost per delivery from admin_get_ai_costs by_operation_run", async () => {
    mockAiCosts([
      { operation_run_id: "r1", custo_usd_total: "10" },
      { operation_run_id: "r2", custo_usd_total: "20" },
    ]);
    expect(await getAvgCost(24)).toBeCloseTo(15, 3);
    expect(mockRpc).toHaveBeenCalledWith("admin_get_ai_costs", {
      p_hours: 24,
      p_credit_unit_usd_value: null,
    });
  });

  it("does NOT read campaign_pipeline.estimated_cost_usd (bundle avg_cost_ms) — even when non-null", async () => {
    // admin_get_metrics devolve avg_cost_ms não-nulo (legado F28), mas getAvgCost
    // apura via call-level e ignora o campo do delivery marker (NULL por desenho).
    const bundleWithLegacyCost = {
      ...PRODUCTION_BUNDLE,
      pipeline: { ...PRODUCTION_BUNDLE.pipeline, avg_cost_ms: 0.5 },
    } as unknown as MetricsBundle;
    mockAiCosts(
      [{ operation_run_id: "r1", custo_usd_total: "10" }],
      bundleWithLegacyCost,
    );
    expect(await getAvgCost(24)).toBeCloseTo(10, 3);
  });

  it("returns null when there are no cost rows (by_operation_run [])", async () => {
    mockAiCosts([]);
    expect(await getAvgCost(24)).toBeNull();
  });

  it("returns null when the RPC fails (soft degradation)", async () => {
    mockRpc.mockRejectedValue(new Error("down"));
    expect(await getAvgCost(24)).toBeNull();
  });
});

describe("getAvgDuration", () => {
  it("returns average duration_ms", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getAvgDuration(24)).toBe(12000);
  });
});

describe("getCreditsGranted", () => {
  it("sums amounts correctly", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getCreditsGranted(24)).toBe(500);
  });

  it("returns 0 when no data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, wallet: { ...PRODUCTION_BUNDLE.wallet, credits_granted: 0 } };
    mockBundle(empty);
    expect(await getCreditsGranted(24)).toBe(0);
  });
});

describe("getRefundRate", () => {
  it("returns refund rate from bundle", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getRefundRate(24)).toBe(10);
  });

  it("returns 0 when empty data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, wallet: { ...PRODUCTION_BUNDLE.wallet, refund_rate: 0 } };
    mockBundle(empty);
    expect(await getRefundRate(24)).toBe(0);
  });
});

describe("getActiveUsers", () => {
  it("returns count of distinct user_ids", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getActiveUsers(24)).toBe(5);
  });
});

// ─── VS domain ────────────────────────────────────────────────────

describe("getVsSuccessRate", () => {
  it("returns percentage of success events for visual_signature", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getVsSuccessRate(24)).toBe(75);
  });

  it("returns null when no data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, vs: { ...PRODUCTION_BUNDLE.vs, success_rate: null } };
    mockBundle(empty);
    expect(await getVsSuccessRate(24)).toBeNull();
  });
});

describe("getVsErrorRate", () => {
  it("returns percentage of failed events for visual_signature", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getVsErrorRate(24)).toBe(25);
  });

  it("returns 0 when no data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, vs: { ...PRODUCTION_BUNDLE.vs, error_rate: 0 } };
    mockBundle(empty);
    expect(await getVsErrorRate(24)).toBe(0);
  });
});

describe("getVsAvgDuration", () => {
  it("returns average duration for visual_signature events", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getVsAvgDuration(24)).toBe(15000);
  });

  it("returns null when no data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, vs: { ...PRODUCTION_BUNDLE.vs, avg_duration_ms: null } };
    mockBundle(empty);
    expect(await getVsAvgDuration(24)).toBeNull();
  });
});

describe("getVsCreditsConsumed", () => {
  it("sums ABS(amount) for deduction with feature=visual_signature", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getVsCreditsConsumed(24)).toBe(20);
  });

  it("returns 0 when no data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, wallet: { ...PRODUCTION_BUNDLE.wallet, vs_credits_consumed: 0 } };
    mockBundle(empty);
    expect(await getVsCreditsConsumed(24)).toBe(0);
  });
});

describe("getVsCreditsRefunded", () => {
  it("returns total refunded from bundle", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getVsCreditsRefunded(24)).toBe(2);
  });

  it("returns 0 when no data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, wallet: { ...PRODUCTION_BUNDLE.wallet, vs_credits_refunded: 0 } };
    mockBundle(empty);
    expect(await getVsCreditsRefunded(24)).toBe(0);
  });
});

describe("getVsRefundRate", () => {
  it("returns rate within VS domain (ignores campaign deductions)", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    expect(await getVsRefundRate(24)).toBe(10);
  });

  it("returns 0 when denominator=0 (no VS deductions)", async () => {
    const empty = { ...PRODUCTION_BUNDLE, wallet: { ...PRODUCTION_BUNDLE.wallet, vs_refund_rate: 0 } };
    mockBundle(empty);
    expect(await getVsRefundRate(24)).toBe(0);
  });

  it("returns 0 when empty data", async () => {
    const empty = { ...PRODUCTION_BUNDLE, wallet: { ...PRODUCTION_BUNDLE.wallet, vs_refund_rate: 0 } };
    mockBundle(empty);
    expect(await getVsRefundRate(24)).toBe(0);
  });
});

// ─── Test Store Filtering ──────────────────────────────────────────

describe("test store filtering (storeKind)", () => {
  it("getSuccessRate excludes test stores (default is production)", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    const result = await getSuccessRate(24);
    expect(mockRpc).toHaveBeenCalledWith("admin_get_metrics", {
      p_store_kind: "production",
      p_hours: 24,
      p_metric_type: "all",
    });
    expect(result).toBe(80);
  });

  it("getSuccessRate with storeKind='test' returns test-only metrics", async () => {
    mockBundle(TEST_BUNDLE);
    const result = await getSuccessRate(24, "test");
    expect(mockRpc).toHaveBeenCalledWith("admin_get_metrics", {
      p_store_kind: "test",
      p_hours: 24,
      p_metric_type: "all",
    });
    expect(result).toBe(67); // 2/3 * 100
  });

  it("getSuccessRate with storeKind='all' includes all stores", async () => {
    mockBundle(ALL_BUNDLE);
    const result = await getSuccessRate(24, "all");
    expect(mockRpc).toHaveBeenCalledWith("admin_get_metrics", {
      p_store_kind: "all",
      p_hours: 24,
      p_metric_type: "all",
    });
    expect(result).toBe(77); // 10/13 * 100 ≈ 77
  });

  it("getCreditsGranted excludes test store transactions (production default)", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    const result = await getCreditsGranted(24);
    expect(result).toBe(500);
  });

  it("getCreditsGranted with storeKind='all' includes test stores", async () => {
    mockBundle(ALL_BUNDLE);
    const result = await getCreditsGranted(24, "all");
    expect(result).toBe(600);
  });

  it("getVsCreditsConsumed excludes test stores by default", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    const result = await getVsCreditsConsumed(24);
    expect(result).toBe(20);
  });

  it("getVsCreditsConsumed with storeKind='all' includes test stores", async () => {
    mockBundle(ALL_BUNDLE);
    const result = await getVsCreditsConsumed(24, "all");
    expect(result).toBe(25);
  });

  it("production < all (test stores exist)", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    const prod = await getActiveUsers(24);

    mockBundle(ALL_BUNDLE);
    const all = await getActiveUsers(24, "all");

    expect(prod).toBe(5);
    expect(all).toBe(7);
    expect(prod!).toBeLessThan(all!);
  });

  it("storeKind='test' returns only test store metrics", async () => {
    mockBundle(TEST_BUNDLE);
    const active = await getActiveUsers(24, "test");
    expect(active).toBe(2);
  });

  it("RPC is called only once per (hours, storeKind) pair (cache)", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    await getSuccessRate(24);
    await getErrorRate(24);
    await getAvgCost(24);
    await getActiveUsers(24);

    // admin_get_metrics é cacheado (1 chamada); getAvgCost apura via
    // admin_get_ai_costs (call-level, 1 chamada) — não passa pelo bundle.
    expect(
      mockRpc.mock.calls.filter((c) => c[0] === "admin_get_metrics"),
    ).toHaveLength(1);
    expect(
      mockRpc.mock.calls.filter((c) => c[0] === "admin_get_ai_costs"),
    ).toHaveLength(1);
  });

  it("RPC cache key varies by storeKind", async () => {
    mockBundle(PRODUCTION_BUNDLE);
    await getSuccessRate(24); // production

    mockBundle(ALL_BUNDLE);
    await getSuccessRate(24, "all"); // all — different key

    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

describe("domain isolation", () => {
  it("VS-only data returns null/0 for campaign metrics", async () => {
    const vsOnly = {
      pipeline: { total: 0, success: 0, error: 0, avg_duration_ms: null, active_users: 0 },
      vs: { success_rate: 75, error_rate: 25, avg_duration_ms: 15000 },
      wallet: {
        credits_granted: 0, credits_consumed_vs: 20, refund_rate: 0,
        vs_credits_consumed: 20, vs_credits_refunded: 0, vs_refund_rate: 0,
        credits_consumed: 20, credits_refunded_campaign: 0,
      },
    };
    mockBundle(vsOnly);
    expect(await getSuccessRate(24)).toBeNull();
    expect(await getErrorRate(24)).toBe(0);
    expect(await getAvgCost(24)).toBeNull();
    expect(await getAvgDuration(24)).toBeNull();
  });

  it("campaign-only data returns null/0 for VS metrics", async () => {
    const campOnly = {
      pipeline: { total: 10, success: 8, error: 2, avg_duration_ms: 12000, active_users: 5 },
      vs: { success_rate: null, error_rate: 0, avg_duration_ms: null },
      wallet: {
        credits_granted: 500, credits_consumed_vs: 0, refund_rate: 10,
        vs_credits_consumed: 0, vs_credits_refunded: 0, vs_refund_rate: 0,
        credits_consumed: 0, credits_refunded_campaign: 1,
      },
    };
    mockBundle(campOnly);
    expect(await getVsSuccessRate(24)).toBeNull();
    expect(await getVsErrorRate(24)).toBe(0);
    expect(await getVsAvgDuration(24)).toBeNull();
    expect(await getVsCreditsConsumed(24)).toBe(0);
    expect(await getVsCreditsRefunded(24)).toBe(0);
  });
});
