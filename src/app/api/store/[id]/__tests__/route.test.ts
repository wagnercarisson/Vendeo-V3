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
