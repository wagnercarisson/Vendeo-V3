// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  campaign: {
    id: "22222222-2222-4222-8222-222222222222",
    store_id: "11111111-1111-4111-8111-111111111111",
    product_name: "Produto conjunto",
    created_at: "2026-11-19T00:00:00.000Z",
    input_snapshot: {
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
    },
  },
  read: null as unknown,
  controlResult: {
    kind: "found",
    operationId: "33333333-3333-4333-8333-333333333333",
  } as unknown,
  readCalls: 0,
  download: vi.fn(async (path: string) => ({
    data: new Blob([`bytes:${path}`]),
    error: null,
  })),
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
  getCampaign: vi.fn(async () => h.campaign),
  listArtVersions: vi.fn(async () => []),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { operation_id: "33333333-3333-4333-8333-333333333333" },
              error: null,
            }),
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({ download: h.download }),
    },
  },
}));
vi.mock("@/lib/product-two-format/delivery-reader", () => ({
  readTwoFormatDelivery: vi.fn(async () => {
    h.readCalls += 1;
    return h.read;
  }),
}));
vi.mock("@/lib/product-two-format/control-reader", () => ({
  resolveTwoFormatControlOperation: vi.fn(async () => h.controlResult),
}));

const STORE = h.campaign.store_id;
const CAMPAIGN = h.campaign.id;
const OPERATION = "33333333-3333-4333-8333-333333333333";

function view(square: "delivered" | "absent", vertical: "delivered" | "absent") {
  return {
    origin: "two_format_two_stage",
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    square: {
      format: "1:1",
      state: square,
      creditRefunded: square === "absent",
      deliveryOperationId: "44444444-4444-4444-8444-444444444444",
      artifactRole: square === "delivered" ? "square_original" : null,
      artifactPath:
        square === "delivered"
          ? `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`
          : null,
      supportReference: null,
    },
    vertical: {
      format: "9:16",
      state: vertical,
      creditRefunded: vertical === "absent",
      deliveryOperationId: OPERATION,
      artifactRole: vertical === "delivered" ? "vertical" : null,
      artifactPath:
        vertical === "delivered"
          ? `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`
          : null,
      supportReference: null,
    },
    preferredThumbnail: null,
  };
}

function request(format?: string) {
  const url = new URL(`http://localhost/api/campaign/${CAMPAIGN}/download`);
  if (format !== undefined) url.searchParams.set("format", format);
  return new NextRequest(url);
}

function requestDuplicate() {
  const url = new URL(`http://localhost/api/campaign/${CAMPAIGN}/download`);
  url.searchParams.append("format", "1:1");
  url.searchParams.append("format", "9:16");
  return new NextRequest(url);
}

beforeEach(() => {
  h.readCalls = 0;
  h.controlResult = { kind: "found", operationId: OPERATION };
  h.download.mockClear();
});

describe("F60.7 C3 — download conjunto", () => {
  it("formato explícito entregue retorna bytes do caminho canônico", async () => {
    h.read = { kind: "found", view: view("delivered", "delivered") };
    const { GET } = await import("../route");
    const response = await GET(request("9:16"), {
      params: Promise.resolve({ id: CAMPAIGN }),
    });
    expect(response.status).toBe(200);
    expect(h.download).toHaveBeenCalledWith(
      `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
    );
    await expect(response.text()).resolves.toBe(
      `bytes:${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
    );
  });

  it("sem formato e apenas vertical entregue usa vertical", async () => {
    h.read = { kind: "found", view: view("absent", "delivered") };
    const { GET } = await import("../route");
    const response = await GET(request(), {
      params: Promise.resolve({ id: CAMPAIGN }),
    });
    expect(response.status).toBe(200);
    expect(h.download).toHaveBeenCalledWith(
      `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
    );
  });

  it("formato explícito não entregue é recusado sem fallback", async () => {
    h.read = { kind: "found", view: view("absent", "delivered") };
    const { GET } = await import("../route");
    const response = await GET(request("1:1"), {
      params: Promise.resolve({ id: CAMPAIGN }),
    });
    expect(response.status).toBe(403);
    expect(h.download).not.toHaveBeenCalled();
  });

  it("formato inválido, vazio ou duplicado é recusado sem leitura/download", async () => {
    h.read = { kind: "found", view: view("delivered", "delivered") };
    const { GET } = await import("../route");

    for (const req of [request("bogus"), request(""), requestDuplicate()]) {
      const response = await GET(req, {
        params: Promise.resolve({ id: CAMPAIGN }),
      });
      expect(response.status).toBe(400);
    }
    expect(h.readCalls).toBe(0);
    expect(h.download).not.toHaveBeenCalled();
  });
});
