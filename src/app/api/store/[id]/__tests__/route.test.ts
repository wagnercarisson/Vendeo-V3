import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/actions/store', () => ({
  resolveStoreIdentity: vi.fn(),
}));

import { resolveStoreIdentity } from '@/lib/actions/store';

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
  });
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockStore = {
  id: STORE_ID,
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
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const mockIdentitySnapshot = {
  storeName: 'Minha Loja',
  storeSegment: 'outros',
  brandColor: '#22C55E',
  identityState: 'text_only',
  signature: { url: null, type: null },
  storeInitials: 'ML',
  brandProfile: null,
  toneOfVoice: null,
  subsegment: null,
  positioning: null,
  shortDescription: null,
  slogan: null,
};

describe('GET /api/store/[id] — enriched with identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns store + identity snapshot', async () => {
    vi.mocked(resolveStoreIdentity).mockResolvedValue(mockIdentitySnapshot);
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null, count: 0 });
      return makeChain({ data: null, error: null });
    });

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
    vi.mocked(resolveStoreIdentity).mockResolvedValue({
      ...mockIdentitySnapshot,
      identityState: 'logo',
      signature: { url: 'https://example.com/logo.png', type: 'logo' },
    });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: { ...mockStore, identity_state: 'logo' }, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null, count: 0 });
      return makeChain({ data: null, error: null });
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
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
      return makeChain({ data: null, error: null });
    });

    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/00000000-0000-0000-0000-000000000000`));
    const res = await GET(req, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Store not found');
  });
});
