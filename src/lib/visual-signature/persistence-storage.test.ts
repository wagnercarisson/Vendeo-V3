import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSignedUrl } = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({ createSignedUrl })),
    },
  },
}));

describe("visual signature signed URLs", () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
  });

  it("returns a signed URL and requests the configured TTL", async () => {
    createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: "signed-1" }, error: null });
    const { getSignedVisualSignatureUrl } = await import("./persistence");

    await expect(getSignedVisualSignatureUrl("store/signature.png", 60)).resolves.toBe("signed-1");
    expect(createSignedUrl).toHaveBeenCalledWith("store/signature.png", 60);
  });

  it("creates a fresh URL on every read, allowing renewal after expiry", async () => {
    createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "signed-before-expiry" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "signed-after-expiry" }, error: null });
    const { getSignedVisualSignatureUrl } = await import("./persistence");

    await expect(getSignedVisualSignatureUrl("store/signature.png")).resolves.toBe("signed-before-expiry");
    await expect(getSignedVisualSignatureUrl("store/signature.png")).resolves.toBe("signed-after-expiry");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("does not persist or return an empty URL when signing fails", async () => {
    createSignedUrl
      .mockResolvedValueOnce({ data: null, error: new Error("storage unavailable") })
      .mockResolvedValueOnce({ data: null, error: new Error("storage unavailable") });
    const { getSignedVisualSignatureUrl, requireSignedVisualSignatureUrl } = await import("./persistence");

    await expect(getSignedVisualSignatureUrl("store/signature.png")).resolves.toBeNull();
    await expect(requireSignedVisualSignatureUrl("store/signature.png")).rejects.toMatchObject({
      code: "signed_visual_signature_unavailable",
    });
  });
});
