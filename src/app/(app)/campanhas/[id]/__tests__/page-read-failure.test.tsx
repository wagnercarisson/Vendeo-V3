// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const USER_ID = "00000000-0000-4000-8000-000000000001";
const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
  createServerClient: vi.fn(async () => ({})),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: vi.fn(async () => ({ userId: USER_ID })),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async () => ({ id: STORE_ID })),
}));

vi.mock("@/lib/campaign/persistence", () => ({
  listArtVersions: vi.fn(async () => []),
}));

const { mockApprovalEnabled } = vi.hoisted(() => ({
  mockApprovalEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: mockApprovalEnabled,
}));

vi.mock("@/lib/campaign/correction-reports", () => ({
  getCorrectionReport: vi.fn(async () => null),
}));

const { mockGetCampaignForDisplay, mockGenerateSignedPreviewUrl } = vi.hoisted(() => ({
  mockGetCampaignForDisplay: vi.fn(),
  mockGenerateSignedPreviewUrl: vi.fn(async () => "https://signed.example/x.jpg"),
}));
vi.mock("@/lib/campaign/display", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign/display")>();
  return {
    ...actual,
    getCampaignForDisplay: mockGetCampaignForDisplay,
    generateSignedPreviewUrl: mockGenerateSignedPreviewUrl,
  };
});

const { mockGetCampaignOperation } = vi.hoisted(() => ({ mockGetCampaignOperation: vi.fn() }));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    getCampaignOperation(id: string) {
      return mockGetCampaignOperation(id);
    }
  },
}));

const { mockProbeArtifact } = vi.hoisted(() => ({ mockProbeArtifact: vi.fn() }));
vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: class {
    probeArtifact(input: unknown) {
      return mockProbeArtifact(input);
    }
    getSignedArtifactUrl() {
      return Promise.resolve("https://signed.example/art.jpg");
    }
  },
}));

// O client é mockado: a página devolve `<CampaignPageClient {...props} />` e o
// teste inspeciona `props.newFlow` — o objetivo é provar a classificação do
// servidor (novo × legado × fail-closed), não o render do client.
vi.mock("../client", () => ({
  default: (props: Record<string, unknown>) => props,
}));

import CampaignDetailPage from "../page";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 06 (correção): a classificação NOVO × LEGADO usa a informação
// PERSISTIDA (`campaigns.input_snapshot.frozenContentReferences`), NUNCA o
// resultado (ou falha) da leitura da operação. Marcador presente + operação
// ilegível ⇒ FAIL-CLOSED (superfície segura), nunca telas legadas
// (`StaleView`/`ErrorView`) nem o gate F37.
// ---------------------------------------------------------------------------

function campaignRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    store_id: STORE_ID,
    status: "generating",
    product_name: "Produto Teste",
    input_snapshot: null,
    identity_snapshot: null,
    generation_metadata: null,
    render_snapshot: null,
    publication_copy_snapshot: null,
    publication_copy_current: null,
    storage_path: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
    error_message: null,
    approval_status: "pending_approval",
    rejection_count: 0,
    approved_version_id: null,
    approved_at: null,
    operation_run_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function renderPage(): Promise<{ props: { newFlow?: { state: string } } }> {
  return (await CampaignDetailPage({
    params: Promise.resolve({ id: CAMPAIGN_ID }),
  })) as unknown as { props: { newFlow?: { state: string } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApprovalEnabled.mockResolvedValue(false);
  mockGetCampaignOperation.mockResolvedValue(null);
  mockProbeArtifact.mockResolvedValue({ kind: "absent" });
  mockGenerateSignedPreviewUrl.mockResolvedValue("https://signed.example/x.jpg");
});

describe("campanhas/[id]/page — classificação PERSISTIDA do fluxo (correção)", () => {
  it("(a) marcador PERSISTIDO presente + leitura da operação FALHA ⇒ fail-closed (newFlow `unknown`), SEM telas legadas nem F37", async () => {
    mockGetCampaignForDisplay.mockResolvedValue(
      campaignRecord({ input_snapshot: { frozenContentReferences: [] } }),
    );
    mockGetCampaignOperation.mockRejectedValue(new Error("function does not exist"));

    const el = await renderPage();

    expect(el.props.newFlow).toBeTruthy();
    expect(el.props.newFlow?.state).toBe("unknown");
    // NÃO caiu no caminho legado (F37/approval não é consultada).
    expect(mockApprovalEnabled).not.toHaveBeenCalled();
  });

  it("(b) LEGADO PROVADO (marcador AUSENTE) + leitura da operação falha ⇒ caminho legado preservado (sem `newFlow`)", async () => {
    mockGetCampaignForDisplay.mockResolvedValue(
      campaignRecord({ input_snapshot: { productName: "Produto Teste" } }),
    );
    mockGetCampaignOperation.mockRejectedValue(new Error("RPC missing"));

    const el = await renderPage();

    // Legado: sem `newFlow` ⇒ o client renderiza as superfícies legadas atuais.
    expect(el.props.newFlow).toBeUndefined();
  });

  it("(c) marcador presente + operação LEGÍVEL ⇒ estado derivado da operação (gate do novo fluxo)", async () => {
    mockGetCampaignForDisplay.mockResolvedValue(
      campaignRecord({ input_snapshot: { frozenContentReferences: [] } }),
    );
    mockGetCampaignOperation.mockResolvedValue({
      operationId: OPERATION_ID,
      status: "delivered",
      unknown: false,
      terminal: true,
      supportReference: null,
    });

    const el = await renderPage();

    expect(el.props.newFlow?.state).toBe("delivered");
    expect(mockApprovalEnabled).not.toHaveBeenCalled();
  });

  it("classificação INDETERMINADA (snapshot malformado) ⇒ fail-closed (`unknown`)", async () => {
    mockGetCampaignForDisplay.mockResolvedValue(
      campaignRecord({ input_snapshot: "not-an-object" as unknown as Record<string, unknown> }),
    );
    mockGetCampaignOperation.mockResolvedValue(null);

    const el = await renderPage();

    expect(el.props.newFlow?.state).toBe("unknown");
  });
});
