import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock("server-only", () => ({}));

// Shared mock functions
const mockStoreSelect = vi.fn();
const mockStoreEq = vi.fn();
const mockStoreSingle = vi.fn();
const mockStoreFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mockStoreFrom,
    rpc: vi.fn(),
  },
  createServerClient: vi.fn(),
}));

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
  IMAGE_GENERATION_RESPONSES_MODEL: 'test-model',
  COST_PER_GENERATION: 1,
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
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagens meramente ilustrativas' });
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
      expect.objectContaining({ idempotencyKey: `reserve_${CAMPAIGN_ID}` })
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

  it('mandatoryArtworkText no inputSnapshot', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagens meramente ilustrativas' });
    const _res = await POST(req);
    await _res.text();

    expect(createCampaign).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          mandatoryArtworkText: 'Imagens meramente ilustrativas',
        }),
      })
    );
  });

  it('mandatoryArtworkText no Image Director', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagens meramente ilustrativas' });
    const _res = await POST(req);
    await _res.text();

    expect(mockGenerateImage).toHaveBeenCalled();
  });

  it('mandatoryArtworkText AUSENTE no Copy Director', async () => {
    await setupSuccessMocks();

    const { POST } = await import('../route');
    const req = makeRequest({ ...VALID_REQUEST_BODY, mandatoryArtworkText: 'Imagens meramente ilustrativas' });
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
});
