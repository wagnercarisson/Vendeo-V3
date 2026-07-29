import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockGetClaims = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: mockSupabaseFrom,
  })),
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/auth/require-user', () => ({
  requireUser: vi.fn(async () => ({ userId: 'user-123', claims: { sub: 'user-123' } })),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") { super(message); this.name = "UnauthorizedError"; }
  },
}));

vi.mock('@/lib/auth/store-ownership', () => ({
  requireOwnership: vi.fn(),
  StoreNotFoundError: class StoreNotFoundError extends Error {
    constructor(message = "Store not found or access denied") { super(message); this.name = "StoreNotFoundError"; }
  },
}));

vi.mock('@/lib/store-response', () => ({
  buildStoreResponse: vi.fn(),
}));

import { requireOwnership } from '@/lib/auth/store-ownership';
import { buildStoreResponse } from '@/lib/store-response';

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockStore = {
  id: STORE_ID,
  user_id: 'user-123',
  name: 'Minha Loja',
  segment: 'outros',
  brand_color: '#22C55E',
  city: null,
  state: null,
  identity_state: 'text_only',
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  logo_url: null,
  logo_status: null,
  manual_color_override: false,
  previous_identity_snapshot: null,
  visual_signature_attempts: 0,
  text_only_origin: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  cnpj_normalized: null,
  cnpj_root_hash: '',
  razao_social: null,
  nome_fantasia: null,
  cnpj_validation_score: null,
  verification_status: 'unverified',
  verification_data: null,
  cnpj_official_data: null,
  cnpj_lookup_hash: null,
  verification_requested_at: null,
  verification_decided_at: null,
  verification_reasons: null,
  is_test_store: false,
};

const mockEnrichedResponse = {
  ...mockStore,
  identity: {
    storeName: 'Minha Loja',
    storeSegment: 'outros',
    brandColor: '#22C55E',
    identityState: 'text_only' as const,
    signature: { url: null, type: null },
    storeInitials: 'ML',
    brandProfile: null,
    toneOfVoice: null,
    subsegment: null,
    positioning: null,
    shortDescription: null,
    slogan: null,
  },
  visual_signature_url: null,
  logo_url: null,
  has_archived_signatures: false,
};

describe('GET /api/store/[id] — enriched with identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: 'user-123' } }, error: null });
  });

  it('returns store + identity snapshot', async () => {
    vi.mocked(requireOwnership).mockResolvedValue(mockStore);
    vi.mocked(buildStoreResponse).mockResolvedValue(mockEnrichedResponse);

    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(STORE_ID);
    expect(body.name).toBe('Minha Loja');
    expect(body.identity).toBeDefined();
    expect(body.identity.identityState).toBe('text_only');
    expect(body.identity.signature.url).toBeNull();
  });

  it('returns logo_url from identity for logo state', async () => {
    vi.mocked(requireOwnership).mockResolvedValue({ ...mockStore, identity_state: 'logo' });
    vi.mocked(buildStoreResponse).mockResolvedValue({
      ...mockEnrichedResponse,
      identity: {
        ...mockEnrichedResponse.identity,
        identityState: 'logo',
        signature: { url: 'https://example.com/logo.png', type: 'logo' },
      },
      logo_url: 'https://example.com/logo.png',
    });

    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logo_url).toBe('https://example.com/logo.png');
    expect(body.visual_signature_url).toBeNull();
  });

  it('returns 404 for non-existent store', async () => {
    const { StoreNotFoundError } = await import('@/lib/auth/store-ownership');
    vi.mocked(requireOwnership).mockRejectedValue(new StoreNotFoundError());

    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/00000000-0000-0000-0000-000000000000`));
    const res = await GET(req, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Store not found');
  });
});

describe('PATCH /api/store/[id] — persist razaoSocial/nomeFantasia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset(); // Clear lingering mockReturnValueOnce from prior tests
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: 'user-123' } }, error: null });
    vi.mocked(requireOwnership).mockResolvedValue(mockStore);
  });

  function patchRequest(body: Record<string, unknown>) {
    return new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost', 'host': 'localhost' },
      body: JSON.stringify(body),
    }));
  }

  /**
   * Mock supabase chain for PATCH handler with CNPJ atomicity guard.
   * Works for ANY combination of guard SELECT + UPDATE chains because it
   * uses a single `from()` return value that routes through `single()` call
   * count to serve different results for guard (CNPJ check) vs update (store data).
   *
   * Guard chain:  .select("cnpj_normalized").eq("id", id).single()
   * Update chain: .update(updates).eq("id", id).select().single()
   *
   * @param guardCnpj CNPJ value the guard should return (default valid CNPJ)
   * @param supabaseResult Data the update chain should return
   * @returns The mockUpdate function for assertions
   */
  function mockSupabaseChain(supabaseResult: Record<string, unknown>, guardCnpj: string | null = "12345678000195") {
    let singleCallCount = 0;
    const mockSingle = vi.fn().mockImplementation(() => {
      singleCallCount++;
      // 1st .single() call → guard result; 2nd → update result
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { cnpj_normalized: guardCnpj }, error: null });
      }
      return Promise.resolve({ data: supabaseResult, error: null });
    });
    const mockEq = vi.fn(() => ({ single: mockSingle, select: mockSelect }));
    const mockSelect = vi.fn(() => ({ single: mockSingle, eq: mockEq }));
    const mockUpdate = vi.fn(() => ({ eq: mockEq }));

    mockSupabaseFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      eq: mockEq,
      single: mockSingle,
    });

    return mockUpdate;
  }

  it('persists razao_social and nome_fantasia', async () => {
    const mockUpdate = mockSupabaseChain({ ...mockStore, razao_social: 'Minha Loja Ltda', nome_fantasia: 'Minha Loja' });

    const { PATCH } = await import('../route');
    const res = await PATCH(patchRequest({ razaoSocial: 'Minha Loja Ltda', nomeFantasia: 'Minha Loja' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      razao_social: 'Minha Loja Ltda',
      nome_fantasia: 'Minha Loja',
    }));
  });

  it('applies fallback nome_fantasia = razao_social when nomeFantasia is empty', async () => {
    const mockUpdate = mockSupabaseChain({ ...mockStore, razao_social: 'Razao Social Ltda', nome_fantasia: 'Razao Social Ltda' });

    const { PATCH } = await import('../route');
    const res = await PATCH(patchRequest({ razaoSocial: 'Razao Social Ltda', nomeFantasia: '' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      razao_social: 'Razao Social Ltda',
      nome_fantasia: 'Razao Social Ltda',
    }));
  });

  it('rejects razaoSocial shorter than 2 characters', async () => {
    mockSupabaseChain({ ...mockStore });

    const { PATCH } = await import('../route');
    const res = await PATCH(patchRequest({ razaoSocial: 'X' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(400);
  });

  // --- CNPJ atomicity guard tests ---

  it('rejects razaoSocial when store has no cnpj_normalized', async () => {
    // Guard chain: store has NO cnpj_normalized
    const mockSingleGuard = vi.fn().mockResolvedValue({ data: { cnpj_normalized: null }, error: null });
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingleGuard })) })),
    });

    const { PATCH } = await import('../route');
    const res = await PATCH(patchRequest({ razaoSocial: 'Razao Social Ltda' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('CNPJ');
  });

  it('rejects nomeFantasia when store has no cnpj_normalized', async () => {
    const mockSingleGuard = vi.fn().mockResolvedValue({ data: { cnpj_normalized: null }, error: null });
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingleGuard })) })),
    });

    const { PATCH } = await import('../route');
    const res = await PATCH(patchRequest({ nomeFantasia: 'Nome Fantasia' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('CNPJ');
  });

  it('allows razaoSocial when store has cnpj_normalized', async () => {
    mockSupabaseChain({ ...mockStore, razao_social: 'Razao Autorizada Ltda' }, "12345678000195");

    const { PATCH } = await import('../route');
    const res = await PATCH(patchRequest({ razaoSocial: 'Razao Autorizada Ltda' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
  });

  it('allows non-fiscal fields when store has no cnpj_normalized', async () => {
    // Even without CNPJ, non-fiscal fields (e.g. name, segment) should still work.
    // The guard only checks when razaoSocial or nomeFantasia are present.
    const mockUpdate = mockSupabaseChain({ ...mockStore, name: 'Novo Nome' });

    const { PATCH } = await import('../route');
    const res = await PATCH(patchRequest({ name: 'Novo Nome' }), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Novo Nome',
    }));
  });
});
