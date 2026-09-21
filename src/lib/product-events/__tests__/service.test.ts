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
});
