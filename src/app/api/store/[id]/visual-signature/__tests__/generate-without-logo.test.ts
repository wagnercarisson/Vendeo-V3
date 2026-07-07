import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockIdentityDirectorGenerate = vi.fn();
const mockAiGeneratorGenerate = vi.fn();
const mockPersistSignature = vi.fn();
const mockInsertGenerationEvent = vi.fn();
const mockRevalidateCriticalDrift = vi.fn();
const mockGetActiveVisualSignature = vi.fn();

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
  getActiveVisualSignature: (...args: any[]) => mockGetActiveVisualSignature(...args),
}));

vi.mock('@/lib/visual-signature/generation-events', () => ({
  insertGenerationEvent: mockInsertGenerationEvent,
}));

vi.mock('@/lib/visual-signature/drift-revalidator', () => ({
  revalidateCriticalDrift: mockRevalidateCriticalDrift,
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
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'abcdef123456'),
      })),
    })),
  },
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

const mockStoreTextOnly = {
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

const mockStoreVisualSignature = {
  ...mockStoreTextOnly,
  identity_state: 'visual_signature',
};

const mockActiveVS = {
  id: 'active-vs-001',
  store_id: STORE_ID,
  status: 'active',
  asset_url: 'https://example.com/vs-active.png',
  metadata: {
    artDirectorOutput: {
      visual_direction: 'Moderna',
      content_used: { store_name: true, city: false, state: false, slogan: false },
    },
    input_snapshot: {
      name: 'Minha Loja',
      segment: 'alimentacao',
      slogan: null,
      city: null,
      state: null,
    },
  },
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

function setupStoreQuery(result: any) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'stores') return makeChain(result);
    if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
    return makeChain({ data: null, error: null });
  });
}

describe('POST /api/store/[id]/visual-signature/generate-without-logo — Substitution guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdentityDirectorGenerate.mockResolvedValue(mockSignatureResult);
    mockPersistSignature.mockResolvedValue(mockSignatureResult.signature);
    mockInsertGenerationEvent.mockResolvedValue(undefined);
    mockGetActiveVisualSignature.mockResolvedValue(mockActiveVS);
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: true,
      fields: ['name'],
      reason: 'critical_drift',
    });
  });

  it('should reject substitution when identity_state !== visual_signature', async () => {
    setupStoreQuery({ data: mockStoreTextOnly, error: null });
    mockGetActiveVisualSignature.mockResolvedValue(null); // won't reach this guard

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'substitution' }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_IDENTITY_STATE');
    expect(body.error).toContain('visual_signature');
  });

  it('should reject substitution when no active VS exists', async () => {
    setupStoreQuery({ data: mockStoreVisualSignature, error: null });
    mockGetActiveVisualSignature.mockResolvedValue(null);

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'substitution' }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NO_ACTIVE_VS');
  });

  it('should reject substitution when drift is not confirmed', async () => {
    setupStoreQuery({ data: mockStoreVisualSignature, error: null });
    mockGetActiveVisualSignature.mockResolvedValue(mockActiveVS);
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: false,
      fields: [],
      reason: 'ok',
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'substitution' }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('DRIFT_NOT_CONFIRMED');
  });

  it('should reject substitution when 3 signatures already exist', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStoreVisualSignature, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [{ id: 'sig1' }, { id: 'sig2' }, { id: 'sig3' }], error: null });
      return makeChain({ data: null, error: null });
    });
    mockGetActiveVisualSignature.mockResolvedValue(mockActiveVS);
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: true,
      fields: ['name'],
      reason: 'critical_drift',
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'substitution' }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.exhausted).toBe(true);
  });

  it('should allow substitution with 2 successful + 1 failed signature', async () => {
    // 2 successful (type ai_generated) + 1 failed attempt (no signature record with these types)
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: { ...mockStoreVisualSignature, visual_signature_attempts: 2 }, error: null });
      // Count only has 2 because the failed attempt doesn't have a record with type in ('ai_generated', 'automatic_generated')
      if (table === 'store_visual_signatures') return makeChain({ data: [{ id: 'sig1' }, { id: 'sig2' }], error: null });
      return makeChain({ data: null, error: null });
    });
    mockGetActiveVisualSignature.mockResolvedValue(mockActiveVS);
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: true,
      fields: ['name'],
      reason: 'critical_drift',
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'substitution' }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200); // should pass guards and proceed with generation
  });

  it('should allow substitution when historical drafts exist', async () => {
    // 2 drafts exist but total < 3
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStoreVisualSignature, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [{ id: 'draft1' }, { id: 'draft2' }], error: null });
      return makeChain({ data: null, error: null });
    });
    mockGetActiveVisualSignature.mockResolvedValue(mockActiveVS);
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: true,
      fields: ['name'],
      reason: 'critical_drift',
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'substitution' }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
  });

  it('should pass with standard mode (unchanged behavior)', async () => {
    setupStoreQuery({ data: mockStoreTextOnly, error: null });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'standard' }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('should default to standard mode when no mode provided', async () => {
    setupStoreQuery({ data: mockStoreTextOnly, error: null });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({}), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('POST /api/store/[id]/visual-signature/generate-without-logo — Failure path logo_status', () => {
  function countLogoStatusFailedUpdate(): number {
    // Collect ALL chain objects returned by mockSupabaseFrom for 'stores' calls
    const storesChains = mockSupabaseFrom.mock.results
      .filter((r, i) => mockSupabaseFrom.mock.calls[i]?.[0] === 'stores')
      .map(r => r.value)
      .filter(Boolean);
    let count = 0;
    for (const chain of storesChains) {
      if (chain.update?.mock?.calls) {
        for (const call of chain.update.mock.calls) {
          if (call[0]?.logo_status === 'failed') count++;
        }
      }
    }
    return count;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertGenerationEvent.mockResolvedValue(undefined);
    mockGetActiveVisualSignature.mockResolvedValue(null);
  });

  it('substitution failure — logo_status NOT modified', async () => {
    setupStoreQuery({ data: mockStoreVisualSignature, error: null });
    mockIdentityDirectorGenerate.mockRejectedValue(new Error('AI generation failed'));
    mockGetActiveVisualSignature.mockResolvedValue(mockActiveVS);
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: true,
      fields: ['name'],
      reason: 'critical_drift',
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'substitution' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(500);
    expect(countLogoStatusFailedUpdate()).toBe(0);
  });

  it('standard + common error — logo_status = failed', async () => {
    setupStoreQuery({ data: mockStoreTextOnly, error: null });
    mockIdentityDirectorGenerate.mockRejectedValue(new Error('AI generation failed'));

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'standard' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(500);
    expect(countLogoStatusFailedUpdate()).toBeGreaterThanOrEqual(1);
  });

  it('standard + storage error — logo_status NOT modified, returns 503', async () => {
    setupStoreQuery({ data: mockStoreTextOnly, error: null });
    mockIdentityDirectorGenerate.mockRejectedValue(new Error('Failed to upload to Storage: timeout'));

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest({ mode: 'standard' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(503);
    expect(countLogoStatusFailedUpdate()).toBe(0);
  });
});
