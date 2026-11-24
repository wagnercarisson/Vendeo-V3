// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  artifact: { kind: "found", artifact: { artifactId: "artifact-1", checksumSha256: "a".repeat(64) } } as Record<string, unknown>,
  ledger: { kind: "delivered", deductionId: "tx-1" } as Record<string, unknown>,
  retrieve: { kind: "integral", artifact: { mimeType: "image/jpeg" }, bytes: Buffer.from("square") } as Record<string, unknown>,
  verticalBytes: Buffer.from("vertical"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "user-1" })),
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
    input_snapshot: {
      campaignFormat: "9:16",
      formatContractVersion: "f59-vertical-9-16-v1",
      generationOrigin: "9_16_two_stage",
      generationContractVersion: "f60.5-two-stage-9-16-v1",
    },
  })),
  listArtVersions: vi.fn(async () => []),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/campaign/new-flow-marker", () => ({
  classifyCampaignFlow: vi.fn(() => "new_flow"),
}));
vi.mock("@/lib/campaign/format-addition/delivery-reader", () => ({
  readFormatAdditionByCampaign: vi.fn(async () => ({ kind: "none" })),
}));
vi.mock("@/lib/campaign/square-release", () => ({
  readSquareReleaseArtifact: vi.fn(async () => h.artifact),
  readSquareReleaseLedger: vi.fn(async () => h.ledger),
}));
vi.mock("@/lib/campaign/composition-artifacts/retrieve", () => ({
  retrieveCompositionArtifact: vi.fn(async () => h.retrieve),
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/vertical-access", () => ({
  nineSixteenVerticalAccess: vi.fn(async () => ({
    kind: "downloadBytes",
    bytes: h.verticalBytes,
    mimeType: "image/jpeg",
  })),
}));
vi.mock("@/lib/product-9-16-two-stage/two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {
    async getOperationView() {
      return { kind: "found" };
    }
  },
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/vertical-probe", () => ({
  CompositionVerticalProbe: class {},
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { operation_id: "operation-1" },
            error: null,
          }),
        }),
      }),
    }),
    storage: { from: () => ({}) },
  },
}));

import { GET } from "../route";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";
const params = Promise.resolve({ id: CAMPAIGN });

function request(query = "") {
  return new NextRequest(
    `http://localhost/api/campaign/${CAMPAIGN}/download${query}`,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.artifact = {
    kind: "found",
    artifact: { artifactId: "artifact-1", checksumSha256: "a".repeat(64) },
  };
  h.ledger = { kind: "delivered", deductionId: "tx-1" };
  h.retrieve = {
    kind: "integral",
    artifact: { mimeType: "image/jpeg" },
    bytes: Buffer.from("square"),
  };
});

describe("download do quadrado liberado", () => {
  it("?format=1:1 liberado serve os bytes do quadrado", async () => {
    const response = await GET(request("?format=1:1"), { params });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    await expect(response.text()).resolves.toBe("square");
  });

  it("?format=1:1 antes da liberação falha fechado sem baixar", async () => {
    h.ledger = { kind: "none" };
    const { retrieveCompositionArtifact } = await import(
      "@/lib/campaign/composition-artifacts/retrieve"
    );
    const response = await GET(request("?format=1:1"), { params });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_delivered" },
    });
    expect(retrieveCompositionArtifact).not.toHaveBeenCalled();
  });

  it("?format=1:1 estornado não libera", async () => {
    h.ledger = { kind: "refunded", deductionId: "tx-1", refundId: "r-1" };
    const response = await GET(request("?format=1:1"), { params });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "refunded" },
    });
  });

  it("?format duplicado ou inválido falha 400", async () => {
    for (const query of ["?format=1:1&format=9:16", "?format=other"]) {
      const response = await GET(request(query), { params });
      expect(response.status).toBe(400);
    }
  });

  it("?format=9:16 preserva o download vertical", async () => {
    const response = await GET(request("?format=9:16"), { params });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("vertical");
  });
});
