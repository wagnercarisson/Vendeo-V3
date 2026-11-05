// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: vi.fn(async () => ({ userId: "user-1" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async () => ({ id: "store-1", user_id: "user-1" })),
}));
vi.mock("@/lib/store-readiness", () => ({
  getStoreReadiness: vi.fn(async () => ({ ready: true, missing: [] })),
}));
vi.mock("@/lib/legal/clearance", () => ({
  requireLegalClearance: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: class {
    getBalance = vi.fn(async () => 10);
  },
}));
vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: () => ({ generationPaused: false }),
}));
vi.mock("@/lib/store-identity-service", () => ({
  resolveStoreIdentity: vi.fn(async () => ({})),
  validateIdentityReference: vi.fn(async () => ({})),
}));
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: vi.fn((store: unknown) => store),
}));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    getCampaignOperation = vi.fn(async () => ({ operationId: "op-1" }));
  },
}));
vi.mock("@/lib/product-1-1/snapshot/persist-snapshot", () => ({
  readProductOneToOneBackgroundDirection: vi.fn(async () => "studio"),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({})),
  supabaseAdmin: {},
}));

const { mockIsProduct9x16Enabled } = vi.hoisted(() => ({
  mockIsProduct9x16Enabled: vi.fn(async () => false),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  FeatureFlagService: class {
    isProduct9x16Enabled = mockIsProduct9x16Enabled;
  },
}));

const { mockGetCampaignForDisplay, mockMapRestoredForm } = vi.hoisted(() => ({
  mockGetCampaignForDisplay: vi.fn(),
  mockMapRestoredForm: vi.fn(),
}));
vi.mock("@/lib/campaign/display", () => ({
  getCampaignForDisplay: mockGetCampaignForDisplay,
  mapRestoredForm: mockMapRestoredForm,
}));

const { mockCampaignPageClient } = vi.hoisted(() => ({
  mockCampaignPageClient: () => null,
}));
vi.mock("@/components/flow/campaign-page-client", () => ({
  CampaignPageClient: mockCampaignPageClient,
}));

import NovaCampanhaPage from "@/app/(app)/campanhas/nova/page";

const RESTORE = {
  campaignId: "campaign-1",
  productName: "Produto F59",
  description: "",
  originalPriceCents: 0,
  badge: "",
  campaignIntent: "offer" as const,
  preserveImageContext: false,
  mandatoryArtworkTextFree: "",
  referenceSelections: [],
  imageRestoreLimited: true as const,
};

type PageElement = {
  props: {
    children: {
      props: Record<string, unknown>;
    };
  };
};

async function renderPage(): Promise<PageElement> {
  mockGetCampaignForDisplay.mockResolvedValue({
    id: "campaign-1",
    store_id: "store-1",
    input_snapshot: { frozenContentReferences: [] },
    identity_snapshot: null,
  });
  return (await NovaCampanhaPage({
    searchParams: Promise.resolve({ restoreFrom: "campaign-1" }),
  })) as unknown as PageElement;
}

describe("F59/59-08 — página nova pausa o rascunho vertical", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsProduct9x16Enabled.mockResolvedValue(false);
    mockMapRestoredForm.mockReturnValue({
      ...RESTORE,
      campaignFormat: "9:16",
      formatContractVersion: "f59-vertical-9-16-v1",
      formatUnavailable: false,
    });
  });

  it("vertical + flag OFF ⇒ campaignFormatPaused true e formato preservado", async () => {
    const element = await renderPage();
    expect(element.props.children.props).toMatchObject({
      verticalEnabled: false,
      campaignFormatPaused: true,
      campaignFormatUnavailable: false,
      restoredForm: { campaignFormat: "9:16" },
    });
  });

  it("vertical + flag ON ⇒ não pausa", async () => {
    mockIsProduct9x16Enabled.mockResolvedValue(true);
    const element = await renderPage();
    expect(element.props.children.props).toMatchObject({
      verticalEnabled: true,
      campaignFormatPaused: false,
    });
  });

  it("formato indisponível ⇒ pausa mesmo sem vertical", async () => {
    mockMapRestoredForm.mockReturnValue({
      ...RESTORE,
      formatUnavailable: true,
      formatUnavailableReason: "incoherent_pair",
    });
    const element = await renderPage();
    expect(element.props.children.props).toMatchObject({
      campaignFormatPaused: true,
      campaignFormatUnavailable: true,
    });
  });
});
