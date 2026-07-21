import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockIdentityDirectorGenerate = vi.fn();
const mockAiGeneratorGenerate = vi.fn();
const mockPersistSignature = vi.fn();
const mockInsertGenerationEvent = vi.fn();
const mockGetLaunchConfig = vi.fn();
const mockGetBalance = vi.fn();
const mockReserveCredit = vi.fn();
const mockRefundCredit = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/auth/store-ownership', () => ({
  requireAuthorizedStore: vi.fn(() => Promise.resolve({
    userId: 'test-user',
    storeId: 'test-store',
    store: { id: 'test-store' },
  })),
}));

vi.mock('@/lib/auth/csrf', () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock('@/lib/visual-signature/identity-art-director', () => ({
  StoreIdentityArtDirectorService: class {
    generate = mockIdentityDirectorGenerate;
  },
}));

vi.mock('@/lib/visual-signature/ai-image-generator', () => ({
  AiImageGenerator: class {
    generate = mockAiGeneratorGenerate;
  },
}));

vi.mock('@/lib/visual-signature/persistence', () => ({
  persistSignature: mockPersistSignature,
}));

vi.mock('@/lib/visual-signature/generation-events', () => ({
  insertGenerationEvent: mockInsertGenerationEvent,
}));

vi.mock('@/lib/launch-config/config', () => ({
  getLaunchConfig: mockGetLaunchConfig,
}));

vi.mock('@/lib/credit/credit-service', () => ({
  CreditService: class {
    getBalance = mockGetBalance;
    reserveCredit = mockReserveCredit;
    refundCredit = mockRefundCredit;
  },
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => 'mocked prompt content'),
    existsSync: vi.fn(() => true),
  },
  readFileSync: vi.fn(() => 'mocked prompt content'),
  existsSync: vi.fn(() => true),
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-op-id'),
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'abcdef123456'),
      })),
    })),
  },
  randomUUID: vi.fn(() => 'test-op-id'),
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => 'abcdef123456'),
    })),
  })),
}));

function makeChain(result: any) {
  const resolvable = Promise.resolve(result);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  });
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SIG_ID = '660e8400-e29b-41d4-a716-446655440001';

const mockStore = {
  id: STORE_ID,
  name: 'Minha Loja',
  segment: 'alimentacao',
  subsegment: null,
  tone_of_voice: 'moderno',
  positioning: null,
  short_description: null,
  slogan: null,
  city: null,
  state: null,
  brand_color: '#CC0000',
  visual_signature_attempts: 0,
  identity_state: 'text_only',
};

const mockSignatureResult = {
  signature: {
    id: SIG_ID,
    store_id: STORE_ID,
    asset_url: 'https://example.com/vs.png',
    status: 'draft',
    type: 'ai_generated',
    metadata: {
      artDirectorOutput: {
        visual_direction: 'Moderna',
        content_used: { store_name: true, city: false, state: false, slogan: false },
      },
    },
  },
  artDirectorOutput: {
    creative_description: 'Teste',
    suggested_colors: ['#22C55E'],
    visual_direction: 'Moderna',
    elements_used: ['nome da loja'],
  },
  metadataArtDirectorOutput: {
    visual_direction: 'Moderna',
    content_used: { store_name: true, city: false, state: false, slogan: false },
  },
  assetUrl: 'https://example.com/vs.png',
};

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature/generate-without-logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/store/[id]/visual-signature/generate-without-logo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: true,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });
    mockGetBalance.mockResolvedValue(5);
    mockReserveCredit.mockResolvedValue('ct-001');
    mockRefundCredit.mockResolvedValue('refund-tx');
    mockIdentityDirectorGenerate.mockResolvedValue(mockSignatureResult);
    mockPersistSignature.mockResolvedValue(mockSignatureResult.signature);
    mockInsertGenerationEvent.mockResolvedValue(undefined);
  });

  it('invalid store ID returns 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store/invalid/visual-signature/generate-without-logo', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    const res = await POST(req, { params: Promise.resolve({ id: 'invalid' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ID da loja inválido');
  });

  it('store not found returns 404', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: null, error: { message: 'not found' } });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Loja não encontrada');
  });

  it('saldo zero returns 402', async () => {
    mockGetBalance.mockResolvedValue(0);
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe('insufficient_credits');
  });

  it('successful generation returns expected shape', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('assetUrl');
    expect(body).toHaveProperty('signatureId');
    expect(body).toHaveProperty('artDirectorOutput');
  });

  it('generation calls StoreIdentityArtDirectorService', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(mockIdentityDirectorGenerate).toHaveBeenCalled();
  });

  it('credit_tx_id nao e definido quando creditsChargingEnabled=false', async () => {
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: false,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const storeSigUpdateCalls = mockSupabaseFrom.mock.results
      .filter((r: any, i: number) => mockSupabaseFrom.mock.calls[i]?.[0] === 'store_visual_signatures')
      .map((r: any) => r.value.update?.mock?.calls ?? [])
      .flat();
    const hasCreditTx = storeSigUpdateCalls.some((call: any) =>
      call[0]?.metadata?.credit_tx_id !== undefined
    );
    expect(hasCreditTx).toBe(false);
  });

  it('generation records generation event on success', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(mockInsertGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        has_generated_signature: true,
      })
    );
  });

  it('rejection context is passed to service', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: { ...mockStore, visual_signature_attempts: 1 }, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [{ id: 'sig1' }], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    await POST(makeRequest({ rejectionContext: { reason: 'not_good', attempt: 1 } }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(mockIdentityDirectorGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        rejectionContext: expect.objectContaining({ reason: 'not_good' }),
      }),
      expect.any(AbortSignal)
    );
  });
});
