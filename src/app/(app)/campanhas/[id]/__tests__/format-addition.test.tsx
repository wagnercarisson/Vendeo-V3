// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const ADDITION_OPERATION = "33333333-3333-4333-8333-333333333333";
const VERTICAL_URL = "https://signed.local/vertical-9x16.jpg";
const VERTICAL_DOWNLOAD = "https://signed.local/vertical-9x16.jpg?download=1";

const h = vi.hoisted(() => ({
  campaign: {} as Record<string, unknown>,
  addition: { kind: "none" } as Record<string, unknown>,
  probe: "integral" as "integral" | "absent",
  storagePath: "vertical/path.jpg",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: async () => ({ userId: "user-1" }),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: async () => ({ id: STORE_ID, user_id: "user-1" }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: async () => ({ ok: true, locale: "pt-BR" }),
}));
vi.mock("@/lib/campaign/display", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign/display")>();
  return {
    ...actual,
    getCampaignForDisplay: async () => h.campaign,
    generateSignedPreviewUrl: async () => "https://signed.local/square.jpg",
  };
});
vi.mock("@/lib/campaign/persistence", () => ({
  listArtVersions: async () => [],
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: async () => false,
}));
vi.mock("@/lib/campaign/correction-reports", () => ({
  getCorrectionReport: async () => null,
}));
vi.mock("@/lib/product-1-1/snapshot/persist-snapshot", () => ({
  readProductOneToOneBackgroundDirection: async () => null,
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
vi.mock("@/lib/product-1-1/copy/copy-state", () => ({
  readCopyDelivery: async () => null,
  readCopyCancellation: async () => null,
  readCopyRecoverySummary: async () => null,
}));
vi.mock("@/lib/campaign/format-addition/delivery-reader", () => ({
  readFormatAdditionByCampaign: async () => h.addition,
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/vertical-probe", () => ({
  CompositionVerticalProbe: class {
    async probeVerticalArtifact() {
      return h.probe === "integral"
        ? {
            kind: "integral",
            format: "9:16",
            width: 1080,
            height: 1920,
            mimeType: "image/jpeg",
            storagePath: h.storagePath,
            evidenceRef: "evidence",
          }
        : { kind: "absent" };
    }
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: async (_path: string, _ttl: number, options?: unknown) => ({
          data: {
            signedUrl: options ? VERTICAL_DOWNLOAD : VERTICAL_URL,
          },
        }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

import CampaignDetailPage from "../page";

function campaignRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    store_id: STORE_ID,
    product_name: "Produto teste",
    status: "ready",
    input_snapshot: {},
    identity_snapshot: null,
    generation_metadata: null,
    render_snapshot: null,
    publication_copy_snapshot: null,
    publication_copy_current: null,
    storage_path: null,
    error_message: null,
    approval_status: "approved",
    rejection_count: 0,
    approved_version_id: null,
    approved_at: null,
    operation_run_id: null,
    created_at: "2026-11-23T00:00:00.000Z",
    updated_at: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

function addition(state: "delivered" | "processing" | "unknown" | "refunded") {
  return {
    kind: "found",
    addition: {
      state,
      sourceOrigin: "legacy_campaign",
      refunded: state === "refunded",
      operationId: ADDITION_OPERATION,
      requestId: "44444444-4444-4444-8444-444444444444",
      sourceArtifactId: null,
      sourceRegistrationOperationId: null,
      createdAt: null,
    },
  };
}

async function props(format?: string) {
  const element = (await CampaignDetailPage({
    params: Promise.resolve({ id: CAMPAIGN_ID }),
    searchParams: Promise.resolve(format === undefined ? {} : { format }),
  })) as unknown as { props: Record<string, unknown> };
  return element.props;
}

function presentation(value: Record<string, unknown>) {
  return value.formatPresentation as {
    formats: Record<"1:1" | "9:16", { state: string; active: boolean; refunded: boolean }>;
  };
}

beforeEach(() => {
  h.campaign = campaignRecord();
  h.addition = { kind: "none" };
  h.probe = "integral";
  h.storagePath = "vertical/path.jpg";
});

describe("F62-05 — detalhe seleciona a adição vertical", () => {
  it("?format=9:16 com adição entregue exibe preview/download vertical", async () => {
    h.addition = addition("delivered");
    const value = await props("9:16");

    expect(value.imageUrl).toBe(VERTICAL_URL);
    expect(value.newFlowFormat).toBe("9:16");
    expect(value.downloadUrl).toBe(VERTICAL_DOWNLOAD);
    expect(presentation(value).formats["9:16"]).toMatchObject({
      state: "delivered",
      active: true,
    });
    expect(value.formatHrefs).toMatchObject({
      "9:16": `/campanhas/${CAMPAIGN_ID}?format=9:16`,
    });
  });

  it("?format=1:1 e ausência mantêm o quadrado", async () => {
    h.addition = addition("delivered");
    for (const format of [undefined, "1:1"]) {
      const value = await props(format);
      expect(value.newFlowFormat).not.toBe("9:16");
      expect(presentation(value).formats["9:16"].active).toBe(false);
    }
  });

  it("adicional refundada falha fechado e não seleciona vertical", async () => {
    h.addition = addition("refunded");
    const value = await props("9:16");

    expect(value.newFlowFormat).not.toBe("9:16");
    expect(presentation(value).formats["9:16"]).toMatchObject({
      state: "absent",
      refunded: true,
      active: false,
    });
  });

  it("processing/unknown/read_failed não exibem preview vertical", async () => {
    for (const state of ["processing", "unknown"] as const) {
      h.addition = addition(state);
      const value = await props("9:16");
      expect(value.newFlowFormat).not.toBe("9:16");
      expect(presentation(value).formats["9:16"].state).toBe(state);
    }

    h.addition = { kind: "read_failed" };
    const value = await props("9:16");
    expect(value.newFlowFormat).not.toBe("9:16");
    expect(presentation(value).formats["9:16"].state).toBe("unknown");
  });

  it("artefato ausente na leitura entregue mantém o quadrado", async () => {
    h.addition = addition("delivered");
    h.probe = "absent";
    const value = await props("9:16");
    expect(value.imageUrl).not.toBe(VERTICAL_URL);
    expect(presentation(value).formats["9:16"].active).toBe(false);
  });
});
