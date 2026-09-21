import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const storeId = "550e8400-e29b-41d4-a716-446655440000";
const signatureId = "660e8400-e29b-41d4-a716-446655440001";

vi.mock("@/lib/auth/store-ownership", () => ({
  requireAuthorizedStore: vi.fn(async () => ({ userId: "user-1", storeId })),
}));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/identity-transitions", () => ({
  assertCanTransition: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/visual-signature/persistence", () => ({
  requireSignedVisualSignatureUrl: vi.fn(async () => "signed-restore-url"),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        single: async () => table === "stores"
          ? { data: { id: storeId, name: "Loja", segment: "food", identity_state: "text_only" }, error: null }
          : { data: { id: signatureId, store_id: storeId, status: "active", storage_path: `${storeId}/signature.png` }, error: null },
      };
      return chain;
    }),
  },
}));

describe("POST /api/store/[id]/visual-signature/restore", () => {
  it("returns success for an active signature after signing its asset", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest(`http://localhost/api/store/${storeId}/visual-signature/restore`, {
        method: "POST",
        headers: { origin: "http://localhost" },
        body: JSON.stringify({ signature_id: signatureId }),
      }),
      { params: Promise.resolve({ id: storeId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
