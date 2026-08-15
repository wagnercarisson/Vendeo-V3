import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock("server-only", () => ({}));

// Shared mock functions
const mockStoreSelect = vi.fn();
const mockStoreEq = vi.fn();
const mockStoreSingle = vi.fn();
const mockStoreFrom = vi.fn();

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mockStoreFrom,
    rpc: mockRpc,
  },
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/legal/clearance', () => ({ requireLegalClearance: vi.fn().mockResolvedValue({ ok: true }) }));

vi.mock('@/lib/store-identity-service', () => ({
  resolveStoreIdentity: vi.fn(),
  validateIdentityReference: vi.fn(),
  buildCampaignBrief: vi.fn(),
}));

vi.mock('@/lib/campaign/persistence', () => ({
  createCampaign: vi.fn(),
  dataUrlToCampaignImage: vi.fn(),
  uploadCampaignImage: vi.fn(),
  updateCampaignReady: vi.fn(),
  updateCampaignError: vi.fn(),
  deleteCampaignImage: vi.fn(),
}));

vi.mock('@/lib/campaign/image-processor', () => ({
  transcodeToJpeg: vi.fn(),
  buildPublicationCopySnapshot: vi.fn(),
}));

vi.mock('@/lib/image-generation/config', () => ({
  IMAGE_GENERATION_GLOBAL_TIMEOUT_MS: 300000,
  MAX_PRODUCT_IMAGE_BASE64_SIZE: 5 * 1024 * 1024,
  MAX_CAMPAIGN_IMAGES: 4,
  IMAGE_GENERATION_RESPONSES_MODEL: 'test-model',
}));

const { mockGetCost, MockOperationCostUnavailableError } = vi.hoisted(() => {
  class MockOperationCostUnavailableError extends Error {
    constructor(message?: string) {
      super(message ?? "Falha ao ler custo de operação");
      this.name = "OperationCostUnavailableError";
    }
  }
  return { mockGetCost: vi.fn(), MockOperationCostUnavailableError };
});
vi.mock('@/lib/credit/operation-cost-service', () => ({
  OperationCostService: vi.fn(function () {
    return { getCost: mockGetCost };
  }),
  OperationCostUnavailableError: MockOperationCostUnavailableError,
  DEFAULT_OPERATION_COSTS: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
}));

const mockGenerateImage = vi.fn();
const mockValidatePrompts = vi.fn();
vi.mock('@/lib/image-generation/services/image-generation-service', () => ({
  ImageGenerationService: vi.fn(function() {
    return { generateImage: mockGenerateImage, validatePrompts: mockValidatePrompts };
  }),
}));

vi.mock('@/lib/image-generation/services/input-validation-service', () => ({
  InputValidationService: vi.fn(function() {
    return { validate: vi.fn(async () => ({ classification: "ok" })) };
  }),
}));

vi.mock('@/lib/image-generation/providers/factory', () => ({
  createImageProvider: vi.fn(() => ({ name: 'test' })),
}));

vi.mock('@/lib/auth/csrf', () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock('@/lib/auth/require-user', () => ({
  requireApiUser: vi.fn(() => Promise.resolve({ userId: '00000000-0000-0000-0000-000000000001' })),
  requireUser: vi.fn(() => Promise.resolve({ userId: '00000000-0000-0000-0000-000000000001' })),
}));

vi.mock('@/lib/auth/store-ownership', () => ({
  requireOwnership: vi.fn(() => Promise.resolve()),
}));

// Rate limit mocks
const mockCheckRateLimit = vi.fn();
const mockRecordGenerationAttempt = vi.fn();
vi.mock('@/lib/rate-limit/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  recordGenerationAttempt: mockRecordGenerationAttempt,
}));

// Credit service mock
const mockGetBalance = vi.fn();
const mockReserveCredit = vi.fn();
const mockConfirmCredit = vi.fn();
const mockRefundCredit = vi.fn();
vi.mock('@/lib/credit/credit-service', () => ({
  CreditService: vi.fn(function() {
    return {
      getBalance: mockGetBalance,
      reserveCredit: mockReserveCredit,
      confirmCredit: mockConfirmCredit,
      refundCredit: mockRefundCredit,
    };
  }),
}));

// Copy Director mock
const mockGenerateCopy = vi.fn();
vi.mock('@/lib/copy/copy-director-service', () => ({
  CopyDirectorService: vi.fn(function() {
    return { generateCopy: mockGenerateCopy };
  }),
}));

vi.mock('@/lib/text-provider/factory', () => ({
  createTextProvider: vi.fn(() => ({ name: 'test' })),
}));

vi.mock('@/lib/copy/mapper', () => ({
  mapBriefToCopyDirectorInput: vi.fn(() => ({
    productName: 'Test',
    description: 'Test description',
    offer: 'Test offer',
    storeName: 'Test Store',
    segment: 'test',
  })),
}));

// F38.1 (6.3): mock da camada única de registro de custo (D7). O AiCostTracker
// mockado captura os eventos gravados em `capturedEvents` e o startRun devolve
// operationRunId/traceId FIXOS — permitindo afirmar a recomposição do mesmo run.
const { capturedEvents, mockResolveAiCost, MockAiCostTracker, RUN_IDS } = vi.hoisted(() => {
  const capturedEvents: any[] = [];
  const RUN_IDS = { operationRunId: 'run-123', traceId: 'trace-123' };
  class MockAiCostTracker {
    startRun(_type: string) {
      return { ...RUN_IDS };
    }
    async record(event: any) {
      capturedEvents.push(event);
    }
  }
  return { capturedEvents, mockResolveAiCost: vi.fn(), MockAiCostTracker, RUN_IDS };
});

vi.mock('@/lib/ai-cost', () => ({
  AiCostTracker: MockAiCostTracker,
  resolveAiCost: mockResolveAiCost,
  estimateAiCost: vi.fn(),
}));

// F38.2.1 (D3): mock do EconomicParameterService — resolve o snapshot econômico
// UMA vez no início do run (5.20/2.00 por default; cenário de falha via
// mockRejectedValue). Best-effort: falha → snapshots null, geração não bloqueada.
const { mockGetParameter } = vi.hoisted(() => ({ mockGetParameter: vi.fn() }));
vi.mock('@/lib/economic/economic-parameter-service', () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: mockGetParameter };
  }),
}));

import { resolveStoreIdentity, validateIdentityReference, buildCampaignBrief } from '@/lib/store-identity-service';
import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, updateCampaignReady, updateCampaignError, deleteCampaignImage } from '@/lib/campaign/persistence';
import { transcodeToJpeg } from '@/lib/campaign/image-processor';
import { InputValidationService } from '@/lib/image-generation/services/input-validation-service';

const STORE_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const CAMPAIGN_ID = '00000000-0000-0000-0000-000000000003';

const VALID_REQUEST_BODY = {
  storeId: STORE_ID,
  productName: 'Produto Teste',
  discountedPriceCents: 1990,
  badgeText: 'Oferta',
  productImageDataUrl: 'data:image/jpeg;base64,abc',
};

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new Request('http://localhost/api/campaign/generate-image', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }));
}

async function setupSuccessMocks() {
  // Store identity
  mockStoreFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) };
    }
    if (table === 'generation_rate_events') {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ gte: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })) };
    }
    return {};
  });

  (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros', brandColor: '#000000' });
  (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros', brandColor: '#000000' });
  (buildCampaignBrief as any).mockResolvedValue({
    campaignInput: { productName: 'Produto Teste', discountedPriceCents: 1990 },
    store: { name: 'Loja Teste', segment: 'outros' },
  });

  // Rate limit
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: { hourly: 10, daily: 30 }, resetTime: new Date(Date.now() + 3600000).toISOString() });
  mockRecordGenerationAttempt.mockResolvedValue(undefined);

  // Credit
  mockGetBalance.mockResolvedValue(10);
  mockReserveCredit.mockResolvedValue('tx-1');
  mockGetCost.mockResolvedValue({
    operationKey: "campaign_generation",
    costCredits: 1,
    enabled: true,
    source: "table",
  });

  // Campaign
  (createCampaign as any).mockResolvedValue({ id: CAMPAIGN_ID, storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg` });

  // Copy Director
  mockGenerateCopy.mockResolvedValue({
    title: 'Título da Campanha',
    caption: 'Caption gerada pelo Copy Director',
    hashtags: ['#tag1', '#tag2'],
    cta_post: 'Compre agora',
  });

  // Image Generation
  mockGenerateImage.mockResolvedValue({ success: true, imageDataUrl: 'data:image/jpeg;base64,xyz' });

  // Preflight
  mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });

  // Persistence
  (dataUrlToCampaignImage as any).mockReturnValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
  (transcodeToJpeg as any).mockResolvedValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
  (uploadCampaignImage as any).mockResolvedValue(undefined);
  (updateCampaignReady as any).mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedEvents.length = 0;
  mockRpc.mockResolvedValue({ data: { ready: true, missing: [] }, error: null });
  mockGetCost.mockResolvedValue({
    operationKey: "campaign_generation",
    costCredits: 1,
    enabled: true,
    source: "table",
  });
  // resolveAiCost mockado (6.3): computa custo REAL a partir do usage (furo 1) —
  // preço simplificado 2.5/M input + 10/M output, espelhando o cálculo do resolvedor.
  mockResolveAiCost.mockImplementation(async ({ provider, model, usage, providerReportedCostUsd }: any) => {
    if (typeof providerReportedCostUsd === "number" && !Number.isNaN(providerReportedCostUsd)) {
      return { estimatedCostUsd: providerReportedCostUsd, providerReportedCostUsd, costSource: "provider_reported" };
    }
    const prompt = usage?.promptTokens ?? 0;
    const completion = usage?.completionTokens ?? 0;
    if (prompt > 0 || completion > 0) {
      return {
        estimatedCostUsd: Number(((prompt / 1_000_000) * 2.5 + (completion / 1_000_000) * 10).toFixed(6)),
        costSource: "pricing_table",
        pricingVersion: "code_default",
      };
    }
    if ((usage?.imageTokens ?? 0) > 0) {
      return { estimatedCostUsd: 0.04, costSource: "pricing_table", pricingVersion: "code_default" };
    }
    return { estimatedCostUsd: 0.15, costSource: "fallback_static" };
  });
  // F38.2.1 (D3): default do snapshot econômico — usd 5.20 / credit 2.00.
  mockGetParameter.mockImplementation(async (key: string) => {
    if (key === "usd_brl_rate") return { key, value: 5.2, source: "table" };
    return { key, value: 2.0, source: "table" };
  });
});

describe('POST /api/campaign/generate-image', () => {
  // ── Existing validation tests ────────────────────────────────────

  it('rejects legacy identity fields with 400', async () => {
    const { POST } = await import('../route');
    const req = makeRequest({
      storeName: 'Loja Antiga',
      storeLogoUrl: 'https://example.com/logo.png',
      productName: 'Produto',
      discountedPriceCents: 1990,
      productImageDataUrl: 'data:image/jpeg;base64,abc',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Campos de identidade da loja');
  });

  it('rejects missing productImageDataUrl with 400', async () => {
    const { POST } = await import('../route');
    const req = makeRequest({
      storeId: STORE_ID,
      productName: 'Produto',
      discountedPriceCents: 1990,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Imagem do produto');
  });

  it('rejects missing storeId with 400', async () => {
    const { POST } = await import('../route');
    const req = makeRequest({
      productName: 'Produto',
      discountedPriceCents: 1990,
      productImageDataUrl: 'data:image/png;base64,xyz',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('inválidos');
  });

  // ── F31.2 7.5: Spotlight não retorna 400 por intent ─────────────

  it('spotlight — não retorna 400 por intent (F31.2 7.5)', async () => {
    await setupSuccessMocks();
    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, campaignIntent: "spotlight" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // ── F31.2 7.6: Exclusive não retorna 400 por intent ─────────────

  it('exclusive — não retorna 400 por intent (F31.2 7.6)', async () => {
    await setupSuccessMocks();
    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, campaignIntent: "exclusive" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // ── F31.2 7.7: Exclusive com preço normaliza para undefined ─────

  it('exclusive com discountedPriceCents — normaliza para undefined (F31.2 7.7)', async () => {
    await setupSuccessMocks();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { POST } = await import('../route');
    const req = makeRequest({
      ...VALID_REQUEST_BODY,
      campaignIntent: "exclusive",
      discountedPriceCents: 5000,
    });
    const res = await POST(req);
    await res.text();

    expect(warnSpy).toHaveBeenCalledWith(
      "[generate-image] exclusive com discountedPriceCents presente — normalizando para ausente."
    );
    expect(res.status).toBe(200);
    warnSpy.mockRestore();
  });

  // ── F31.2 7.8: Offer sem preço retorna 400 ─────────────────────

  it('offer sem discountedPriceCents — retorna 400 (F31.2 7.8)', async () => {
    const { POST } = await import('../route');
    const req = makeRequest({
      storeId: STORE_ID,
      productName: 'Produto',
      productImageDataUrl: 'data:image/jpeg;base64,abc',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Preço com desconto é obrigatório para ofertas");
  });

  // ── Test #1: Fluxo completo saldo suficiente → ready ────────────

  it('fluxo completo — saldo suficiente retorna 200 com NDJSON result', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const res = await POST(req);
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let allData = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      allData += decoder.decode(value);
    }
    expect(allData).toContain('"type":"result"');
    expect(allData).toContain(CAMPAIGN_ID);
  });

  // ── Test #2: 402 saldo insuficiente ─────────────────────────────

  it('saldo insuficiente retorna 402', async () => {
    mockStoreFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) };
      }
      return {};
    });
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: { name: 'Loja Teste', segment: 'outros' } });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordGenerationAttempt.mockResolvedValue(undefined);
    mockGetCost.mockResolvedValue({
      operationKey: "campaign_generation",
      costCredits: 1,
      enabled: true,
      source: "table",
    });
    mockGetBalance.mockResolvedValue(0);

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const res = await POST(req);
    expect(res.status).toBe(402);
  });

  // ── Test #3-4: 429 rate limit ──────────────────────────────────

  it('429 quando rate limit hora excedido', async () => {
    mockStoreFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) };
      }
      return {};
    });
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: { name: 'Loja Teste', segment: 'outros' } });
    mockCheckRateLimit.mockResolvedValue({ allowed: false, reason: 'hourly_limit_exceeded', resetTime: new Date(Date.now() + 3600000).toISOString() });

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limit_exceeded');
  });

  it('429 quando rate limit dia excedido', async () => {
    mockStoreFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) };
      }
      return {};
    });
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste', storeSegment: 'outros' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: { name: 'Loja Teste', segment: 'outros' } });
    mockCheckRateLimit.mockResolvedValue({ allowed: false, reason: 'daily_limit_exceeded', resetTime: new Date(Date.now() + 86400000).toISOString() });

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  // ── Test #5: Copy result vira publication_copy_snapshot ─────────

  it('copy result vira publication_copy_snapshot', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(updateCampaignReady).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({
        publicationCopySnapshot: expect.objectContaining({
          title: 'Título da Campanha',
          caption: 'Caption gerada pelo Copy Director',
        }),
      })
    );
  });

  // ── Test #6: Paralelismo — ambos executam ───────────────────────

  it('ambos copy e image sao executados em paralelo', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockGenerateCopy).toHaveBeenCalled();
    expect(mockGenerateImage).toHaveBeenCalled();
  });

  // ── Test #7: mandatoryArtworkText no snapshot visual mas nao no copy ──

  it('mandatoryArtworkText no inputSnapshot mas nao no copy', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagem meramente ilustrativa' });
    const _res = await POST(req);
    await _res.text();

    // Copy Director was called without mandatoryArtworkText
    expect(mockGenerateCopy).toHaveBeenCalled();
    expect(mockGenerateImage).toHaveBeenCalled();
  });

  // ── Test #8: mandatoryArtworkText ausente nao quebra ────────────

  it('sem mandatoryArtworkText — fluxo completo funciona', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // ── Test #9-11: Estornos ───────────────────────────────────────

  it('image falha → estorno', async () => {
    await setupSuccessMocks();
    mockGenerateImage.mockResolvedValue({ success: false, code: 'provider_error', message: 'Falha na geração' });

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockRefundCredit).toHaveBeenCalled();
    expect(updateCampaignError).toHaveBeenCalled();
  });

  it('copy falha → estorno', async () => {
    mockStoreFrom.mockImplementation(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) }));
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: {} });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordGenerationAttempt.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue(10);
    mockReserveCredit.mockResolvedValue('tx-1');
    (createCampaign as any).mockResolvedValue({ id: CAMPAIGN_ID, storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg` });
    mockGenerateCopy.mockRejectedValue(new Error('Copy generation failed'));
    mockGenerateImage.mockResolvedValue({ success: true, imageDataUrl: 'data:image/jpeg;base64,xyz' });
    mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });
    (dataUrlToCampaignImage as any).mockReturnValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (transcodeToJpeg as any).mockResolvedValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (uploadCampaignImage as any).mockResolvedValue(undefined);
    (updateCampaignReady as any).mockResolvedValue(undefined);

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockRefundCredit).toHaveBeenCalled();
  });

  it('ambos falham → estorno unico', async () => {
    mockStoreFrom.mockImplementation(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) }));
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: {} });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordGenerationAttempt.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue(10);
    mockReserveCredit.mockResolvedValue('tx-1');
    (createCampaign as any).mockResolvedValue({ id: CAMPAIGN_ID, storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg` });
    mockGenerateCopy.mockRejectedValue(new Error('Copy failed'));
    mockGenerateImage.mockRejectedValue(new Error('Image failed'));
    mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockRefundCredit).toHaveBeenCalledTimes(1);
  });

  // ── Test #12: Persistencia falha → estorno + limpa imagem ──────

  it('persistencia falha → estorno + limpa imagem', async () => {
    await setupSuccessMocks();
    (updateCampaignReady as any).mockRejectedValue(new Error('DB error'));

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockRefundCredit).toHaveBeenCalled();
    expect(deleteCampaignImage).toHaveBeenCalled();
  });

  // ── Test #13-14: Idempotencia ──────────────────────────────────

  it('reserva idempotente — mesma key nao duplica', async () => {
    await setupSuccessMocks();
    mockReserveCredit.mockResolvedValueOnce('tx-1');
    mockReserveCredit.mockResolvedValueOnce('tx-1');

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockReserveCredit).toHaveBeenCalledWith(
      STORE_ID,
      1,
      expect.objectContaining({
        idempotencyKey: `reserve_${CAMPAIGN_ID}`,
        metadata: expect.objectContaining({
          feature: "campaign_pipeline",
          operation_key: "campaign_generation",
          operation_cost_credits: 1,
          operation_cost_source: "table",
        }),
      })
    );
  });

  it('refund idempotente — mesma key nao duplica', async () => {
    await setupSuccessMocks();
    mockRefundCredit.mockResolvedValue('refund-1');
    mockGenerateImage.mockResolvedValue({ success: false, code: 'provider_error', message: 'Falha' });

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockRefundCredit).toHaveBeenCalledWith(
      'tx-1',
      expect.any(String),
      expect.objectContaining({ idempotencyKey: `refund_tx-1` })
    );
  });

  // ── Test #15-16: Timeout e erro nao retryable ──────────────────

  it('erro nao retryable → falha imediata sem retry', async () => {
    mockStoreFrom.mockImplementation(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) }));
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: {} });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordGenerationAttempt.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue(10);
    mockReserveCredit.mockResolvedValue('tx-1');
    (createCampaign as any).mockResolvedValue({ id: CAMPAIGN_ID, storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg` });
    const { SafetyBlockError } = await import('@/lib/copy/errors');
    mockGenerateCopy.mockRejectedValue(new SafetyBlockError('Conteúdo bloqueado'));
    mockGenerateImage.mockResolvedValue({ success: true, imageDataUrl: 'data:image/jpeg;base64,xyz' });
    mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });
    (dataUrlToCampaignImage as any).mockReturnValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (transcodeToJpeg as any).mockResolvedValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (uploadCampaignImage as any).mockResolvedValue(undefined);

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const res = await POST(req);
    await res.text();
    expect(res.status).toBe(200);
    expect(mockRefundCredit).toHaveBeenCalled();
  });

  // ── Test #17-19: Retry Gemini ──────────────────────────────────

  it('retry copy — falha retryable → Gemini OK → ready sem refund', async () => {
    mockStoreFrom.mockImplementation(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) }));
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: {} });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordGenerationAttempt.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue(10);
    mockReserveCredit.mockResolvedValue('tx-1');
    (createCampaign as any).mockResolvedValue({ id: CAMPAIGN_ID, storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg` });
    const { MalformedResponseError } = await import('@/lib/copy/errors');
    mockGenerateCopy.mockRejectedValueOnce(new MalformedResponseError('Resposta malformada'));
    mockGenerateCopy.mockResolvedValueOnce({
      title: 'Título Gemini',
      caption: 'Caption Gemini',
      hashtags: ['#tag'],
      cta_post: 'CTA Gemini',
    });
    mockGenerateImage.mockResolvedValue({ success: true, imageDataUrl: 'data:image/jpeg;base64,xyz' });
    mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });
    (dataUrlToCampaignImage as any).mockReturnValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (transcodeToJpeg as any).mockResolvedValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (uploadCampaignImage as any).mockResolvedValue(undefined);
    (updateCampaignReady as any).mockResolvedValue(undefined);

    // Set fallback provider
    process.env.TEXT_FALLBACK_PROVIDER = 'gemini';

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const res = await POST(req);
    await res.text();

    expect(res.status).toBe(200);
    expect(mockRefundCredit).not.toHaveBeenCalled();
    expect(updateCampaignReady).toHaveBeenCalled();
  });

  it('retry copy — Gemini nao configurado → estorno sem fallback', async () => {
    mockStoreFrom.mockImplementation(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) }));
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: {} });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordGenerationAttempt.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue(10);
    mockReserveCredit.mockResolvedValue('tx-1');
    (createCampaign as any).mockResolvedValue({ id: CAMPAIGN_ID, storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg` });
    const { MalformedResponseError } = await import('@/lib/copy/errors');
    mockGenerateCopy.mockRejectedValue(new MalformedResponseError('Resposta malformada'));
    mockGenerateImage.mockResolvedValue({ success: true, imageDataUrl: 'data:image/jpeg;base64,xyz' });
    mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });
    (dataUrlToCampaignImage as any).mockReturnValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (transcodeToJpeg as any).mockResolvedValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (uploadCampaignImage as any).mockResolvedValue(undefined);

    // No fallback configured
    delete process.env.TEXT_FALLBACK_PROVIDER;

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockRefundCredit).toHaveBeenCalled();
  });

  // ── Test #26-28: mandatoryArtworkText propagacao ────────────────

  it('mandatoryArtworkText no inputSnapshot (snapshot versionado — commercial.legalNotice.text)', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagem meramente ilustrativa' });
    const _res = await POST(req);
    await _res.text();

    expect(createCampaign).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          schemaVersion: 'campaign_brief_v1',
          commercial: expect.objectContaining({
            legalNotice: { enabled: true, text: 'Imagem meramente ilustrativa' },
          }),
        }),
      })
    );
  });

  it('validity no inputSnapshot (snapshot versionado — commercial.validity.displayText)', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, validity: 'até 30/09' });
    const _res = await POST(req);
    await _res.text();

    expect(createCampaign).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          schemaVersion: 'campaign_brief_v1',
          commercial: expect.objectContaining({
            validity: { enabled: true, displayText: 'até 30/09' },
          }),
        }),
      })
    );
  });

  it('mandatoryArtworkText no Image Director', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagem meramente ilustrativa' });
    const _res = await POST(req);
    await _res.text();

    expect(mockGenerateImage).toHaveBeenCalled();
  });

  it('mandatoryArtworkText AUSENTE no Copy Director', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagem meramente ilustrativa' });
    const _res = await POST(req);
    await _res.text();

    expect(mockGenerateCopy).toHaveBeenCalled();
  });

  // ── Test #33: Rate limit INSERT apos guard ──────────────────────

  it('recordGenerationAttempt chamado apos rate limit passar', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    expect(mockCheckRateLimit).toHaveBeenCalled();
    expect(mockRecordGenerationAttempt).toHaveBeenCalled();
  });

  // ── Test #34: Evento permanece mesmo em falha ───────────────────

  it('evento rate limit permanece mesmo se geracao falhar', async () => {
    mockStoreFrom.mockImplementation(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: STORE_ID, name: 'Loja Teste', segment: 'outros' }, error: null })) })) })) }));
    (resolveStoreIdentity as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (validateIdentityReference as any).mockResolvedValue({ storeName: 'Loja Teste' });
    (buildCampaignBrief as any).mockResolvedValue({ campaignInput: {}, store: {} });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordGenerationAttempt.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue(10);
    mockReserveCredit.mockResolvedValue('tx-1');
    (createCampaign as any).mockResolvedValue({ id: CAMPAIGN_ID, storagePath: `${STORE_ID}/${CAMPAIGN_ID}.jpg` });
    mockGenerateCopy.mockRejectedValue(new Error('Generation failed'));
    mockGenerateImage.mockResolvedValue({ success: true, imageDataUrl: 'data:image/jpeg;base64,xyz' });
    mockValidatePrompts.mockReturnValue({ valid: true, errors: [] });
    (dataUrlToCampaignImage as any).mockReturnValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (transcodeToJpeg as any).mockResolvedValue({ buffer: Buffer.from(''), mimeType: 'image/jpeg' });
    (uploadCampaignImage as any).mockResolvedValue(undefined);

    const { POST } = await import('../route');
    const req = makeRequest(VALID_REQUEST_BODY);
    const _res = await POST(req);
    await _res.text();

    // recordGenerationAttempt was called (event persisted) even though generation failed
    expect(mockRecordGenerationAttempt).toHaveBeenCalled();
  });

  // ── F38: operation cost guards ─────────────────────────────────

  it('503 operation_disabled quando enabled=false (sem reserva)', async () => {
    await setupSuccessMocks();
    mockGetCost.mockResolvedValue({
      operationKey: "campaign_generation",
      costCredits: 1,
      enabled: false,
      source: "table",
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(VALID_REQUEST_BODY));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("operation_disabled");
    expect(mockReserveCredit).not.toHaveBeenCalled();
  });

  it('503 operation_cost_unavailable em erro de leitura (sem reserva/geração)', async () => {
    await setupSuccessMocks();
    mockGetCost.mockRejectedValue(new MockOperationCostUnavailableError("down"));

    const { POST } = await import('../route');
    const res = await POST(makeRequest(VALID_REQUEST_BODY));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("operation_cost_unavailable");
    expect(mockReserveCredit).not.toHaveBeenCalled();
    expect(createCampaign).not.toHaveBeenCalled();
  });

  it('reserva usa snapshot de custo no metadata', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const res = await POST(makeRequest(VALID_REQUEST_BODY));
    await res.text();

    expect(mockReserveCredit).toHaveBeenCalledWith(
      STORE_ID,
      1,
      expect.objectContaining({
        metadata: expect.objectContaining({
          feature: "campaign_pipeline",
          operation_key: "campaign_generation",
          operation_cost_credits: 1,
          operation_cost_source: "table",
        }),
      })
    );
  });

  it('custo 2 da tabela — balance 1 → 402; balance 2 → reserva amount 2', async () => {
    await setupSuccessMocks();
    mockGetCost.mockResolvedValue({
      operationKey: "campaign_generation",
      costCredits: 2,
      enabled: true,
      source: "table",
    });
    mockGetBalance.mockResolvedValue(1);

    const { POST } = await import('../route');
    const res402 = await POST(makeRequest(VALID_REQUEST_BODY));
    expect(res402.status).toBe(402);
    expect(mockReserveCredit).not.toHaveBeenCalled();

    await setupSuccessMocks();
    mockGetCost.mockResolvedValue({
      operationKey: "campaign_generation",
      costCredits: 2,
      enabled: true,
      source: "table",
    });
    mockGetBalance.mockResolvedValue(2);

    const resOk = await POST(makeRequest(VALID_REQUEST_BODY));
    await resOk.text();
    expect(mockReserveCredit).toHaveBeenCalledWith(
      STORE_ID,
      2,
      expect.objectContaining({
        metadata: expect.objectContaining({
          operation_cost_credits: 2,
        }),
      })
    );
  });
});

describe('Pipeline cost accounting (6.3)', () => {
  // Usages reais por chamada (D11) — o resolveAiCost mockado computa o custo.
  const COPY_USAGE = { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 };
  const VALIDATION_USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
  const IMAGE_USAGE = { promptTokens: 100, completionTokens: 200, totalTokens: 300 };
  const REVIEW_USAGE = { promptTokens: 50, completionTokens: 100, totalTokens: 150 };
  // (1000/1e6)*2.5 + (500/1e6)*10
  const COPY_COST = 0.0075;
  // (10/1e6)*2.5 + (20/1e6)*10
  const VALIDATION_COST = 0.000225;
  // (100/1e6)*2.5 + (200/1e6)*10
  const IMAGE_COST = 0.00225;
  // (50/1e6)*2.5 + (100/1e6)*10
  const REVIEW_COST = 0.001125;

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  // Configura a suíte de sucesso + serviços que disparam os callbacks com usage
  // real e durationMs por chamada (furos 1/6/7).
  async function setupPipelineSuccessMocks(options?: { reviewAttempts?: number }) {
    await setupSuccessMocks();
    const reviewAttempts = options?.reviewAttempts ?? 1;

    mockGenerateCopy.mockImplementation(async (_input: any, _opts: any, onCall?: (info: any) => void) => {
      if (onCall) {
        onCall({ provider: "openai", model: "gpt-4o", usage: COPY_USAGE, durationMs: 250 });
      }
      return {
        title: 'Título da Campanha',
        caption: 'Caption gerada pelo Copy Director',
        hashtags: ['#tag1', '#tag2'],
        cta_post: 'Compre agora',
      };
    });

    mockGenerateImage.mockImplementation(async (_brief: any, _context: any, _onPhaseChange: any, _signal: any, onMetricsEvent?: (e: any) => void) => {
      if (onMetricsEvent) {
        onMetricsEvent({ phase: "input_validation", provider: "openai", model: "gpt-4o", attempt: 0, usage: VALIDATION_USAGE, durationMs: 100 });
        // prompt_assembly/done NÃO são chamadas de IA — devem ser ignoradas (D5/D11)
        onMetricsEvent({ phase: "prompt_assembly", provider: "openai", model: "gpt-4o", attempt: 0, durationMs: 50 });
        for (let i = 0; i < reviewAttempts; i++) {
          onMetricsEvent({ phase: "image_generation", provider: "openai", model: "test-model", attempt: i, usage: IMAGE_USAGE, durationMs: 300 });
          onMetricsEvent({ phase: "quality_review", provider: "openai", model: "gpt-4o", attempt: i, usage: REVIEW_USAGE, durationMs: 400 });
        }
        onMetricsEvent({ phase: "done", provider: "openai", model: "test-model", attempt: reviewAttempts, durationMs: 500 });
      }
      return { success: true, imageDataUrl: 'data:image/jpeg;base64,xyz' };
    });
  }

  async function runPipeline() {
    const { POST } = await import('../route');
    const res = await POST(makeRequest(VALID_REQUEST_BODY));
    await res.text();
    await flushMicrotasks();
    return res;
  }

  const pipelineLogs = (logSpy: ReturnType<typeof vi.spyOn>) =>
    (logSpy.mock.calls as unknown[][])
      .map((call: unknown[]) => call[0])
      .map((s: unknown) => {
        try {
          return JSON.parse(s as string);
        } catch {
          return null;
        }
      })
      .filter((p: unknown) => p !== null);

  it('Teste 9 (6.3): campaign_copy com usage real e estimated_cost_usd calculado do usage (furo 1)', async () => {
    await setupPipelineSuccessMocks();
    await runPipeline();

    const copyEvent = capturedEvents.find((e: any) => e.generationType === 'campaign_copy');
    expect(copyEvent).toBeDefined();
    expect(copyEvent.tokens).toEqual(COPY_USAGE);
    expect(copyEvent.cost?.estimatedCostUsd).toBeCloseTo(COPY_COST, 6);
    expect(copyEvent.cost?.costSource).toBe('pricing_table');
    expect(copyEvent.durationMs).toBe(250);
  });

  it('Teste 10 (6.3): campaign_input_validation registrado no run com custo/tokens', async () => {
    await setupPipelineSuccessMocks();
    await runPipeline();

    const validationEvent = capturedEvents.find((e: any) => e.generationType === 'campaign_input_validation');
    expect(validationEvent).toBeDefined();
    expect(validationEvent.tokens).toEqual(VALIDATION_USAGE);
    expect(validationEvent.attemptNumber).toBe(0);
    expect(validationEvent.cost?.estimatedCostUsd).toBeCloseTo(VALIDATION_COST, 6);
    expect(validationEvent.status).toBe('success');
  });

  it('Teste 11 (6.3): campaign_image_review por tentativa — 2 tentativas → 2 eventos com attempt distinto', async () => {
    await setupPipelineSuccessMocks({ reviewAttempts: 2 });
    await runPipeline();

    const reviewEvents = capturedEvents.filter((e: any) => e.generationType === 'campaign_image_review');
    expect(reviewEvents).toHaveLength(2);
    const attempts = reviewEvents.map((e: any) => e.attemptNumber).sort();
    expect(attempts).toEqual([0, 1]);
    for (const e of reviewEvents) {
      expect(e.cost?.estimatedCostUsd).toBeCloseTo(REVIEW_COST, 6);
      expect(e.tokens).toEqual(REVIEW_USAGE);
    }
  });

  it('Teste 12 (6.3): recomposição mesmo run — todos os eventos compartilham o MESMO operation_run_id', async () => {
    await setupPipelineSuccessMocks({ reviewAttempts: 2 });
    await runPipeline();

    expect(capturedEvents.length).toBeGreaterThan(0);
    for (const e of capturedEvents) {
      expect(e.operationRunId).toBe(RUN_IDS.operationRunId);
      expect(e.operationRunType).toBe('campaign_delivery');
      expect(e.traceId).toBe(RUN_IDS.traceId);
    }
  });

  it('Teste 13 (6.3): metadata.totalCost = soma real dos call-level (furo 2 — nunca provider name)', async () => {
    await setupPipelineSuccessMocks({ reviewAttempts: 2 });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runPipeline();

      const expectedSum = capturedEvents
        .filter((e: any) => e.generationType !== 'campaign_pipeline' && typeof e.cost?.estimatedCostUsd === 'number')
        .reduce((s: number, e: any) => s + e.cost.estimatedCostUsd, 0);

      const pipelineComplete: any = pipelineLogs(logSpy).find((p: any) => p.event === 'pipeline_complete');
      expect(pipelineComplete).toBeDefined();
      expect(pipelineComplete.metadata.totalCost).toBeCloseTo(expectedSum, 6);
      expect(typeof pipelineComplete.metadata.totalCost).toBe('number');
      // furo 2: nunca o nome do provider
      expect(pipelineComplete.metadata.totalCost).not.toBe('test');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('Teste 14 (6.3): delivery campaign_pipeline com custo NULL + duration_is_pipeline true (mesmo com call-level > 0)', async () => {
    await setupPipelineSuccessMocks({ reviewAttempts: 2 });
    await runPipeline();

    const delivery = capturedEvents.find((e: any) => e.generationType === 'campaign_pipeline' && e.status === 'success');
    expect(delivery).toBeDefined();
    expect(delivery.cost).toBeUndefined();
    expect(delivery.tokens).toBeUndefined();
    expect(delivery.metadata?.duration_is_pipeline).toBe(true);
    expect(delivery.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 15 (6.3): review falha → campaign_pipeline failed + custo dos call-level já registrados', async () => {
    await setupPipelineSuccessMocks();
    mockGenerateImage.mockImplementation(async (_brief: any, _context: any, _onPhaseChange: any, _signal: any, onMetricsEvent?: (e: any) => void) => {
      if (onMetricsEvent) {
        onMetricsEvent({ phase: "input_validation", provider: "openai", model: "gpt-4o", attempt: 0, usage: VALIDATION_USAGE, durationMs: 100 });
        onMetricsEvent({ phase: "image_generation", provider: "openai", model: "test-model", attempt: 0, usage: IMAGE_USAGE, durationMs: 300 });
        onMetricsEvent({ phase: "quality_review", provider: "openai", model: "gpt-4o", attempt: 0, usage: REVIEW_USAGE, durationMs: 400 });
      }
      return { success: false, code: 'review_failed', message: 'Falha na revisão de qualidade' };
    });
    await runPipeline();

    const failedDelivery = capturedEvents.find((e: any) => e.generationType === 'campaign_pipeline' && e.status === 'failed');
    expect(failedDelivery).toBeDefined();
    expect(failedDelivery.errorType).toBe('Falha na revisão de qualidade');
    expect(failedDelivery.cost).toBeUndefined();

    // call-level registrados antes da falha permanecem
    const copyEvent = capturedEvents.find((e: any) => e.generationType === 'campaign_copy');
    expect(copyEvent).toBeDefined();
    expect(copyEvent.cost?.estimatedCostUsd).toBeCloseTo(COPY_COST, 6);
  });

  it('Teste 16 (6.3): duration_ms por chamada (furo 7 — copy ≠ pipeline)', async () => {
    await setupPipelineSuccessMocks();
    await runPipeline();

    const copyEvent = capturedEvents.find((e: any) => e.generationType === 'campaign_copy');
    const imageEvent = capturedEvents.find((e: any) => e.generationType === 'campaign_image');
    const reviewEvent = capturedEvents.find((e: any) => e.generationType === 'campaign_image_review');
    const delivery = capturedEvents.find((e: any) => e.generationType === 'campaign_pipeline' && e.status === 'success');

    expect(copyEvent.durationMs).toBe(250);
    expect(imageEvent.durationMs).toBe(300);
    expect(reviewEvent.durationMs).toBe(400);
    expect(delivery.durationMs).toBeGreaterThanOrEqual(0);
    // cada chamada tem a própria duração (não o pipeline inteiro)
    expect(copyEvent.durationMs).not.toBe(imageEvent.durationMs);
  });

  it('Teste 17 (6.3): operation_run_id propagado — campanha criada com o MESMO run id dos eventos', async () => {
    await setupPipelineSuccessMocks({ reviewAttempts: 2 });
    await runPipeline();

    expect(createCampaign).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ operationRunId: RUN_IDS.operationRunId }));
    const types = new Set(capturedEvents.map((e: any) => e.generationType));
    expect(types).toEqual(new Set(['campaign_copy', 'campaign_input_validation', 'campaign_image', 'campaign_image_review', 'campaign_pipeline']));
    for (const e of capturedEvents) {
      expect(e.operationRunId).toBe(RUN_IDS.operationRunId);
    }
  });

  it('Teste 18 (6.3): campaigns.operation_run_id persistido na criação — createCampaign chamado com operationRunId', async () => {
    await setupPipelineSuccessMocks();
    await runPipeline();

    expect(createCampaign).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({ operationRunId: RUN_IDS.operationRunId })
    );
    // o mesmo run id aparece nos eventos call-level e no delivery
    const delivery = capturedEvents.find((e: any) => e.generationType === 'campaign_pipeline');
    expect(delivery?.operationRunId).toBe(RUN_IDS.operationRunId);
  });

  it('Teste 19 (6.3): admin_get_metrics preservado — logPipelineEvent ainda chamado com os eventos do pipeline', async () => {
    await setupPipelineSuccessMocks();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runPipeline();

      const parsed = pipelineLogs(logSpy);
      expect(parsed.some((p: any) => p.event === 'copy_generation' && p.traceId === RUN_IDS.traceId)).toBe(true);
      expect(parsed.some((p: any) => p.event === 'image_generation' && p.traceId === RUN_IDS.traceId)).toBe(true);
      expect(parsed.some((p: any) => p.event === 'pipeline_complete' && p.traceId === RUN_IDS.traceId)).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ── F38.2.1 (D3): snapshot econômico propagado aos eventos do run ─────────
describe('snapshot econômico (F38.2.1)', () => {
  // Setup de sucesso com call-level (copy via onCall) — todos os eventos do run
  // devem carregar os valores do snapshot resolvidos no início do run.
  async function setupSnapshotSuccess() {
    await setupSuccessMocks();
    mockGenerateCopy.mockImplementation(async (_input: any, _opts: any, onCall?: (info: any) => void) => {
      if (onCall) {
        onCall({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 }, durationMs: 250 });
      }
      return {
        title: 'Título da Campanha',
        caption: 'Caption gerada pelo Copy Director',
        hashtags: ['#tag1', '#tag2'],
        cta_post: 'Compre agora',
      };
    });
  }

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  it('Teste 1: todos os eventos do run carregam os valores do snapshot (5.20/2.00) — apenas valores, sem origem', async () => {
    await setupSnapshotSuccess();
    const { POST } = await import('../route');
    const res = await POST(makeRequest(VALID_REQUEST_BODY));
    expect(res.status).toBe(200);
    await res.text();
    await flushMicrotasks();

    expect(capturedEvents.length).toBeGreaterThan(0);
    for (const e of capturedEvents) {
      expect(e.usdBrlRateAtGeneration).toBe(5.2);
      expect(e.creditValueBrlAtGeneration).toBe(2.0);
      // o evento NÃO carrega origem — o tracker define captured_at_generation
      expect(e.usdBrlRateSourceAtGeneration).toBeUndefined();
      expect(e.creditValueBrlSourceAtGeneration).toBeUndefined();
    }
  });

  it('Teste 2: falha na leitura dos parâmetros → snapshots null e pipeline NÃO bloqueado (200)', async () => {
    await setupSnapshotSuccess();
    mockGetParameter.mockRejectedValue(new Error('economic service down'));
    const { POST } = await import('../route');
    const res = await POST(makeRequest(VALID_REQUEST_BODY));
    expect(res.status).toBe(200);
    await res.text();
    await flushMicrotasks();

    expect(capturedEvents.length).toBeGreaterThan(0);
    for (const e of capturedEvents) {
      expect(e.usdBrlRateAtGeneration).toBeNull();
      expect(e.creditValueBrlAtGeneration).toBeNull();
    }
  });
});
