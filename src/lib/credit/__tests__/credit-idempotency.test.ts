import { describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: () => ({ upsert }) } }));

describe("F50 idempotency contracts", () => {
  it("uses the same logical key for repeated notification writes", async () => {
    upsert.mockReturnValue({ select: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) });
    const { enqueueNotification } = await import("@/lib/notifications/outbox");
    await enqueueNotification({ storeId: "store-1", userId: "user-1", kind: "demo_granted", dedupKey: "grant-1", payload: {} });
    await enqueueNotification({ storeId: "store-1", userId: "user-1", kind: "demo_granted", dedupKey: "grant-1", payload: {} });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ dedup_key: "grant-1" }), expect.objectContaining({ onConflict: "store_id,kind,dedup_key", ignoreDuplicates: true }));
  });

  it("deduplicates product events by event type and key while remaining fail-open", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: () => ({ upsert }) } }));
    const { ProductEventService } = await import("@/lib/product-events/service");
    const service = new ProductEventService();
    await service.record("demo_expired", { dedup_key: "expiration-1" });
    await service.record("demo_expired", { dedup_key: "expiration-1" });
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ event_type: "demo_expired", dedup_key: "expiration-1" }), expect.objectContaining({ onConflict: "event_type,dedup_key", ignoreDuplicates: true }));
  });
});
