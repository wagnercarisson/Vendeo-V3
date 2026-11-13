// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lookup: { kind: "found" } as Record<string, unknown>,
  access: { kind: "downloadBytes", bytes: Buffer.from("img"), mimeType: "image/jpeg" } as Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { operation_id: "00000000-0000-4000-8000-0000000000a1" }, error: null }) }) }),
    }),
  },
}));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/require-user", () => ({ requireApiUser: vi.fn(async () => ({ userId: "u" })) }));
vi.mock("@/lib/auth/store-ownership", () => ({ requireOwnership: vi.fn(async () => ({})) }));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async () => ({
    id: "00000000-0000-4000-8000-0000000000c1",
    store_id: "s",
    product_name: "P",
    created_at: "2026-01-01T00:00:00Z",
    input_snapshot: {
      generationOrigin: "9_16_two_stage",
      generationContractVersion: "f60.5-two-stage-9-16-v1",
    },
  })),
}));
vi.mock("@/lib/product-9-16-two-stage/two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {
    getOperationView = vi.fn(async () => h.lookup);
  },
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/vertical-access", () => ({
  nineSixteenVerticalAccess: vi.fn(async () => h.access),
}));

import { GET } from "../route";

const params = Promise.resolve({ id: "00000000-0000-4000-8000-0000000000c1" });
function request() {
  return new NextRequest("http://localhost/api/campaign/00000000-0000-4000-8000-0000000000c1/download");
}

describe("download two-stage", () => {
  it("returns original bytes after delivered", async () => {
    const response = await GET(request(), { params });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(await response.text()).toBe("img");
  });

  it("maps indeterminate to 502 and other unavailability to 403", async () => {
    h.access = { kind: "not_available", reason: "indeterminate" };
    expect((await GET(request(), { params })).status).toBe(502);
    h.access = { kind: "not_available", reason: "not_delivered" };
    expect((await GET(request(), { params })).status).toBe(403);
  });

  it("maps read_failed to 503", async () => {
    h.lookup = { kind: "read_failed", reason: "x" };
    expect((await GET(request(), { params })).status).toBe(503);
  });
});
