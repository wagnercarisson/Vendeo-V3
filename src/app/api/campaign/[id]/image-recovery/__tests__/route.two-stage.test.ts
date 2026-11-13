// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  recover: vi.fn(),
  campaign: {
    id: "00000000-0000-4000-8000-0000000000c1",
    store_id: "00000000-0000-4000-8000-0000000000b1",
    product_name: "Produto",
    created_at: "2026-01-01T00:00:00Z",
    input_snapshot: {
      generationOrigin: "9_16_two_stage",
      generationContractVersion: "f60.5-two-stage-9-16-v1",
    },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "user-1" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async () => ({ name: "Loja", segment: "varejo" })),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async () => h.campaign),
}));
vi.mock("@/lib/product-1-1/artifact/artifact-recovery", () => ({
  ProductOneToOneArtifactRecovery: class {
    recover = h.recover;
  },
}));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const params = Promise.resolve({ id: h.campaign.id });

function request() {
  return new NextRequest(
    `http://localhost/api/campaign/${h.campaign.id}/image-recovery`,
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ operationId: "00000000-0000-4000-8000-0000000000a1" }),
    },
  );
}

describe("image-recovery — origem two-stage", () => {
  it("recusa GET e POST com 409 antes de qualquer recuperação", async () => {
    const getResponse = await GET(request(), { params });
    expect(getResponse.status).toBe(409);
    expect((await getResponse.json()).error.code).toBe(
      "image_recovery_unavailable",
    );

    const postResponse = await POST(request(), { params });
    expect(postResponse.status).toBe(409);
    expect((await postResponse.json()).error.code).toBe(
      "image_recovery_unavailable",
    );
    expect(h.recover).not.toHaveBeenCalled();
  });
});
