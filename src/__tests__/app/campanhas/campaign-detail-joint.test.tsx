// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  view: null as unknown,
  controlResult: null as unknown,
  outcomesResult: null as unknown,
  attemptStartCalls: 0,
  campaign: {
    id: "22222222-2222-4222-8222-222222222222",
    store_id: "11111111-1111-4111-8111-111111111111",
    product_name: "Produto conjunto",
    created_at: "2026-11-19T00:00:00.000Z",
    status: "ready",
    storage_path: null,
    input_snapshot: {
      frozenContentReferences: [],
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
    },
    identity_snapshot: null,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: vi.fn(async () => ({ userId: "user-1" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async () => ({ id: h.campaign.store_id, user_id: "user-1" })),
}));
vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: vi.fn(async () => ({ ok: true, locale: "pt-BR" })),
}));
vi.mock("@/lib/campaign/display", () => ({
  getCampaignForDisplay: vi.fn(async () => h.campaign),
  mapCampaignToProps: vi.fn(() => ({
    imageUrl: null,
    caption: "",
    hashtags: [],
    ctaPost: "",
    displayStatus: "ready",
    productName: h.campaign.product_name,
    createdAt: h.campaign.created_at,
    updatedAt: h.campaign.created_at,
    downloadUrl: `/api/campaign/${h.campaign.id}/download`,
    campaignId: h.campaign.id,
    isPublicationCopyEdited: false,
    // Default FAIL-CLOSED (a página sobrescreve em todos os ramos reais).
    formatPresentation: {
      formats: {
        "1:1": { state: "unknown", refunded: false, reason: null, active: false },
        "9:16": { state: "unknown", refunded: false, reason: null, active: false },
      },
      flow: "single_format",
      partial: false,
      anyDelivered: false,
    },
  })),
  mapNewFlowDisplayState: vi.fn(() => "delivered"),
  mapNewFlowCopy: vi.fn(() => null),
  mapNewFlowCopyRecovery: vi.fn(() => null),
  mapRestoredForm: vi.fn(() => null),
  computeApprovalState: vi.fn(() => ({ status: "not_enabled" })),
  getActiveCandidateArtVersion: vi.fn(() => null),
  generateSignedPreviewUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  listArtVersions: vi.fn(async () => []),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    async getCampaignOperation() {
      h.attemptStartCalls += 1;
      return {
        operationId: "99999999-9999-4999-8999-999999999999",
        supportReference: null,
      };
    }
  },
}));
vi.mock("@/lib/product-1-1/copy/copy-state", () => ({
  readCopyDelivery: vi.fn(async () => null),
  readCopyCancellation: vi.fn(async () => null),
  readCopyRecoverySummary: vi.fn(async () => null),
}));
vi.mock("@/lib/product-two-format/delivery-reader", () => ({
  readTwoFormatDelivery: vi.fn(async () => ({ kind: "found", view: h.view })),
}));
vi.mock("@/lib/product-two-format/control-reader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/product-two-format/control-reader")>();
  return {
    ...actual,
    resolveTwoFormatControlOperation: vi.fn(async () => h.controlResult),
    readTwoFormatDurableOutcomes: vi.fn(async () => h.outcomesResult),
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({})),
  supabaseAdmin: {
    from: vi.fn(),
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed/${path}` },
          error: null,
        }),
      }),
    },
  },
}));
// (sem mock do client: lemos os props do elemento retornado pelo server component)

function VIEW() {
  const store = h.campaign.store_id;
  const campaign = h.campaign.id;
  const operation = "33333333-3333-4333-8333-333333333333";
  return {
    origin: "two_format_two_stage",
    campaignId: campaign,
    operationId: operation,
    square: {
      format: "1:1",
      state: "delivered",
      creditRefunded: false,
      deliveryOperationId: "44444444-4444-4444-8444-444444444444",
      artifactRole: "square_original",
      artifactPath: `${store}/${campaign}/${operation}/square_original.jpg`,
      supportReference: null,
    },
    vertical: {
      format: "9:16",
      state: "delivered",
      creditRefunded: false,
      deliveryOperationId: operation,
      artifactRole: "vertical",
      artifactPath: `${store}/${campaign}/${operation}/vertical.jpg`,
      supportReference: null,
    },
    preferredThumbnail: null,
  };
}

function setState(
  view: ReturnType<typeof VIEW>,
  format: "square" | "vertical",
  state: string,
): ReturnType<typeof VIEW> {
  const next = structuredClone(view) as unknown as {
    square: Record<string, unknown>;
    vertical: Record<string, unknown>;
  };
  const slot = next[format];
  slot.state = state;
  slot.creditRefunded = state === "absent";
  if (state !== "delivered") {
    slot.artifactRole = null;
    slot.artifactPath = null;
  }
  return next as unknown as ReturnType<typeof VIEW>;
}

async function renderPage(format?: string | string[]) {
  const { default: CampaignDetailPage } = await import(
    "@/app/(app)/campanhas/[id]/page"
  );
  const element = (await CampaignDetailPage({
    params: Promise.resolve({ id: h.campaign.id }),
    searchParams: Promise.resolve(format === undefined ? {} : { format }),
  })) as unknown as { props: Record<string, unknown> };
  return element.props;
}

beforeEach(() => {
  h.view = VIEW();
  h.controlResult = {
    kind: "found",
    operationId: "33333333-3333-4333-8333-333333333333",
  };
  h.outcomesResult = {
    kind: "found",
    unknownOperationIds: new Set<string>(),
    controlSupportReference: null,
  };
  h.attemptStartCalls = 0;
});

describe("F60.7 C3 — detalhe conjunto", () => {
  it("resolve a identidade de controle SEM a RPC financeira individual", async () => {
    const props = await renderPage("9:16");

    expect(h.attemptStartCalls).toBe(0);
    expect(props).toMatchObject({
      campaignId: h.campaign.id,
      jointFlow: true,
      newFlowFormat: "9:16",
      downloadDisabled: false,
      imageUrl:
        `https://signed/${h.campaign.store_id}/${h.campaign.id}/33333333-3333-4333-8333-333333333333/vertical.jpg`,
      joint: {
        formats: { "1:1": "delivered", "9:16": "delivered" },
        preferredFormat: "1:1",
        requestedFormat: "9:16",
        previewFormat: "9:16",
        state: "delivered",
      },
      formatPresentation: {
        flow: "two_format",
        partial: false,
        anyDelivered: true,
        formats: {
          "1:1": { state: "delivered", active: false, refunded: false },
          "9:16": { state: "delivered", active: true, refunded: false },
        },
      },
      formatHrefs: {
        "1:1": `/campanhas/${h.campaign.id}?format=1:1`,
        "9:16": `/campanhas/${h.campaign.id}?format=9:16`,
      },
      newFlow: expect.objectContaining({
        operationId: "33333333-3333-4333-8333-333333333333",
        state: "delivered",
      }),
    });
  });

  it("formato explícito não entregue não é substituído pelo irmão", async () => {
    h.view = setState(VIEW(), "square", "absent");

    const props = await renderPage("1:1");

    expect(props).toMatchObject({
      imageUrl: null,
      downloadDisabled: true,
      newFlowFormat: "1:1",
      joint: {
        formats: { "1:1": "absent", "9:16": "delivered" },
        preferredFormat: "9:16",
        requestedFormat: "1:1",
        previewFormat: null,
        previewUrl: null,
        state: "partial_terminal",
      },
      formatPresentation: {
        flow: "two_format",
        partial: true,
        anyDelivered: true,
        formats: {
          "1:1": {
            state: "absent",
            reason: "not_delivered",
            refunded: true,
            active: false,
          },
          "9:16": { state: "delivered", active: false, refunded: false },
        },
      },
      formatHrefs: {
        "9:16": `/campanhas/${h.campaign.id}?format=9:16`,
      },
    });
  });

  it("entregue + processando mostra a arte entregue como parcial", async () => {
    h.view = setState(VIEW(), "vertical", "processing");

    const props = await renderPage();

    expect(props).toMatchObject({
      imageUrl:
        `https://signed/${h.campaign.store_id}/${h.campaign.id}/33333333-3333-4333-8333-333333333333/square_original.jpg`,
      downloadDisabled: false,
      newFlowFormat: "1:1",
      joint: {
        formats: { "1:1": "delivered", "9:16": "processing" },
        preferredFormat: "1:1",
        previewFormat: "1:1",
        state: "partial_processing",
      },
      newFlow: expect.objectContaining({ state: "delivered" }),
    });
  });

  it("outcome durável unknown não vira processamento mesmo com crédito reservado", async () => {
    h.view = setState(VIEW(), "vertical", "processing");
    h.outcomesResult = {
      kind: "found",
      unknownOperationIds: new Set([
        "33333333-3333-4333-8333-333333333333",
      ]),
      controlSupportReference: "ref-123",
    };

    const props = await renderPage();

    expect(props).toMatchObject({
      joint: {
        formats: { "1:1": "delivered", "9:16": "unknown" },
        state: "partial_indeterminate",
      },
      newFlow: expect.objectContaining({
        state: "delivered",
        supportReference: "ref-123",
      }),
    });
  });

  it("controle entregue torna o unknown histórico inerte e preserva o quadrado pendente", async () => {
    h.view = setState(VIEW(), "square", "processing");
    h.outcomesResult = {
      kind: "found",
      unknownOperationIds: new Set([
        "33333333-3333-4333-8333-333333333333",
      ]),
      controlSupportReference: null,
    };

    const props = await renderPage();

    expect(props).toMatchObject({
      imageUrl:
        `https://signed/${h.campaign.store_id}/${h.campaign.id}/33333333-3333-4333-8333-333333333333/vertical.jpg`,
      newFlowFormat: "9:16",
      joint: {
        formats: { "1:1": "processing", "9:16": "delivered" },
        preferredFormat: "9:16",
        state: "partial_processing",
      },
      newFlow: expect.objectContaining({ state: "delivered" }),
    });
  });

  it("formato inválido/vazio/duplicado não cai no preferido", async () => {
    for (const format of ["bogus", "", ["1:1", "9:16"]]) {
      const props = await renderPage(format);
      expect(props).toMatchObject({
        imageUrl: null,
        downloadDisabled: true,
        joint: {
          requestedFormat: null,
          requestedFormatInvalid: true,
          previewFormat: null,
          previewUrl: null,
        },
        formatPresentation: {
          formats: {
            "1:1": { state: "delivered", active: false },
            "9:16": { state: "delivered", active: false },
          },
        },
      });
    }
  });

  it("controle ausente falha fechado sem chamar a RPC financeira", async () => {
    h.controlResult = { kind: "not_found" };

    const props = await renderPage();

    expect(h.attemptStartCalls).toBe(0);
    expect(props).toMatchObject({
      jointFlow: true,
      formatPresentation: {
        formats: {
          "1:1": { state: "unavailable", active: false },
          "9:16": { state: "unavailable", active: false },
        },
      },
      newFlow: expect.objectContaining({ state: "unknown", operationId: null }),
    });
  });
});
