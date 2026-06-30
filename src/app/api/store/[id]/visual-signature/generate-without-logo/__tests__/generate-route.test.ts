import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockIdentityDirectorGenerate = vi.fn();
const mockAiGeneratorGenerate = vi.fn();
const mockPersistSignature = vi.fn();
const mockInsertGenerationEvent = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
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

  it('generation limit exhausted returns 403', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: { ...mockStore, visual_signature_attempts: 3 }, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [{ id: 'sig1' }, { id: 'sig2' }, { id: 'sig3' }], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(403);
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
    expect(body).toHaveProperty('attempt');
    expect(body).toHaveProperty('totalGenerated');
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

  it('generation increments visual_signature_attempts', async () => {
    let updatedAttempts: number | null = null;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        const chain = makeChain({ data: mockStore, error: null });
        chain.update = vi.fn((data: any) => {
          if (data.visual_signature_attempts !== undefined) updatedAttempts = data.visual_signature_attempts;
          return makeChain({ data: null, error: null });
        });
        return chain;
      }
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(updatedAttempts).toBe(1);
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
