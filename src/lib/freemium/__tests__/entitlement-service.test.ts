import { describe, it, expect, vi, beforeEach } from "vitest";
import { FreemiumEntitlementService } from "../entitlement-service";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

describe("FreemiumEntitlementService", () => {
  let service: FreemiumEntitlementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FreemiumEntitlementService({ rpc: mockRpc, from: mockFrom } as any);
  });

  describe("checkOnboardingEligibility", () => {
    it("returns true when no entitlement exists", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      });

      const result = await service.checkOnboardingEligibility("new_hash");
      expect(result).toBe(true);
    });

    it("returns false when entitlement exists", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "ent-1" } }),
      });

      const result = await service.checkOnboardingEligibility("existing_hash");
      expect(result).toBe(false);
    });
  });

  describe("grantOnboardingEntitlement", () => {
    it("returns UUID on first grant", async () => {
      mockRpc.mockResolvedValueOnce({ data: "ent-1", error: null });

      const result = await service.grantOnboardingEntitlement("store-1", "hash1");
      expect(result).toBe("ent-1");
      expect(mockRpc).toHaveBeenCalledWith("try_grant_onboarding_entitlement", expect.any(Object));
    });

    it("returns null on idempotent (ON CONFLICT)", async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.grantOnboardingEntitlement("store-1", "hash1");
      expect(result).toBeNull();
    });
  });

  describe("checkMonthlyEligibility", () => {
    it("returns true when no grant in cycle", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      });

      const result = await service.checkMonthlyEligibility("hash", "2026-08");
      expect(result).toBe(true);
    });

    it("returns false when already granted in cycle", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "ent-1" } }),
      });

      const result = await service.checkMonthlyEligibility("hash", "2026-08");
      expect(result).toBe(false);
    });
  });

  describe("grantMonthlyEntitlement", () => {
    it("returns UUID on first grant", async () => {
      mockRpc.mockResolvedValueOnce({ data: "ent-monthly-1", error: null });

      const result = await service.grantMonthlyEntitlement("store-1", "hash", "2026-08");
      expect(result).toBe("ent-monthly-1");
      expect(mockRpc).toHaveBeenCalledWith("try_grant_monthly_entitlement", expect.any(Object));
    });

    it("returns null on idempotent", async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.grantMonthlyEntitlement("store-1", "hash", "2026-08");
      expect(result).toBeNull();
    });
  });

  describe("getHistoryByStore", () => {
    it("returns entitlements array", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "ent-1", store_id: "store-1", root_hash: "hash", benefit_type: "onboarding", cycle: null, grant_transaction_id: null, granted_by: null, reason: null, created_at: "2026-07-27T00:00:00Z" },
          ],
        }),
      });

      const result = await service.getHistoryByStore("store-1");
      expect(result).toHaveLength(1);
      expect(result[0].benefit_type).toBe("onboarding");
    });
  });

  describe("getHistoryByRoot", () => {
    it("returns entitlements array", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "ent-2", store_id: "store-2", root_hash: "hash", benefit_type: "monthly", cycle: "2026-07", grant_transaction_id: null, granted_by: null, reason: null, created_at: "2026-07-27T00:00:00Z" },
          ],
        }),
      });

      const result = await service.getHistoryByRoot("hash");
      expect(result).toHaveLength(1);
      expect(result[0].benefit_type).toBe("monthly");
    });
  });
});
