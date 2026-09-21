import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
}));

describe("F50 demo services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("VENDEO_V15_ENABLED", "true");
    vi.stubEnv("VENDEO_DEMO_CREDITS_ENABLED", undefined);
    vi.stubEnv("VENDEO_DEMO_CREDITS_AMOUNT", undefined);
    vi.stubEnv("VENDEO_DEMO_CREDITS_TTL_HOURS", undefined);
    vi.stubEnv("VENDEO_EMAIL_ENABLED", undefined);
  });

  it("includes active demo and excludes expired demo from getBalance", async () => {
    const { CreditService } = await import("../credit-service");
    const single = vi.fn()
      .mockResolvedValueOnce({ data: { demo_balance: 4, demo_expires_at: new Date(Date.now() + 60_000).toISOString(), bonus_balance: 2, purchased_balance: 1 } })
      .mockResolvedValueOnce({ data: { demo_balance: 4, demo_expires_at: new Date(Date.now() - 60_000).toISOString(), bonus_balance: 2, purchased_balance: 1 } });
    mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) });
    const service = new CreditService({ from: mockFrom } as never);

    await expect(service.getBalance("store")).resolves.toBe(7);
    await expect(service.getBalance("store")).resolves.toBe(3);
  });

  it("returns the complete breakdown", async () => {
    const { CreditService } = await import("../credit-service");
    const row = { balance: 9, demo_balance: 4, demo_expires_at: new Date(Date.now() + 60_000).toISOString(), bonus_balance: 2, purchased_balance: 3 };
    mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: row }) })) })) });
    await expect(new CreditService({ from: mockFrom } as never).getBalanceBreakdown("store")).resolves.toMatchObject({ balance: 9, demoBalance: 4, demoExpiresAt: row.demo_expires_at, bonusBalance: 2, purchasedBalance: 3, availableBalance: 9 });
  });

  it("blocks onboarding, demo and admin_exception roots and grants idempotently", async () => {
    const { FreemiumEntitlementService } = await import("@/lib/freemium/entitlement-service");
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: "existing-onboarding" } })
      .mockResolvedValueOnce({ data: { id: "existing-demo" } })
      .mockResolvedValueOnce({ data: { id: "existing-admin" } })
      .mockResolvedValueOnce({ data: null });
    mockIn.mockImplementation(() => ({ limit: vi.fn(() => ({ maybeSingle })) }));
    mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ in: mockIn })) })) });
    mockRpc.mockResolvedValueOnce({ data: "grant-id", error: null }).mockResolvedValueOnce({ data: null, error: null });
    const service = new FreemiumEntitlementService({ from: mockFrom, rpc: mockRpc } as never);
    await expect(service.checkDemoEligibility("root")).resolves.toBe(false);
    await expect(service.checkDemoEligibility("root")).resolves.toBe(false);
    await expect(service.checkDemoEligibility("root")).resolves.toBe(false);
    await expect(service.checkDemoEligibility("root")).resolves.toBe(true);
    expect(mockIn).toHaveBeenCalledWith("benefit_type", ["onboarding", "demo", "admin_exception"]);
    await expect(service.grantDemoEntitlement("store", "root")).resolves.toBe("grant-id");
    await expect(service.grantDemoEntitlement("store", "root")).resolves.toBeNull();
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith("try_grant_demo_entitlement", { p_store_id: "store", p_root_hash: "root" });
  });

  it("uses fail-closed launch defaults", async () => {
    const { getLaunchConfig } = await import("@/lib/launch-config/config");
    const config = getLaunchConfig();
    expect(config).toMatchObject({ demoCreditsEnabled: false, demoCreditsAmount: 10, demoCreditsTtlHours: 168, emailEnabled: false, monthlyCreditsEnabled: true });
  });

  it("covers all demo states and relative expiry", async () => {
    const { formatRelativeExpiry, getDemoStatus } = await import("../demo-status");
    const now = new Date("2026-01-01T00:00:00Z");
    const grant = { originDemoGrantTxId: "grant" };
    expect(getDemoStatus({ ...grant, demoBalance: 1, demoExpiresAt: "2026-01-03T00:00:00Z" }, now)).toBe("active");
    expect(getDemoStatus({ ...grant, demoBalance: 1, demoExpiresAt: "2026-01-01T12:00:00Z" }, now)).toBe("expiring_soon");
    expect(getDemoStatus({ ...grant, demoBalance: 0, demoExpiresAt: "2026-01-02T00:00:00Z" }, now)).toBe("exhausted");
    expect(getDemoStatus({ ...grant, demoBalance: 1, demoExpiresAt: "2025-12-31T00:00:00Z" }, now)).toBe("expired");
    expect(getDemoStatus({ ...grant, demoBalance: 0, demoExpiresAt: null }, now)).toBe("expired");
    expect(getDemoStatus({ demoBalance: 0, demoExpiresAt: null }, now)).toBe("none");
    expect(formatRelativeExpiry("2026-01-01T05:00:00Z", now)).toBe("expira em 5 horas");
    expect(formatRelativeExpiry("2026-01-03T00:00:00Z", now)).toBe("expira em 2 dias");
  });
});
