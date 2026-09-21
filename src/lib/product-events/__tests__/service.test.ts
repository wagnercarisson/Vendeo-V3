import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn(() => ({ upsert: mockUpsert })) },
}));

describe("ProductEventService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("writes the event with the dedup conflict key and full identity payload", async () => {
    const { ProductEventService } = await import("../service");
    await new ProductEventService().record("first_generation", {
      store_id: "store-1",
      user_id: "user-1",
      dedup_key: "grant-1",
      properties: { source: "campaign" },
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      event_type: "first_generation",
      store_id: "store-1",
      user_id: "user-1",
      dedup_key: "grant-1",
      properties: { source: "campaign" },
    }, { onConflict: "event_type,dedup_key", ignoreDuplicates: true });
  });

  it("is fail-open when the write fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockUpsert.mockRejectedValueOnce(new Error("database unavailable"));
    const { ProductEventService } = await import("../service");

    await expect(new ProductEventService().record("demo_expired", {
      dedup_key: "expiration-1",
    })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("accepts a second identical event without creating a duplicate", async () => {
    const { ProductEventService } = await import("../service");
    const service = new ProductEventService();
    await service.record("demo_granted", { dedup_key: "grant-1" });
    await service.record("demo_granted", { dedup_key: "grant-1" });

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenLastCalledWith(expect.objectContaining({ dedup_key: "grant-1" }), expect.objectContaining({ ignoreDuplicates: true }));
  });
});
