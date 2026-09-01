// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mutable mock implementations ──────────────────────────────────────────
const mockSupabaseFrom = vi.fn();
let mockRequireApiUserImpl = vi.fn();
let mockRequireOwnershipImpl = vi.fn();
let mockCreateCampaignImpl = vi.fn();
let mockDataUrlToCampaignImageImpl = vi.fn();
let mockUploadCampaignImageImpl = vi.fn();
let mockUploadCampaignInputImageImpl = vi.fn();
let mockRemoveCampaignInputsImpl = vi.fn();
let mockUpdateCampaignReadyImpl = vi.fn();
let mockUpdateCampaignErrorImpl = vi.fn();
let mockDeleteCampaignImageImpl = vi.fn();
let mockTranscodeToJpegImpl = vi.fn();
let mockBuildPublicationCopySnapshotImpl = vi.fn();
let mockResolveStoreIdentityImpl = vi.fn();
let mockValidateIdentityReferenceImpl = vi.fn();
let mockBuildCampaignBriefImpl = vi.fn();
let mockCreateImageProviderImpl = vi.fn();
let mockGenerateImageImpl = vi.fn();
let mockGenerateCopyImpl = vi.fn();

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("server-only", () => ({}));

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    rpc: mockRpc,
  },
}));

vi.mock("@/lib/legal/clearance", () => ({ requireLegalClearance: vi.fn().mockResolvedValue({ ok: true }) }));

vi.mock("@/lib/auth/errors", () => {
  class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") { super(message); this.name = "UnauthorizedError"; }
  }
  class StoreNotFoundError extends Error {
    constructor(message = "Store not found or access denied") { super(message); this.name = "StoreNotFoundError"; }
  }
  class ForbiddenError extends Error {
    constructor(message = "Forbidden") { super(message); this.name = "ForbiddenError"; }
  }
  return { UnauthorizedError, StoreNotFoundError, ForbiddenError };
});

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => mockRequireApiUserImpl()),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async (storeId: string, userId: string) =>
    mockRequireOwnershipImpl(storeId, userId)
  ),
  StoreNotFoundError: class StoreNotFoundError extends Error {
    constructor(message = "Store not found or access denied") {
      super(message);
      this.name = "StoreNotFoundError";
    }
  },
}));

vi.mock("@/lib/campaign/persistence", () => ({
  createCampaign: mockCreateCampaignImpl,
  dataUrlToCampaignImage: mockDataUrlToCampaignImageImpl,
  uploadCampaignImage: mockUploadCampaignImageImpl,
  uploadCampaignInputImage: mockUploadCampaignInputImageImpl,
  removeCampaignInputs: mockRemoveCampaignInputsImpl,
  updateCampaignReady: mockUpdateCampaignReadyImpl,
  updateCampaignError: mockUpdateCampaignErrorImpl,
  deleteCampaignImage: mockDeleteCampaignImageImpl,
}));

vi.mock("@/lib/campaign/image-processor", () => ({
  transcodeToJpeg: mockTranscodeToJpegImpl,
  buildPublicationCopySnapshot: mockBuildPublicationCopySnapshotImpl,
}));

vi.mock("@/lib/store-identity-service", () => ({
  resolveStoreIdentity: vi.fn(async () => mockResolveStoreIdentityImpl()),
  validateIdentityReference: vi.fn(async () => mockValidateIdentityReferenceImpl()),
  buildCampaignBrief: vi.fn(async () => mockBuildCampaignBriefImpl()),
}));

vi.mock("@/lib/image-generation/providers/factory", () => ({
  createImageProvider: vi.fn(() => mockCreateImageProviderImpl()),
}));

const MockImageGenerationService = vi.fn(function () {
  return {
    generateImage: vi.fn(async (_brief: any, _context: any, onPhaseChange?: (event: any) => void) => {
      if (onPhaseChange) {
        onPhaseChange({ phase: "input_validation", status: "complete" });
        onPhaseChange({ phase: "done", status: "complete" });
      }
      return mockGenerateImageImpl();
    }),
    validatePrompts: vi.fn(() => ({ valid: true, errors: [] })),
  };
});
vi.mock("@/lib/image-generation/services/image-generation-service", () => ({
  ImageGenerationService: MockImageGenerationService,
}));

vi.mock("@/lib/image-generation/services/input-validation-service", () => ({
  InputValidationService: vi.fn().mockImplementation(() => ({
    validate: vi.fn(),
  })),
}));

const MockCopyDirectorService = vi.fn(function () {
  return {
    generateCopy: vi.fn(async () => mockGenerateCopyImpl()),
  };
});
vi.mock("@/lib/copy/copy-director-service", () => ({
  CopyDirectorService: MockCopyDirectorService,
}));

vi.mock("@/lib/text-provider/factory", () => ({
  createTextProvider: vi.fn(() => ({ name: "test-provider" })),
}));

vi.mock("@/lib/copy/mapper", () => ({
  mapBriefToCopyDirectorInput: vi.fn(() => ({
    productName: "Test",
    description: "Test description",
    offer: "Test offer",
    storeName: "Test Store",
    segment: "test",
  })),
}));

vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: vi.fn(function() {
    return {
      getBalance: vi.fn(async () => 10),
      reserveCredit: vi.fn(async () => "tx-1"),
      confirmCredit: vi.fn(async () => {}),
      refundCredit: vi.fn(async () => {}),
    };
  }),
}));

vi.mock("@/lib/image-generation/config", () => ({
  IMAGE_GENERATION_GLOBAL_TIMEOUT_MS: 300000,
  MAX_PRODUCT_IMAGE_BASE64_SIZE: 4 * 1024 * 1024,
  MAX_CAMPAIGN_IMAGES: 4,
  IMAGE_GENERATION_RESPONSES_MODEL: "test-model",
}));

const { mockGetCost } = vi.hoisted(() => ({ mockGetCost: vi.fn() }));
vi.mock("@/lib/credit/operation-cost-service", () => ({
  OperationCostService: vi.fn(function () {
    return { getCost: mockGetCost };
  }),
  OperationCostUnavailableError: class extends Error {},
  DEFAULT_OPERATION_COSTS: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
}));

// ── Constants ──────────────────────────────────────────────────────────────
const STORE_UUID = "550e8400-e29b-41d4-a716-446655440000";
const CAMPAIGN_UUID = "660e8400-e29b-41d4-a716-446655440001";
const IDENTITY_SNAPSHOT = {
  storeName: "Test Store",
  storeSegment: "variedades-utilidades",
  brandColor: "#22C55E",
  identityState: "text_only",
  signature: { url: null, type: null },
  storeInitials: "TS",
  brandProfile: null,
  toneOfVoice: null,
  subsegment: null,
  positioning: null,
  shortDescription: null,
  slogan: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function createGenerateRequest(overrides?: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/campaign/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: STORE_UUID,
      productName: "Test Product",
      discountedPriceCents: 1990,
      badgeText: "10% OFF",
      productImageDataUrl: "data:image/jpeg;base64,/9j/4AAQ==",
      inputValidationOverride: { productImageCheck: "user_confirmed_continue" },
      ...overrides,
    }),
  });
}

async function readNdjsonBody(response: Response): Promise<Record<string, unknown>[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Record<string, unknown>[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) events.push(JSON.parse(line));
    }
  }
  return events;
}

// ── Setup defaults ─────────────────────────────────────────────────────────

function setupSuccessMocks(): void {
  mockRequireApiUserImpl.mockResolvedValue({
    userId: "user-123",
    claims: { sub: "user-123" },
  });
  mockRequireOwnershipImpl.mockResolvedValue({ id: "store-1" });

  mockSupabaseFrom.mockImplementation((_table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({
        data: { id: STORE_UUID, name: "Test Store", segment: "variedades-utilidades", brand_color: "#22C55E", identity_state: "text_only" },
        error: null,
      })),
      gte: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    };
    return chain;
  });

  mockResolveStoreIdentityImpl.mockResolvedValue(IDENTITY_SNAPSHOT);
  mockValidateIdentityReferenceImpl.mockResolvedValue(IDENTITY_SNAPSHOT);
  mockBuildCampaignBriefImpl.mockResolvedValue({
    campaignInput: { productName: "Test Product" },
    store: { name: "Test Store", segment: "variedades-utilidades" },
    identity: { state: "text_only", imageUrl: null, directive: "" },
  });

  mockCreateCampaignImpl.mockResolvedValue({
    id: CAMPAIGN_UUID,
    storagePath: `${STORE_UUID}/${CAMPAIGN_UUID}.jpg`,
  });

  mockCreateImageProviderImpl.mockReturnValue({ name: "test-provider" });
  mockGenerateCopyImpl.mockResolvedValue({
    title: "Promoção Imperdível",
    hook: "Aproveite agora!",
    description: "Descrição da campanha",
    ctaPost: "Compre já",
    ctaStory: "Saiba mais",
    applicableProducts: [],
    campaignDetails: "",
  });
  mockGenerateImageImpl.mockResolvedValue({
    success: true,
    imageDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  });

  mockDataUrlToCampaignImageImpl.mockReturnValue({
    buffer: Buffer.from("test-image-data"),
    mimeType: "image/png",
  });

  mockTranscodeToJpegImpl.mockResolvedValue({
    buffer: Buffer.from("jpeg-data"),
    mimeType: "image/jpeg",
  });

  mockUploadCampaignImageImpl.mockResolvedValue({
    storagePath: `${STORE_UUID}/${CAMPAIGN_UUID}.jpg`,
  });

  mockUploadCampaignInputImageImpl.mockResolvedValue({
    storagePath: `${STORE_UUID}/${CAMPAIGN_UUID}/inputs/x.jpg`,
  });
  mockRemoveCampaignInputsImpl.mockResolvedValue(undefined);

  mockBuildPublicationCopySnapshotImpl.mockImplementation((data: any) => data);

  mockUpdateCampaignReadyImpl.mockResolvedValue(undefined);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/campaign/generate-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockRpc.mockResolvedValue({ data: { ready: true, missing: [] }, error: null });
    mockGetCost.mockResolvedValue({
      operationKey: "campaign_generation",
      costCredits: 1,
      enabled: true,
      source: "table",
    });
  });

  it("returns 200+result NDJSON on full success", async () => {
    setupSuccessMocks();

    const { POST } = await import(
      "@/app/api/campaign/generate-image/route"
    );
    const response = await POST(createGenerateRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson");

    const events = await readNdjsonBody(response);

    // Find the result event
    const resultEvent = events.find((e) => e.type === "result");
    expect(resultEvent).toBeDefined();
    expect(resultEvent!.campaignId).toBe(CAMPAIGN_UUID);
    expect(resultEvent!.campaignUrl).toBe(`/campanhas/${CAMPAIGN_UUID}`);

    // Verify pipeline ran
    expect(mockCreateCampaignImpl).toHaveBeenCalledTimes(1);
    // F41 D5: dataUrlToCampaignImage chamado no upload do input (pré-snapshot) + upload final (pós-paralelo)
    expect(mockDataUrlToCampaignImageImpl).toHaveBeenCalledTimes(2);
    expect(mockTranscodeToJpegImpl).toHaveBeenCalledTimes(1);
    expect(mockUploadCampaignInputImageImpl).toHaveBeenCalledTimes(1);
    expect(mockUploadCampaignImageImpl).toHaveBeenCalledTimes(1);
    expect(mockUpdateCampaignReadyImpl).toHaveBeenCalledTimes(1);
    // Error compensation should NOT be called on success
    expect(mockUpdateCampaignErrorImpl).not.toHaveBeenCalled();
    expect(mockDeleteCampaignImageImpl).not.toHaveBeenCalled();
  });

  it("returns error NDJSON + updateCampaignError on IA failure", async () => {
    setupSuccessMocks();
    mockGenerateImageImpl.mockResolvedValue({
      success: false,
      code: "provider_error",
      message: "IA provider failed",
    });

    const { POST } = await import(
      "@/app/api/campaign/generate-image/route"
    );
    const response = await POST(createGenerateRequest());

    expect(response.status).toBe(200);

    const events = await readNdjsonBody(response);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.campaignId).toBe(CAMPAIGN_UUID);
    expect(errorEvent!.code).toBe("generation_failed");

    // updateCampaignError should have been called with the IA error message
    expect(mockUpdateCampaignErrorImpl).toHaveBeenCalledWith(
      CAMPAIGN_UUID,
      "IA provider failed"
    );
    // Pipeline should NOT proceed beyond IA (input upload D5 já ocorreu — 1 chamada)
    expect(mockDataUrlToCampaignImageImpl).toHaveBeenCalledTimes(1);
    expect(mockUploadCampaignImageImpl).not.toHaveBeenCalled();
    expect(mockUpdateCampaignReadyImpl).not.toHaveBeenCalled();
    // No image to clean up
    expect(mockDeleteCampaignImageImpl).not.toHaveBeenCalled();
  });

  it("returns error NDJSON + updateCampaignError on upload failure", async () => {
    setupSuccessMocks();
    mockUploadCampaignImageImpl.mockRejectedValue(
      new Error("Upload failed: network error")
    );

    const { POST } = await import(
      "@/app/api/campaign/generate-image/route"
    );
    const response = await POST(createGenerateRequest());

    expect(response.status).toBe(200);

    const events = await readNdjsonBody(response);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.campaignId).toBe(CAMPAIGN_UUID);
    expect(errorEvent!.phase).toBe("upload");

    // updateCampaignError should be called
    expect(mockUpdateCampaignErrorImpl).toHaveBeenCalledWith(
      CAMPAIGN_UUID,
      expect.stringContaining("Upload failed")
    );
    // deleteCampaignImage should NOT be called (no image in storage)
    expect(mockDeleteCampaignImageImpl).not.toHaveBeenCalled();
    // Pipeline should NOT reach updateReady
    expect(mockUpdateCampaignReadyImpl).not.toHaveBeenCalled();
  });

  it("returns error NDJSON + delete+update on updateReady failure", async () => {
    setupSuccessMocks();
    mockUpdateCampaignReadyImpl.mockRejectedValue(
      new Error("DB update failed")
    );

    const { POST } = await import(
      "@/app/api/campaign/generate-image/route"
    );
    const response = await POST(createGenerateRequest());

    expect(response.status).toBe(200);

    const events = await readNdjsonBody(response);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.campaignId).toBe(CAMPAIGN_UUID);
    expect(errorEvent!.phase).toBe("update");

    // Both deleteCampaignImage AND updateCampaignError should be called
    expect(mockDeleteCampaignImageImpl).toHaveBeenCalledTimes(1);
    expect(mockDeleteCampaignImageImpl).toHaveBeenCalledWith(
      `${STORE_UUID}/${CAMPAIGN_UUID}.jpg`
    );
    expect(mockUpdateCampaignErrorImpl).toHaveBeenCalledWith(
      CAMPAIGN_UUID,
      expect.stringContaining("DB update failed")
    );
  });

  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/errors");
    mockRequireApiUserImpl.mockRejectedValue(
      new UnauthorizedError("Usuário não autenticado")
    );

    const { POST } = await import(
      "@/app/api/campaign/generate-image/route"
    );
    const response = await POST(createGenerateRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Usuário não autenticado");

    // No INSERT should happen without auth
    expect(mockCreateCampaignImpl).not.toHaveBeenCalled();
  });

  it("returns 404 when ownership fails", async () => {
    const { StoreNotFoundError } = await import("@/lib/auth/errors");
    mockRequireApiUserImpl.mockResolvedValue({
      userId: "user-123",
      claims: { sub: "user-123" },
    });
    mockRequireOwnershipImpl.mockRejectedValue(
      new StoreNotFoundError("Store not found or access denied")
    );

    const { POST } = await import(
      "@/app/api/campaign/generate-image/route"
    );
    const response = await POST(createGenerateRequest());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Store not found or access denied");

    // No INSERT should happen without ownership
    expect(mockCreateCampaignImpl).not.toHaveBeenCalled();
  });
});
