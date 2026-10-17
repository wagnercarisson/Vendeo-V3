/**
 * F56.2b1b — correção de integração do Plano 04 (achados 1, 3, 4, 5, 6):
 * testes de ROTA COMPLETA exercitando a ROTA REAL
 * (`src/app/api/campaign/generate-image/route.ts`) JUNTO do ORQUESTRADOR REAL,
 * com os serviços EXTERNOS (Supabase/Storage/provider/crédito/tentativa/arte/
 * preflight/diagnóstico) mockados. Não é um teste apenas de orquestrador com
 * deps simulados: a rota é quem roteia e delega.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { resolveStoreIdentity, validateIdentityReference, buildCampaignBrief } from "@/lib/store-identity-service";
import { resolveIdentityImageAsDataUrl } from "@/lib/store-identity/identity-image";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => {
  const diagnoses = new Map<string, Record<string, unknown>>();
  return {
    diagnoses,
    mockFrom: vi.fn(),
    mockRpc: vi.fn(),
    diagnose: vi.fn(),
    getCampaignOperation: vi.fn(),
    acquire: vi.fn(),
    finish: vi.fn(),
    recordOperationOutcome: vi.fn(),
    creditReserve: vi.fn(),
    creditMarkArtUploaded: vi.fn(),
    creditDeliver: vi.fn(),
    creditRefund: vi.fn(),
    creditCloseFailedOperation: vi.fn(),
    creditBeginPublication: vi.fn(),
    creditMarkResultUnknown: vi.fn(),
    creditGetPublicationEpoch: vi.fn(),
    resolvePilotSpendGate: vi.fn(),
    resolveImagePairCost: vi.fn(async (config: {
      primary: Record<string, unknown>;
      fallback: Record<string, unknown>;
    }) => ({
      primary: { ...config.primary, costUsd: 0.04, versionId: "fixture-pricing-v1", costSource: "pricing_table" },
      fallback: { ...config.fallback, costUsd: 0.06, versionId: "fixture-pricing-v1", costSource: "pricing_table" },
    })),
    storeArtifact: vi.fn(),
    probeArtifact: vi.fn(),
    gatewayInvoke: vi.fn(),
    gatewayHasFallback: vi.fn(async () => true),
    recordOperation: vi.fn(),
    createCampaign: vi.fn(),
    recordGenerationAttempt: vi.fn(),
    inputValidationValidate: vi.fn(async () => ({ classification: "ok" })),
    getBalance: vi.fn(async () => 10),
    getCost: vi.fn(async () => ({
      operationKey: "campaign_generation",
      costCredits: 1,
      enabled: true,
      source: "table",
    })),
  };
});

// ── Supabase/Storage — externo mockado ───────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: h.mockFrom, rpc: h.mockRpc, storage: { from: vi.fn() } },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/product-1-1/pilot/resolve-pilot-spend-gate", () => ({
  resolvePilotSpendGate: (input: unknown) => h.resolvePilotSpendGate(input),
  resolvePilotCopyEstimatedUsd: () => 0.05,
}));

vi.mock("@/lib/ai-cost/image-pair-pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-cost/image-pair-pricing")>();
  return { ...actual, resolveImagePairCost: (config: any) => h.resolveImagePairCost(config) };
});

// ── Serviços EXTERNOS do orquestrador (mockados) ─────────────────────────────
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    getCampaignOperation = h.getCampaignOperation;
    acquire = h.acquire;
    finish = h.finish;
    recordOperationOutcome = h.recordOperationOutcome;
  },
}));

vi.mock("@/lib/product-1-1/credit-operation/credit-operation-client", () => ({
  ProductOneToOneCreditOperationClient: class {
    reserve = h.creditReserve;
    markArtUploaded = h.creditMarkArtUploaded;
    deliver = h.creditDeliver;
    refund = h.creditRefund;
    closeFailedOperation = h.creditCloseFailedOperation;
    beginPublication = h.creditBeginPublication;
    markResultUnknown = h.creditMarkResultUnknown;
    getPublicationEpoch = h.creditGetPublicationEpoch;
  },
}));

vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: class {
    storeArtifact = h.storeArtifact;
    probeArtifact = h.probeArtifact;
  },
}));

vi.mock("@/lib/ai/upstream-images-runtime", () => ({
  createNewFlowImageGateway: vi.fn(() => ({
    invoke: h.gatewayInvoke,
    hasFallback: h.gatewayHasFallback,
  })),
}));

vi.mock("@/lib/product-1-1/orchestration/preflight", () => ({
  runNewFlowPreflight: vi.fn(async () => ({
    config: {
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
      origin: "human_decision",
      configVersionId: "55555555-5555-4555-8555-555555555555",
    },
    pricing: { pricingCoverage: "complete", missingComponents: [] },
  })),
  NewFlowPreflightError: class extends Error {},
}));

vi.mock("@/lib/product-1-1/snapshot/persist-snapshot", () => ({
  buildProductOneToOneSnapshot: vi.fn(() => ({
    campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    primaryModel: "gpt-image-2.5-sunburst",
    primaryQuality: "medium",
    fallbackModel: "gpt-image-2",
    fallbackQuality: "medium",
    configVersionId: "55555555-5555-4555-8555-555555555555",
    origin: "human_decision",
    createdAt: "2026-10-12T00:00:00.000Z",
  })),
  buildProductOneToOneFrozenEvidence: vi.fn((input: unknown) => input),
  persistProductOneToOneSnapshot: vi.fn(async () => ({
    snapshotOriginalId: "44444444-4444-4444-8444-444444444444",
    reused: false,
  })),
}));

vi.mock("@/lib/product-1-1/prompt-composition", () => ({
  PROMPT_BLOCK_LABELS: { identity: "IDENTIDADE E DIREÇÃO VISUAL" },
  composeProductPrompt: vi.fn(() => ({
    text: "prompt-composicao",
    blocks: {},
    composerVersion: "48.2.4-prompt-composer-v6",
    promptBaseVersion: "48.2.6-produto-1-1-v1",
    policyVersions: {},
  })),
}));

// `recordAttempt` (orquestrador) usa o repositório append-only — mockado.
vi.mock("@/lib/ai/image-generation-operations-repository", () => ({
  SupabaseImageGenerationOperationsRepository: class {
    recordOperation = h.recordOperation;
    listByOperationId = vi.fn(async () => []);
  },
}));

// (achado 6) diagnóstico durável correlacionado a IMG-001 — mockado com mapa.
vi.mock("@/lib/ai/image-generation-diagnosis-repository", () => ({
  SupabaseImageGenerationDiagnosisRepository: class {
    async recordDiagnosis(input: Record<string, unknown>) {
      const reference =
        (input.reference as string | undefined) ?? `ref-${h.diagnoses.size + 1}`;
      h.diagnoses.set(reference, { ...input, reference });
      return { reference };
    }
    async findByReference(reference: string) {
      return h.diagnoses.get(reference) ?? null;
    }
  },
}));

// ── Serviços da própria rota (mockados) ──────────────────────────────────────
vi.mock("@/lib/legal/clearance", () => ({
  requireLegalClearance: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/rate-limit/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: {}, resetTime: null })),
  recordGenerationAttempt: h.recordGenerationAttempt,
}));
vi.mock("@/lib/credit/operation-cost-service", () => ({
  OperationCostService: vi.fn(function () {
    return { getCost: h.getCost };
  }),
  OperationCostUnavailableError: class extends Error {},
  DEFAULT_OPERATION_COSTS: {},
}));
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: vi.fn(function () {
    return { getBalance: h.getBalance };
  }),
}));
vi.mock("@/lib/image-generation/services/input-validation-service", () => ({
  InputValidationService: vi.fn(function () {
    return { validate: h.inputValidationValidate };
  }),
}));
vi.mock("@/lib/image-generation/services/image-generation-service", () => ({
  ImageGenerationService: vi.fn(function () {
    return { generateImage: vi.fn(), validatePrompts: vi.fn(() => ({ valid: true, errors: [] })) };
  }),
}));
vi.mock("@/lib/image-generation/providers/factory", () => ({
  createImageProvider: vi.fn(() => ({ name: "test" })),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isForceBriefVisionCheckEnabled: vi.fn(async () => false),
  isCampaignApprovalEnabled: vi.fn(async () => false),
  FORCE_BRIEF_VISION_CHECK_KEY: "force_brief_vision_check",
  FeatureFlagService: vi.fn(),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  createCampaign: h.createCampaign,
  dataUrlToCampaignImage: vi.fn(() => ({ buffer: Buffer.from(""), mimeType: "image/jpeg" })),
  uploadCampaignImage: vi.fn(async () => undefined),
  uploadCampaignInputImage: vi.fn(async () => undefined),
  removeCampaignInputs: vi.fn(async () => undefined),
  updateCampaignReady: vi.fn(async () => undefined),
  updateCampaignError: vi.fn(async () => undefined),
  deleteCampaignImage: vi.fn(async () => undefined),
  createArtVersion: vi.fn(async () => undefined),
  getCampaign: vi.fn(),
}));
vi.mock("@/lib/campaign/image-processor", () => ({ transcodeToJpeg: vi.fn(), buildPublicationCopySnapshot: vi.fn() }));
vi.mock("@/lib/store-identity-service", () => ({
  resolveStoreIdentity: vi.fn(),
  validateIdentityReference: vi.fn(),
  buildCampaignBrief: vi.fn(),
}));
// B1 — conversão da URL assinada de identidade → data URL aceito pelo adapter.
vi.mock("@/lib/store-identity/identity-image", () => ({
  resolveIdentityImageAsDataUrl: vi.fn(),
}));
vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: vi.fn(async (key: string) => ({ key, value: 1, source: "table" })) };
  }),
}));
vi.mock("@/lib/product-events/service", () => ({
  ProductEventService: vi.fn(function () {
    return { record: vi.fn() };
  }),
}));
vi.mock("@/lib/ai-cost", () => ({
  AiCostTracker: class {
    startRun() {
      return { operationRunId: "run-1", traceId: "trace-1" };
    }
    async record() {}
  },
  resolveAiCost: vi.fn(),
  estimateAiCost: vi.fn(),
}));
vi.mock("@/lib/ai", () => ({
  createDefaultTelemetryContext: vi.fn(() => ({
    operationRunId: "run-1",
    operationRunType: "campaign_delivery",
    traceId: "trace-1",
    storeId: "s",
    campaignId: "c",
    attemptNumber: 0,
    sink: { emit: async () => {} },
  })),
  CAPABILITY_GENERATION_TYPE: {},
}));
vi.mock("@/lib/copy/copy-director-service", () => ({
  CopyDirectorService: vi.fn(function () {
    return { generateCopy: vi.fn(), hasFallback: vi.fn(async () => true) };
  }),
}));
vi.mock("@/lib/copy/mapper", () => ({
  mapBriefToCopyDirectorInput: vi.fn(() => ({})),
  buildDeterministicCopy: vi.fn(() => ({})),
  buildCommercialFrame: vi.fn(() => ({})),
}));

// ── Auth / CSRF ──────────────────────────────────────────────────────────────
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn(() => {}) }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "00000000-0000-0000-0000-000000000001" })),
  requireUser: vi.fn(async () => ({ userId: "00000000-0000-0000-0000-000000000001" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async () => undefined),
}));

// ── Autorização/elegibilidade do novo fluxo ──────────────────────────────────
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: vi.fn((store: unknown) => store),
}));

const STORE_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const CAMPAIGN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OPERATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
// CR-01 — loja de OUTRO tenant (dona da campanha da vítima).
const OTHER_STORE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/**
 * CR-01 — query mockada de `campaigns` para o cenário cross-tenant: a campanha do
 * par `(campaignId, operationId)` submetido pertence a `storeId` (OUTRO tenant).
 */
function crossTenantCampaignsQuery(storeId: string) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: { id: CAMPAIGN_ID, store_id: storeId, input_snapshot: null },
          error: null,
        })),
      })),
    })),
  };
}

/** CR-01 — estado persistido da operação da VÍTIMA (tenant B). */
function victimOperation(overrides: Record<string, unknown>) {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    status: "delivered",
    amount: 1,
    creditTxId: "tx-victim",
    refundTxId: null,
    consumedDefinitive: true,
    terminal: true,
    unknown: false,
    outcome: null,
    supportReference: null,
    ...overrides,
  };
}

const VALID_BODY = {
  storeId: STORE_ID,
  productName: "Produto Novo",
  originalPriceCents: 2990,
  discountedPriceCents: 1990,
  badgeText: "Oferta",
  campaignIntent: "offer",
  validity: "até 31/12",
  mandatoryArtworkText: "Beba com moderação",
  backgroundDirection: "studio",
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  productImages: [
    {
      role: "primary",
      source: "upload",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,primary",
    },
  ],
};

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/campaign/generate-image", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function parseEvents(text: string): Record<string, unknown>[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function terminalOf(events: Record<string, unknown>[]): Record<string, unknown> {
  return events.filter((e) => ["result", "error", "unknown"].includes(String(e.type))).at(-1)!;
}

const EMPTY_CAMPAIGN_QUERY = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    })),
  })),
};

// (gap 4) A identidade é resolvida SERVER-SIDE dentro do novo fluxo: a loja é
// lida via supabaseAdmin antes de `resolveStoreIdentity`.
const STORES_QUERY = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: { id: STORE_ID, name: "Loja Teste", segment: "outros" },
        error: null,
      })),
    })),
  })),
};

beforeEach(() => {
  vi.clearAllMocks();
  h.diagnoses.clear();

  h.mockFrom.mockImplementation((table: string) => {
    if (table === "campaigns") return EMPTY_CAMPAIGN_QUERY;
    if (table === "stores") return STORES_QUERY;
    return {};
  });
  h.mockRpc.mockImplementation(async (fn: string) => {
    if (fn === "check_store_readiness") {
      return { data: { ready: true, missing: [] }, error: null };
    }
    return { data: null, error: null };
  });

  h.getCampaignOperation.mockResolvedValue(null);
  h.acquire.mockImplementation(async (input: { target: string; attemptNumber: number }) => ({
    acquired: true,
    reason: null,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    attemptNumber: input.attemptNumber,
    target: input.target,
  }));
  h.finish.mockResolvedValue({ success: true });
  h.recordOperationOutcome.mockResolvedValue({ success: true, outcome: "unknown" });
  h.recordOperation.mockResolvedValue({ id: "op-row-1", operationId: OPERATION_ID });

  h.creditReserve.mockResolvedValue({ status: "reserved" });
  h.creditMarkArtUploaded.mockResolvedValue({ status: "art_uploaded" });
  h.creditDeliver.mockResolvedValue({ status: "delivered" });
  h.creditRefund.mockResolvedValue({ status: "refunded" });
  h.creditCloseFailedOperation.mockResolvedValue({
    success: true,
    idempotent: false,
    status: "refunded",
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    action: "close_failed_operation",
  });
  // FENCE de publicação (B2.2): posse adquirida na 1ª tentativa.
  h.creditBeginPublication.mockResolvedValue({ acquired: true, token: "pub-token" });
  h.creditMarkResultUnknown.mockResolvedValue({ status: "unknown" });
  h.creditGetPublicationEpoch.mockResolvedValue(1);
  h.resolvePilotSpendGate.mockResolvedValue({ kind: "inactive" });

  h.storeArtifact.mockResolvedValue({
    storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  });
  h.probeArtifact.mockResolvedValue({ kind: "absent" });

  h.gatewayInvoke.mockResolvedValue({
    imageBase64: "AAAA",
    mimeType: "image/png",
    model: "gpt-image-2.5-sunburst",
  });

  h.createCampaign.mockResolvedValue({
    id: CAMPAIGN_ID,
    storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
  });
  h.recordGenerationAttempt.mockResolvedValue(undefined);
  h.inputValidationValidate.mockResolvedValue({ classification: "ok" });

  // (gap 4) identidade resolvida server-side dentro do novo fluxo.
  (resolveStoreIdentity as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    storeName: "Loja Teste",
    storeSegment: "outros",
    brandColor: "#000000",
    identityState: "text_only",
    signature: { url: null, type: null },
  });
  (validateIdentityReference as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    storeName: "Loja Teste",
    storeSegment: "outros",
    brandColor: "#000000",
    identityState: "text_only",
    signature: { url: null, type: null },
  });
  (buildCampaignBrief as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    store: { name: "Loja Teste", segment: "outros" },
    identity: { state: "text_only", imageUrl: null, directive: "Direção de identidade." },
  });
  // B1 — por padrão a identidade NÃO é convertida (text-only).
  (resolveIdentityImageAsDataUrl as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
});

describe("F56.2b1b — rota COMPLETA + orquestrador real (correção de integração)", () => {
  it("(achado 1) Original ACEITA com uma ÚNICA imagem no transporte `productImageDataUrl`", async () => {
    const { POST } = await import("../route");
    const body: Record<string, unknown> = {
      ...VALID_BODY,
      backgroundDirection: "original",
      productImageDataUrl: "data:image/jpeg;base64,single",
    };
    delete body.productImages;

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const terminal = terminalOf(parseEvents(await res.text()));
    // Não é o erro de CAMPO da regra Original (a imagem única foi contada).
    expect(terminal).toMatchObject({ type: "result" });
    // (gap 1) A imagem ÚNICA entra no pipeline REAL: o gateway recebe o dataUrl.
    expect(h.gatewayInvoke).toHaveBeenCalled();
    expect(
      (h.gatewayInvoke.mock.calls[0][1] as { productImagesDataUrls?: string[] })
        .productImagesDataUrls,
    ).toEqual(["data:image/jpeg;base64,single"]);
  });

  it("(achado 3) reenvio com operação EXISTENTE ⇒ SOMENTE consulta (zero InputValidation/recordGenerationAttempt/createCampaign)", async () => {
    h.getCampaignOperation.mockResolvedValue({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      status: "delivered",
      amount: 1,
      creditTxId: "tx-1",
      refundTxId: null,
      consumedDefinitive: true,
      terminal: true,
      unknown: false,
      outcome: null,
      supportReference: null,
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "result" });

    // NENHUMA checagem pré-reserva/escrita rodou.
    expect(h.inputValidationValidate).not.toHaveBeenCalled();
    expect(h.recordGenerationAttempt).not.toHaveBeenCalled();
    expect(h.createCampaign).not.toHaveBeenCalled();
    // ZERO mutações/provider (curto-circuito de consulta).
    expect(h.creditReserve).not.toHaveBeenCalled();
    expect(h.acquire).not.toHaveBeenCalled();
    expect(h.gatewayInvoke).not.toHaveBeenCalled();
  });

  it("(achado 3) corrida de criação EQUIVALENTE ⇒ REUSA (sem 409)", async () => {
    // 1ª leitura (pré-criação) ⇒ ausente; 2ª leitura (pós-corrida) ⇒ mesma loja.
    let readCount = 0;
    h.mockFrom.mockImplementation((table: string) => {
      if (table === "stores") return STORES_QUERY;
      if (table === "campaigns") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                readCount += 1;
                return readCount === 1
                  ? { data: null, error: null }
                  : { data: { id: CAMPAIGN_ID, store_id: STORE_ID }, error: null };
              }),
            })),
          })),
        };
      }
      return {};
    });
    h.createCampaign.mockRejectedValueOnce(new Error("duplicate key"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "result" });
  });

  it("(achado 4) falha do `storeArtifact` com OBJETO PRESENTE ⇒ NÃO estorna e terminal `unknown`", async () => {
    h.storeArtifact.mockRejectedValueOnce(
      Object.assign(new Error("artifact_metadata_persist_failed"), {
        code: "artifact_metadata_persist_failed",
      }),
    );
    h.probeArtifact.mockResolvedValue({ kind: "integral" });

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "unknown" });
    expect(h.creditRefund).not.toHaveBeenCalled();
  });

  it("(achado 4) falha do `storeArtifact` INDETERMINADA ⇒ NÃO estorna e terminal `unknown`", async () => {
    h.storeArtifact.mockRejectedValueOnce(new Error("artifact_upload_failed"));
    h.probeArtifact.mockResolvedValue({ kind: "indeterminate" });

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "unknown" });
    expect(h.creditRefund).not.toHaveBeenCalled();
  });

  it("(achado 4) encerramento CONFIRMADO (`refunded`) via PF ⇒ apenas então a copy `estornado`", async () => {
    h.gatewayInvoke.mockRejectedValue(
      Object.assign(new Error("provider down"), { code: "provider_error" }),
    );
    h.probeArtifact.mockResolvedValue({ kind: "absent" });
    h.creditCloseFailedOperation.mockResolvedValue({
      success: true,
      idempotent: false,
      status: "refunded",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      action: "close_failed_operation",
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "error", code: "IMG-001" });
    expect(String(terminal.message)).toContain("estornado");
    expect(h.creditCloseFailedOperation).toHaveBeenCalledTimes(1);
    expect(h.creditRefund).not.toHaveBeenCalled();
  });

  it("(achado 4) encerramento NÃO confirmado ⇒ NUNCA afirma `estornado`", async () => {
    h.gatewayInvoke.mockRejectedValue(
      Object.assign(new Error("provider down"), { code: "provider_error" }),
    );
    h.probeArtifact.mockResolvedValue({ kind: "absent" });
    h.creditCloseFailedOperation.mockRejectedValue(new Error("close_failed"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "unknown" });
    expect(String(terminal.message ?? "")).not.toContain("estornado");
  });

  it("(F56.2b2c armed) BLOQUEIA: resolver→pricing→beginPaidCall; recusa ⇒ ZERO provider", async () => {
    const beginPaidCall = vi.fn(async (_input: { kind: string; attemptSeq: number; estimatedUsd: number; operationId?: string }) => ({ acquired: false, outcome: "blocked", reason: "pilot_cap_reached" }));
    h.resolvePilotSpendGate.mockResolvedValue({
      kind: "armed",
      gate: { beginPaidCall, endPaidCall: vi.fn(async () => undefined), markUnknown: vi.fn(async () => undefined) },
    });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    console.error("ARMED_BUNDLE " + JSON.stringify({
      status: res.status,
      terminal,
      resolver: h.resolvePilotSpendGate.mock.results.map((r) => r.value),
      op_read: h.getCampaignOperation.mock.calls.length,
      reserve: h.creditReserve.mock.calls.length,
      acquire: h.acquire.mock.calls.length,
      record_attempt: h.recordGenerationAttempt.mock.calls.length,
      record_outcome: h.recordOperationOutcome.mock.calls.length,
      pricing: h.resolveImagePairCost.mock.calls.length,
      begin: beginPaidCall.mock.calls.length,
      provider: h.gatewayInvoke.mock.calls.length,
    }));
    expect(res.status).toBe(200);
    // Fronteira 1: resolver chamado pela rota.
    expect(h.resolvePilotSpendGate).toHaveBeenCalled();
    // Fronteira 3: beginPaidCall com identidade/tentativa e estimativa FINITA.
    expect(beginPaidCall).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: OPERATION_ID, kind: "image_primary", attemptSeq: 1, estimatedUsd: expect.any(Number) }),
    );
    expect(beginPaidCall.mock.calls[0]?.[0]?.estimatedUsd).toBeGreaterThan(0);
    // Recusa do gate ⇒ ZERO provider.
    expect(h.gatewayInvoke).not.toHaveBeenCalled();
  });

  it("(F56.2b2c armed) ADQUIRE: provider UMA vez + endPaidCall", async () => {
    const handle = { callId: "c1", ownerToken: "o1", kind: "image_primary" as const };
    const beginPaidCall = vi.fn(async (_input: { kind: string; attemptSeq: number; estimatedUsd: number }) => ({ acquired: true, handle }));
    const endPaidCall = vi.fn(async () => undefined);
    h.resolvePilotSpendGate.mockResolvedValue({
      kind: "armed",
      gate: { beginPaidCall, endPaidCall, markUnknown: vi.fn(async () => undefined) },
    });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(res.status).toBe(200);
    expect(beginPaidCall).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "image_primary", attemptSeq: 1, estimatedUsd: expect.any(Number) }),
    );
    expect(beginPaidCall.mock.calls[0]?.[0]?.estimatedUsd).toBeGreaterThan(0);
    // Aquisição ⇒ SOMENTE a chamada prevista, seguida do encerramento.
    expect(h.gatewayInvoke).toHaveBeenCalledTimes(1);
    expect(endPaidCall).toHaveBeenCalledTimes(1);
    expect(terminal).toBeTruthy();
  });

  it("(F56.2b2c armed) M3 imagem: timeout + falha DUPLA de marcação ⇒ unknown, sem retry/refund/PF", async () => {
    const beginPaidCall = vi.fn(async () => ({ acquired: true, handle: { callId: "c", ownerToken: "o", kind: "image_primary" as const } }));
    const markUnknown = vi.fn(async () => {
      throw new Error("db_down_block");
    });
    h.resolvePilotSpendGate.mockResolvedValue({
      kind: "armed",
      gate: { beginPaidCall, endPaidCall: vi.fn(async () => undefined), markUnknown },
    });
    h.gatewayInvoke.mockRejectedValue(Object.assign(new Error("timed out"), { kind: "timeout" }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    // Natureza DESCONHECIDA preservada (o erro do gate não substitui o original).
    expect(terminal).toMatchObject({ type: "unknown" });
    expect(beginPaidCall).toHaveBeenCalledTimes(1); // sem retry/novo begin
    expect(markUnknown).toHaveBeenCalledTimes(1);
    expect(h.creditRefund).not.toHaveBeenCalled();
    expect(h.creditCloseFailedOperation).not.toHaveBeenCalled();
  });

  it("(F56.2b2c armed) IN-02: sucesso do provider + endPaidCall FALHA ⇒ sem segunda chamada paga", async () => {
    const handle = { callId: "c", ownerToken: "o", kind: "image_primary" as const };
    const beginPaidCall = vi.fn(async () => ({ acquired: true, handle }));
    const endPaidCall = vi.fn(async () => {
      throw new Error("end_fail");
    });
    const markUnknown = vi.fn(async () => undefined);
    h.resolvePilotSpendGate.mockResolvedValue({
      kind: "armed",
      gate: { beginPaidCall, endPaidCall, markUnknown },
    });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    // IN-02 (disposição): a falha do encerramento NÃO provoca 2ª chamada paga.
    expect(h.gatewayInvoke).toHaveBeenCalledTimes(1);
    expect(terminal).toBeTruthy();
  });


  it("(achado 5b) `unknown` persistido ⇒ claim FINALIZADO (`abandoned`), não `in_progress`", async () => {
    h.gatewayInvoke.mockRejectedValue(Object.assign(new Error("timeout"), { name: "AbortError" }));

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "unknown" });
    expect(h.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: "abandoned" }),
    );
    expect(h.creditRefund).not.toHaveBeenCalled();
  });

  it("(achado 5b) finalização do claim FALHA ⇒ claim residual `in_progress` + SEM estorno", async () => {
    h.gatewayInvoke.mockRejectedValue(Object.assign(new Error("timeout"), { name: "AbortError" }));
    h.finish.mockRejectedValue(new Error("invalid_transition"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "unknown" });
    expect(h.creditRefund).not.toHaveBeenCalled();
    // O marcador `unknown` persistiu ANTES da tentativa de finalização.
    expect(h.recordOperationOutcome).toHaveBeenCalledTimes(1);
  });

  it("(achado 5a) falha de LEITURA da operação BLOQUEIA fail-closed (`IMG-001`, zero mutações)", async () => {
    h.getCampaignOperation.mockRejectedValue(new Error("operation_read_failed"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    // A rota também lê a operação ANTES de tudo: propaga e bloqueia fail-closed.
    expect(res.status).toBe(502);
    expect(h.createCampaign).not.toHaveBeenCalled();
    expect(h.recordGenerationAttempt).not.toHaveBeenCalled();
  });

  it("(achado 6) falha OPERACIONAL ⇒ `IMG-001` + referência, diagnóstico durável recuperável por referência", async () => {
    // Preflight indisponível ⇒ falha operacional (o orquestrador real propaga).
    const preflight = await import("@/lib/product-1-1/orchestration/preflight");
    (preflight.runNewFlowPreflight as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("preflight_unavailable"),
    );

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "error", code: "IMG-001" });
    const reference = terminal.reference as string;
    expect(typeof reference).toBe("string");
    expect(reference.length).toBeGreaterThan(0);

    const { SupabaseImageGenerationDiagnosisRepository } = await import(
      "@/lib/ai/image-generation-diagnosis-repository"
    );
    const diagnosis = await new SupabaseImageGenerationDiagnosisRepository(
      {} as never,
    ).findByReference(reference);
    expect(diagnosis).toBeTruthy();
    expect(diagnosis).toMatchObject({ reference, internalCategory: "preflight_failed" });
  });

  it("(gap 3) timeout/abort ⇒ `unknown` com diagnóstico durável recuperável por `findByReference`", async () => {
    h.gatewayInvoke.mockRejectedValue(Object.assign(new Error("timeout"), { name: "AbortError" }));

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "unknown" });
    const reference = terminal.reference as string;
    expect(typeof reference).toBe("string");

    const { SupabaseImageGenerationDiagnosisRepository } = await import(
      "@/lib/ai/image-generation-diagnosis-repository"
    );
    const diagnosis = await new SupabaseImageGenerationDiagnosisRepository(
      {} as never,
    ).findByReference(reference);
    expect(diagnosis).toBeTruthy();
    expect(diagnosis).toMatchObject({ reference, internalCategory: "generation_unknown" });
  });

  it("(gap 3) pendência (arte PRESENTE) ⇒ `unknown` com diagnóstico durável recuperável por `findByReference`", async () => {
    h.storeArtifact.mockRejectedValueOnce(
      Object.assign(new Error("artifact_metadata_persist_failed"), {
        code: "artifact_metadata_persist_failed",
      }),
    );
    h.probeArtifact.mockResolvedValue({ kind: "integral" });

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "unknown" });
    const reference = terminal.reference as string;

    const { SupabaseImageGenerationDiagnosisRepository } = await import(
      "@/lib/ai/image-generation-diagnosis-repository"
    );
    const diagnosis = await new SupabaseImageGenerationDiagnosisRepository(
      {} as never,
    ).findByReference(reference);
    expect(diagnosis).toBeTruthy();
    expect(diagnosis).toMatchObject({ reference, internalCategory: "artifact_store_failed" });
  });

  it("(gap 4) identidade SERVER-SIDE vai ao gateway como `identityImageUrl` e é congelada no snapshot", async () => {
    const serverIdentity = {
      storeName: "Loja Teste",
      storeSegment: "outros",
      brandColor: "#111111",
      identityState: "logo",
      signature: { url: "https://signed.example/logo.png", type: "logo" },
    };
    (resolveStoreIdentity as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(serverIdentity);
    (validateIdentityReference as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      serverIdentity,
    );
    // B1 — a identidade é convertida ao `data URL` ACEITO pelo adapter (a URL
    // assinada rotativa NUNCA vai ao gateway).
    (resolveIdentityImageAsDataUrl as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUrl: "data:image/png;base64,LOGO",
      contentId: "content-id-logo",
      mimeType: "image/png",
      byteLength: 3,
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    const terminal = terminalOf(parseEvents(await res.text()));
    expect(terminal).toMatchObject({ type: "result" });

    expect(h.gatewayInvoke).toHaveBeenCalled();
    const request = h.gatewayInvoke.mock.calls[0][1] as { identityImageUrl?: string };
    expect(request.identityImageUrl).toBe("data:image/png;base64,LOGO");

    expect(h.createCampaign).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({
        identitySnapshot: expect.objectContaining({ storeName: "Loja Teste" }),
      }),
      CAMPAIGN_ID,
    );
  });

  it("(I2) a identidade PERSISTIDA é a EFETIVAMENTE usada: sem imagem ⇒ sem assinatura (text-only); com imagem ⇒ com assinatura", async () => {
    const serverIdentity = {
      storeName: "Loja Teste",
      storeSegment: "outros",
      brandColor: "#111111",
      identityState: "logo",
      signature: { url: "https://signed.example/logo.png", type: "logo" },
    };
    (resolveStoreIdentity as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(serverIdentity);
    (validateIdentityReference as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      serverIdentity,
    );

    // (a) Conversão FALHA (sem imagem) ⇒ composição text-only ⇒ persistido SEM assinatura.
    (resolveIdentityImageAsDataUrl as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { POST } = await import("../route");
    const resA = await POST(makeRequest(VALID_BODY));
    expect(terminalOf(parseEvents(await resA.text()))).toMatchObject({ type: "result" });

    const persistedA = (
      h.createCampaign.mock.calls.at(-1)![1] as {
        identitySnapshot: { signature: { url: string | null } };
      }
    ).identitySnapshot;
    expect(persistedA.signature.url).toBeNull();
    // O gateway também não recebe imagem ⇒ TUDO concorda (text-only).
    expect(
      (h.gatewayInvoke.mock.calls.at(-1)![1] as { identityImageUrl?: string }).identityImageUrl,
    ).toBeUndefined();

    h.createCampaign.mockClear();
    h.gatewayInvoke.mockClear();

    // (b) Conversão OK ⇒ persistido CARREGA a identidade efetiva (data URL no gateway).
    (resolveIdentityImageAsDataUrl as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUrl: "data:image/png;base64,LOGO",
      contentId: "content-id-logo",
      mimeType: "image/png",
      byteLength: 3,
    });
    const { POST: POST2 } = await import("../route");
    const resB = await POST2(makeRequest(VALID_BODY));
    expect(terminalOf(parseEvents(await resB.text()))).toMatchObject({ type: "result" });

    const persistedB = (
      h.createCampaign.mock.calls.at(-1)![1] as {
        identitySnapshot: { signature: { url: string | null } };
      }
    ).identitySnapshot;
    expect(persistedB.signature.url).toBe("https://signed.example/logo.png");
    expect(
      (h.gatewayInvoke.mock.calls.at(-1)![1] as { identityImageUrl?: string }).identityImageUrl,
    ).toBe("data:image/png;base64,LOGO");
  });

  // ── CR-01 — IDOR: binding campanha↔loja ANTES do curto-circuito ────────────
  // Um chamador autenticado dono da loja A NÃO pode usar o par (campaignId,
  // operationId) de OUTRO tenant (campanha da loja B) para ler o estado da
  // operação — em QUALQUER estado. A resposta é 409 `operation_identity_conflict`,
  // SEM disclosure de estado/`supportReference` e com ZERO efeitos.
  it.each([
    [
      "delivered",
      victimOperation({ status: "delivered", terminal: true, supportReference: null }),
    ],
    [
      "refunded",
      victimOperation({
        status: "refunded",
        terminal: true,
        refundTxId: "rf-victim",
        supportReference: null,
      }),
    ],
    [
      "unknown",
      victimOperation({
        status: "reserved",
        terminal: false,
        consumedDefinitive: false,
        unknown: true,
        supportReference: "IMG-001-VICTIM",
      }),
    ],
    [
      "in-progress",
      victimOperation({
        status: "reserved",
        terminal: false,
        consumedDefinitive: false,
        unknown: false,
        supportReference: null,
      }),
    ],
  ])(
    "(CR-01) cross-tenant %s ⇒ 409 operation_identity_conflict, sem disclosure e ZERO efeitos",
    async (_label, operation) => {
      h.mockFrom.mockImplementation((table: string) => {
        if (table === "stores") return STORES_QUERY;
        if (table === "campaigns") return crossTenantCampaignsQuery(OTHER_STORE_ID);
        return {};
      });
      // A operação da vítima EXISTE — sem o binding, o fluxo a retornaria.
      h.getCampaignOperation.mockResolvedValue(operation);

      const { POST } = await import("../route");
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      expect(body.error?.code).toBe("operation_identity_conflict");

      // SEM disclosure do estado da operação/`supportReference` do outro tenant.
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("IMG-001-VICTIM");
      expect(serialized).not.toContain(OPERATION_ID);
      expect(serialized).not.toContain("operationId");
      // A operação da vítima NUNCA é lida (bloqueio ANTES do curto-circuito).
      expect(h.getCampaignOperation).not.toHaveBeenCalled();

      // ZERO efeitos (nada de reserva/entrega/estorno/provider/registro de tentativa/campanha).
      expect(h.creditReserve).not.toHaveBeenCalled();
      expect(h.creditDeliver).not.toHaveBeenCalled();
      expect(h.creditRefund).not.toHaveBeenCalled();
      expect(h.gatewayInvoke).not.toHaveBeenCalled();
      expect(h.recordOperationOutcome).not.toHaveBeenCalled();
      expect(h.recordGenerationAttempt).not.toHaveBeenCalled();
      expect(h.createCampaign).not.toHaveBeenCalled();
    },
  );

  it("(CR-01) campanha da MESMA loja com operação existente ⇒ curto-circuito preservado (consulta)", async () => {
    // Regressão: o binding NÃO pode bloquear a operação legítima da MESMA loja.
    h.mockFrom.mockImplementation((table: string) => {
      if (table === "stores") return STORES_QUERY;
      if (table === "campaigns") return crossTenantCampaignsQuery(STORE_ID);
      return {};
    });
    h.getCampaignOperation.mockResolvedValue(
      victimOperation({ status: "delivered", terminal: true }),
    );

    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    // Curto-circuito somente-leitura: delega ao orquestrador, sem escrita.
    expect(h.createCampaign).not.toHaveBeenCalled();
    expect(h.recordGenerationAttempt).not.toHaveBeenCalled();
  });
});
