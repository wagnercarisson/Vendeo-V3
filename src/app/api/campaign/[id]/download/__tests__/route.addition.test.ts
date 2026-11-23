// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  addition: { kind: "none" } as Record<string, unknown>,
  probe: {
    kind: "integral",
    format: "9:16",
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    storagePath: "vertical/path.jpg",
    evidenceRef: "e1",
  } as Record<string, unknown>,
  downloads: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-handler", () => ({
  apiHandler: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "u" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async () => ({})),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async () => ({
    id: "00000000-0000-4000-8000-0000000000c1",
    store_id: "00000000-0000-4000-8000-0000000000b1",
    product_name: "Produto",
    created_at: "2026-01-01T00:00:00Z",
    status: "ready",
    storage_path: "store/campaign.jpg",
    input_snapshot: {},
  })),
  listArtVersions: vi.fn(async () => []),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/campaign/new-flow-marker", () => ({
  classifyCampaignFlow: vi.fn(() => "legacy"),
}));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    async getCampaignOperation() {
      return null;
    }
  },
}));
vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: class {},
}));
vi.mock("@/lib/campaign/format-addition/delivery-reader", () => ({
  readFormatAdditionByCampaign: vi.fn(async () => h.addition),
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/vertical-probe", () => ({
  CompositionVerticalProbe: class {
    async probeVerticalArtifact() {
      return h.probe;
    }
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          h.downloads.push(`${bucket}:${path}`);
          return {
            data: new Blob(
              [bucket === "campaign-images" ? "square" : "vertical"],
              { type: "image/jpeg" },
            ),
            error: null,
          };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  },
}));

import { GET } from "../route";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";
const params = Promise.resolve({ id: CAMPAIGN });

function request(format?: string | string[]) {
  const base = `http://localhost/api/campaign/${CAMPAIGN}/download`;
  if (format === undefined) return new NextRequest(base);
  const values = Array.isArray(format) ? format : [format];
  const query = values.map((value) => `format=${value}`).join("&");
  return new NextRequest(`${base}?${query}`);
}

function deliveredAddition() {
  return {
    kind: "found",
    addition: {
      state: "delivered",
      sourceOrigin: "legacy_campaign",
      refunded: false,
      operationId: "00000000-0000-4000-8000-0000000000a1",
      requestId: "00000000-0000-4000-8000-0000000000a2",
      sourceArtifactId: null,
      sourceRegistrationOperationId: null,
      createdAt: null,
    },
  };
}

beforeEach(() => {
  h.addition = { kind: "none" };
  h.probe = {
    kind: "integral",
    format: "9:16",
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    storagePath: "vertical/path.jpg",
    evidenceRef: "e1",
  };
  h.downloads = [];
});

describe("F62-06 — download por formato com adição", () => {
  it("?format=9:16 serve o vertical entregue", async () => {
    h.addition = deliveredAddition();
    const response = await GET(request("9:16"), { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(await response.text()).toBe("vertical");
    expect(h.downloads).toEqual(["campaign-internal-artifacts:vertical/path.jpg"]);
  });

  it("?format=1:1 e ausência servem o quadrado, mesmo com vertical entregue", async () => {
    h.addition = deliveredAddition();
    for (const format of [undefined, "1:1"]) {
      h.downloads = [];
      const response = await GET(request(format), { params });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("square");
      expect(h.downloads).toEqual(["campaign-images:store/campaign.jpg"]);
    }
  });

  it("9:16 sem entrega/adição falha fechado, sem fallback ao quadrado", async () => {
    for (const addition of [
      { kind: "none" },
      {
        kind: "found",
        addition: {
          ...deliveredAddition().addition,
          state: "refunded",
          refunded: true,
        },
      },
      {
        kind: "found",
        addition: {
          ...deliveredAddition().addition,
          state: "processing",
        },
      },
    ]) {
      h.addition = addition;
      const response = await GET(request("9:16"), { params });
      expect(response.status).toBe(409);
      expect(h.downloads).toHaveLength(0);
    }
  });

  it("formato inválido/duplicado retorna 400 antes de baixar", async () => {
    h.addition = deliveredAddition();
    expect((await GET(request(["9:16", "1:1"]), { params })).status).toBe(400);
    expect((await GET(request("2:3"), { params })).status).toBe(400);
    expect(h.downloads).toHaveLength(0);
  });

  it("probe ausente/indeterminado e leitura indisponível falham fechado", async () => {
    h.addition = deliveredAddition();
    h.probe = { kind: "absent" };
    expect((await GET(request("9:16"), { params })).status).toBe(404);

    h.probe = { kind: "indeterminate" };
    expect((await GET(request("9:16"), { params })).status).toBe(503);

    h.addition = { kind: "read_failed" };
    expect((await GET(request("9:16"), { params })).status).toBe(503);
  });
});
