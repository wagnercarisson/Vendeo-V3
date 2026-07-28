import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    order: vi.fn().mockReturnThis(),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc, from: mockFrom },
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));

import { FreemiumEntitlementService } from "@/lib/freemium/entitlement-service";

describe("Freemium Integration — onboarding 1x por raiz", () => {
  let service: FreemiumEntitlementService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      order: vi.fn().mockReturnThis(),
    });
    service = new FreemiumEntitlementService({ rpc: mockRpc, from: mockFrom } as any);
  });

  it("grants onboarding on first call, blocks on second (same root)", async () => {
    mockRpc.mockResolvedValueOnce({ data: "ent-1", error: null });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const first = await service.grantOnboardingEntitlement("store-1", "root-hash-1");
    expect(first).toBe("ent-1");

    const second = await service.grantOnboardingEntitlement("store-2", "root-hash-1");
    expect(second).toBeNull();
  });

  it("admin exception via separate RPC bypasses eligibility", async () => {
    mockRpc.mockResolvedValueOnce({ data: "ent-1", error: null });

    const onboarding = await service.grantOnboardingEntitlement("store-1", "root-hash-2");
    expect(onboarding).toBe("ent-1");

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "ent-onb" } }),
    });
    const eligible = await service.checkOnboardingEligibility("root-hash-2");
    expect(eligible).toBe(false);

    mockRpc.mockResolvedValueOnce({ data: "ent-exception", error: null });
    const exception = await service.grantOnboardingEntitlement("store-1", "root-hash-2");
    expect(exception).toBe("ent-exception");
  });

  it("monthly grant: 1x per root per cycle", async () => {
    mockRpc.mockResolvedValueOnce({ data: "ent-monthly-1", error: null });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const first = await service.grantMonthlyEntitlement("store-1", "root-hash-3", "2026-08");
    expect(first).toBe("ent-monthly-1");

    const second = await service.grantMonthlyEntitlement("store-2", "root-hash-3", "2026-08");
    expect(second).toBeNull();
  });

  it("different cycle allows new monthly grant for same root", async () => {
    mockRpc.mockResolvedValueOnce({ data: "ent-m-1", error: null });
    mockRpc.mockResolvedValueOnce({ data: "ent-m-2", error: null });

    const aug = await service.grantMonthlyEntitlement("store-1", "root-hash-4", "2026-08");
    expect(aug).toBe("ent-m-1");

    const sep = await service.grantMonthlyEntitlement("store-1", "root-hash-4", "2026-09");
    expect(sep).toBe("ent-m-2");
  });

  it("delete + recreate same root does not re-grant onboarding", async () => {
    mockRpc.mockResolvedValueOnce({ data: "ent-1", error: null });
    const first = await service.grantOnboardingEntitlement("store-1", "root-hash-5");
    expect(first).toBe("ent-1");

    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const second = await service.grantOnboardingEntitlement(null, "root-hash-5");
    expect(second).toBeNull();
  });
});
