import { describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: vi.fn() } }));

import { CREDIT_TYPE_BADGE, CREDIT_TYPE_LABELS } from "../labels";
import { formatRelativeExpiry, getDemoStatus } from "../demo-status";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { FreemiumEntitlementService } from "@/lib/freemium/entitlement-service";

describe("F50 demo status and defaults", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const active = { demoBalance: 10, demoExpiresAt: "2026-01-04T00:00:00.000Z", originDemoGrantTxId: "grant-1" };

  it("distinguishes all demo states, including post-materialization expiration", () => {
    expect(getDemoStatus(active, now)).toBe("active");
    expect(getDemoStatus({ ...active, demoExpiresAt: "2026-01-01T12:00:00.000Z" }, now)).toBe("expiring_soon");
    expect(getDemoStatus({ ...active, demoBalance: 0 }, now)).toBe("exhausted");
    expect(getDemoStatus({ ...active, demoExpiresAt: "2025-12-31T23:59:59.000Z" }, now)).toBe("expired");
    expect(getDemoStatus({ ...active, demoExpiresAt: null }, now)).toBe("expired");
    expect(getDemoStatus({ demoBalance: 0, demoExpiresAt: null }, now)).toBe("none");
  });

  it("formats relative expiry in hours and days", () => {
    expect(formatRelativeExpiry("2026-01-01T05:00:00.000Z", now)).toBe("expira em 5 horas");
    expect(formatRelativeExpiry("2026-01-03T00:00:00.000Z", now)).toBe("expira em 2 dias");
  });

  it("keeps labels and fail-closed launch defaults exact", () => {
    expect(CREDIT_TYPE_LABELS.demo).toBe("Demonstração");
    expect(CREDIT_TYPE_LABELS.expiration).toBe("Expiração");
    expect(CREDIT_TYPE_BADGE.demo).toBe("ready");
    expect(CREDIT_TYPE_BADGE.expiration).toBe("error");
    expect(getLaunchConfig()).toMatchObject({ demoCreditsEnabled: false, demoCreditsAmount: 10, demoCreditsTtlHours: 168, emailEnabled: false, monthlyCreditsEnabled: true });
  });

  it("checks demo eligibility through the three blocking benefit types", async () => {
    const maybeSingle = async () => ({ data: null, error: null });
    const service = new FreemiumEntitlementService({
      from: () => ({ select: () => ({ eq: () => ({ in: () => ({ limit: () => ({ maybeSingle }) }) }) }) }),
    } as never);
    await expect(service.checkDemoEligibility("root-1")).resolves.toBe(true);
  });
});
