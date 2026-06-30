import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/validators/color', () => ({
  validateBrandColorsChosen: vi.fn(() => true),
  normalizeBrandColorsChosen: vi.fn((c: any) => c),
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
  });
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockSyncedProfile = {
  id: 'profile-001',
  store_id: STORE_ID,
  status: 'synced',
  source: 'logo_analysis',
  created_at: '2026-06-15T00:00:00Z',
  safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
};

const mockRecentProfile = {
  id: 'profile-002',
  store_id: STORE_ID,
  status: 'draft',
  source: 'text_only',
  created_at: '2026-06-16T00:00:00Z',
  safe_color_tokens: { primary: '#000000', secondary: '#333333', accent: '#555555', background: '#FFFFFF' },
};

describe('GET /api/store/[id]/brand-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('without status param returns most recent profile', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') return makeChain({ data: mockRecentProfile, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/brand-profile`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('profile-002');
  });

  it('?status=synced returns synced profile when exists', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') return makeChain({ data: mockSyncedProfile, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/brand-profile?status=synced`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('profile-001');
    expect(body.status).toBe('synced');
  });

  it('?status=synced returns data: null when no synced profile', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/brand-profile?status=synced`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });
});
