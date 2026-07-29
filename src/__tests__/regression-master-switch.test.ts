import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockStoreFrom } = vi.hoisted(() => ({ mockStoreFrom: vi.fn() }));
const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockStoreFrom, rpc: mockRpc },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/legal/clearance", () => ({ requireLegalClearance: vi.fn().mockResolvedValue({ ok: true }) }));

vi.mock("@/lib/store-identity-service", () => ({
  resolveStoreIdentity: vi.fn(),
  validateIdentityReference: vi.fn(),
  buildCampaignBrief: vi.fn(),
}));

const { mockCreateCampaign } = vi.hoisted(() => ({ mockCreateCampaign: vi.fn() }));
const { mockUploadCampaignImage } = vi.hoisted(() => ({ mockUploadCampaignImage: vi.fn() }));
const { mockUpdateCampaignReady } = vi.hoisted(() => ({ mockUpdateCampaignReady: vi.fn() }));
const { mockDataUrlToCampaignImage } = vi.hoisted(() => ({ mockDataUrlToCampaignImage: vi.fn() }));
vi.mock("@/lib/campaign/persistence", () => ({
  createCampaign: mockCreateCampaign,
  dataUrlToCampaignImage: mockDataUrlToCampaignImage,
  uploadCampaignImage: mockUploadCampaignImage,
  updateCampaignReady: mockUpdateCampaignReady,
  updateCampaignError: vi.fn(),
  deleteCampaignImage: vi.fn(),
}));

const { mockTranscodeToJpeg } = vi.hoisted(() => ({ mockTranscodeToJpeg: vi.fn() }));
vi.mock("@/lib/campaign/image-processor", () => ({
  transcodeToJpeg: mockTranscodeToJpeg,
  buildPublicationCopySnapshot: vi.fn(),
}));

vi.mock("@/lib/image-generation/config", () => ({
  IMAGE_GENERATION_GLOBAL_TIMEOUT_MS: 300000,
  MAX_PRODUCT_IMAGE_BASE64_SIZE: 5 * 1024 * 1024,
  IMAGE_GENERATION_RESPONSES_MODEL: "test-model",
  COST_PER_GENERATION: 1,
}));

const { mockGenerateImageResult } = vi.hoisted(() => ({ mockGenerateImageResult: vi.fn() }));
const { mockValidatePrompts } = vi.hoisted(() => ({ mockValidatePrompts: vi.fn() }));
vi.mock("@/lib/image-generation/services/image-generation-service", () => ({
  ImageGenerationService: vi.fn(function () {
    return { generateImage: mockGenerateImageResult, validatePrompts: mockValidatePrompts };
  }),
}));

vi.mock("@/lib/image-generation/services/input-validation-service", () => ({
  InputValidationService: vi.fn(function () {
    return { validate: vi.fn(async () => ({ classification: "ok" })) };
  }),
}));

vi.mock("@/lib/image-generation/providers/factory", () => ({
  createImageProvider: vi.fn(() => ({ name: "test" })),
}));

vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn(() => {}) }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(() => Promise.resolve({ userId: "00000000-0000-0000-0000-000000000002" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({ requireOwnership: vi.fn(() => Promise.resolve()) }));

const { mockCheckRateLimit } = vi.hoisted(() => ({ mockCheckRateLimit: vi.fn() }));
const { mockRecordGenerationAttempt } = vi.hoisted(() => ({ mockRecordGenerationAttempt: vi.fn() }));
vi.mock("@/lib/rate-limit/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  recordGenerationAttempt: mockRecordGenerationAttempt,
}));

const { mockGetBalance } = vi.hoisted(() => ({ mockGetBalance: vi.fn() }));
const { mockReserveCredit } = vi.hoisted(() => ({ mockReserveCredit: vi.fn() }));
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: vi.fn(function () {
    return {
      getBalance: mockGetBalance,
      reserveCredit: mockReserveCredit,
      confirmCredit: vi.fn(),
      refundCredit: vi.fn(),
    };
  }),
}));

const { mockGenerateCopy } = vi.hoisted(() => ({ mockGenerateCopy: vi.fn() }));
vi.mock("@/lib/copy/copy-director-service", () => ({
  CopyDirectorService: vi.fn(function () { return { generateCopy: mockGenerateCopy }; }),
}));

vi.mock("@/lib/text-provider/factory", () => ({ createTextProvider: vi.fn(() => ({ name: "test" })) }));
vi.mock("@/lib/copy/mapper", () => ({
  mapBriefToCopyDirectorInput: vi.fn(() => ({
    productName: "Test", description: "Test description", offer: "Test offer",
    storeName: "Test Store", segment: "test",
  })),
  buildOfferText: vi.fn(() => "Oferta: R$ 19,90"),
}));

import { POST } from "@/app/api/campaign/generate-image/route";

const STORE_ID = "00000000-0000-0000-0000-000000000001";
const VALID_BODY = {
  storeId: STORE_ID, productName: "Produto Teste", discountedPriceCents: 1990,
  badgeText: "Oferta", productImageDataUrl: "data:image/jpeg;base64,abc",
};

function makeRequest(): NextRequest {
  return new NextRequest(new Request("http://localhost/api/campaign/generate-image", {
    method: "POST", body: JSON.stringify(VALID_BODY),
    headers: { "Content-Type": "application/json" },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: { ready: true, missing: [] }, error: null });
  mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: { hourly: 9, daily: 29 } });
  mockRecordGenerationAttempt.mockResolvedValue(undefined);
  mockGetBalance.mockResolvedValue(5);
  mockReserveCredit.mockResolvedValue("tx-001");
  mockGenerateCopy.mockResolvedValue({
    title: "Oferta Imperdível", caption: "Aproveite esta oferta especial",
    cta_post: "Compre agora", hashtags: ["#oferta", "#promocao"],
  });
  mockGenerateImageResult.mockResolvedValue({ success: true, imageDataUrl: "data:image/jpeg;base64,success" });
  mockCreateCampaign.mockResolvedValue({ id: "00000000-0000-0000-0000-000000000003", storagePath: "test/path.jpg" });
  mockUploadCampaignImage.mockResolvedValue(undefined);
  mockUpdateCampaignReady.mockResolvedValue(undefined);
  mockDataUrlToCampaignImage.mockReturnValue({ buffer: Buffer.from("test"), mimeType: "image/jpeg" });
  mockTranscodeToJpeg.mockResolvedValue(Buffer.from("test"));

  mockStoreFrom.mockImplementation((table: string) => {
    if (table === "generation_rate_events") {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ gte: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
      };
    }
    if (table === "credit_balances") {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { balance: 5 }, error: null })) })) })),
      };
    }
    if (table === "stores") {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: "Loja Teste", segment: "outros" }, error: null })) })) })),
      };
    }
    if (table === "generation_events") {
      return { insert: vi.fn(() => Promise.resolve({ error: null })) };
    }
    return {};
  });
});

describe("Regression: master switch", () => {
  it("generationPaused=true returns 503 before any operation", async () => {
    vi.stubEnv("VENDEO_GENERATION_PAUSED", "true");
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.message).toContain("indisponível");
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockGetBalance).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("v15Enabled=false runs as v1.4 (no credit, no copy, no rate limit)", async () => {
    vi.stubEnv("VENDEO_V15_ENABLED", "false");
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(mockGetBalance).not.toHaveBeenCalled();
    expect(mockReserveCredit).not.toHaveBeenCalled();
    expect(mockGenerateCopy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
