import { describe, expect, it, vi } from "vitest";

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: vi.fn(() => ({ upsert })) } }));

describe("product event telemetry", () => {
  it("deduplicates first_generation by grant and permits multiple support requests", async () => {
    upsert.mockResolvedValue({ error: null });
    const { ProductEventService } = await import("../service");
    const service = new ProductEventService();
    await service.record("first_generation", { store_id: "s1", dedup_key: "grant-1" });
    await service.record("support_credit_request", { store_id: "s1", dedup_key: "op-1" });
    expect(upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({ event_type: "first_generation", dedup_key: "grant-1" }), { onConflict: "event_type,dedup_key", ignoreDuplicates: true });
    expect(upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({ event_type: "support_credit_request", dedup_key: "op-1" }), expect.anything());
  });

  it("is fail-open when telemetry storage is unavailable", async () => {
    upsert.mockRejectedValue(new Error("unavailable"));
    const { ProductEventService } = await import("../service");
    await expect(new ProductEventService().record("demo_expired", { dedup_key: "expiration-1" })).resolves.toBeUndefined();
  });

  it("returns no error and preserves event payload on database errors", async () => {
    upsert.mockResolvedValue({ error: new Error("constraint") });
    const { ProductEventService } = await import("../service");
    await expect(new ProductEventService().record("demo_granted", {
      store_id: "s1", user_id: "u1", dedup_key: "grant-1", properties: { amount: 10 },
    })).resolves.toBeUndefined();
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      event_type: "demo_granted", store_id: "s1", user_id: "u1", dedup_key: "grant-1", properties: { amount: 10 },
    }), expect.objectContaining({ onConflict: "event_type,dedup_key", ignoreDuplicates: true }));
  });

  it("uses distinct dedup keys for repeated support requests", async () => {
    upsert.mockResolvedValue({ error: null });
    const { ProductEventService } = await import("../service");
    const service = new ProductEventService();
    upsert.mockClear();
    await service.record("support_credit_request", { dedup_key: "op-1" });
    await service.record("support_credit_request", { dedup_key: "op-2" });
    expect(upsert.mock.calls[0][0].dedup_key).toBe("op-1");
    expect(upsert.mock.calls[1][0].dedup_key).toBe("op-2");
  });
});
