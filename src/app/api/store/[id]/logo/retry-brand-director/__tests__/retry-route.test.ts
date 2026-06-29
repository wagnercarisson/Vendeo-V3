import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockSupabaseStorageFrom = vi.fn();
const mockBrandDirectorAnalyze = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    storage: {
      from: mockSupabaseStorageFrom,
    },
  },
}));

vi.mock('@/lib/brand-assets/brand-director', () => ({
  BrandDirectorService: class {
    analyze = mockBrandDirectorAnalyze;
  },
  BrandDirectorAnalysisError: class extends Error {
    deterministicResult = null;
    metadata = {};
    constructor(message: string) { super(message); this.name = 'BrandDirectorAnalysisError'; }
  },
}));

function makeChain(result: any) {
  const wrapped = result !== null ? { data: result, error: null } : { data: null, error: null };
  const resolvable = Promise.resolve(wrapped);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(wrapped)),
    single: vi.fn(() => chain),
    insert: vi.fn(() => {
      const insertResolvable = Promise.resolve({ data: result, error: null });
      const insertChain = Object.assign(() => insertResolvable, {
        then: insertResolvable.then.bind(insertResolvable),
        select: vi.fn(() => insertChain),
        single: vi.fn(() => Promise.resolve({ data: result, error: null })),
      });
      return insertChain;
    }),
    update: vi.fn(() => chain),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    },
  });
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';
const ASSET_ID = '660e8400-e29b-41d4-a716-446655440001';
const FALLBACK_PROFILE_ID = '770e8400-e29b-41d4-a716-446655440002';
const NEW_PROFILE_ID = '880e8400-e29b-41d4-a716-446655440003';

const mockStore = {
  id: STORE_ID,
  name: 'Test Store',
  segment: 'food',
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  city: null,
  state: null,
  brand_color: '#1a365d',
  identity_state: 'logo',
};

const mockActiveAsset = {
  id: ASSET_ID,
  store_id: STORE_ID,
  asset_type: 'logo',
  variant_type: 'original',
  source: 'user_upload',
  storage_path: 'test/path.png',
  mime_type: 'image/png',
  status: 'active',
  version: 1,
};

const mockFailedProfile = {
  id: '990e8400-e29b-41d4-a716-446655440004',
  store_id: STORE_ID,
  source: 'logo_analysis',
  active_logo_asset_id: ASSET_ID,
  status: 'failed',
  metadata: { error: 'analysis failed' },
};

const mockSyncedProfile = {
  id: FALLBACK_PROFILE_ID,
  store_id: STORE_ID,
  source: 'logo_analysis',
  active_logo_asset_id: ASSET_ID,
  status: 'synced',
  brand_colors_chosen: ['#1a365d', '#e53e3e'],
  safe_color_tokens: { primary: '#1a365d', accent: '#e53e3e' },
  inferred_accent_color: '#e53e3e',
};

const mockNewProfile = {
  id: NEW_PROFILE_ID,
  store_id: STORE_ID,
  source: 'logo_analysis',
  active_logo_asset_id: ASSET_ID,
  status: 'synced',
  brand_colors_chosen: ['#1a365d', '#e53e3e'],
};

function createRequest() {
  const url = `http://localhost/api/store/${STORE_ID}/logo/retry-brand-director`;
  return new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
}

describe('POST /api/store/[id]/logo/retry-brand-director', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrandDirectorAnalyze.mockReset();
    mockSupabaseStorageFrom.mockReturnValue({
      download: vi.fn(() => Promise.resolve({ data: null, error: null })),
    });
  });

  it('rejects store not in logo state with 409', async () => {
    const textOnlyStore = { ...mockStore, identity_state: 'text_only' };
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain(textOnlyStore);
      return makeChain(null);
    });

    const { POST } = await import('../route');
    const response = await POST(createRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('estado logo');
  });

  it('rejects without active asset with 400', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain(mockStore);
      if (table === 'store_brand_assets') return makeChain(null);
      return makeChain(null);
    });

    const { POST } = await import('../route');
    const response = await POST(createRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('asset');
  });

  it('rejects without failed profile with 400', async () => {
    const syncedProfile = { ...mockFailedProfile, status: 'synced' };
    const storeChain = makeChain(mockStore);
    const assetChain = makeChain(mockActiveAsset);
    const profileChain = makeChain(syncedProfile);

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return storeChain;
      if (table === 'store_brand_assets') return assetChain;
      if (table === 'store_brand_profiles') {
        const chain = makeChain(null);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => profileChain);
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = vi.fn()
          .mockResolvedValueOnce(syncedProfile)
          .mockResolvedValueOnce(null);
        return chain;
      }
      return makeChain(null);
    });

    const { POST } = await import('../route');
    const response = await POST(createRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('falha');
  });

  it('returns 200 with success:true on successful retry with fallback', async () => {
    mockBrandDirectorAnalyze.mockResolvedValue({
      logo_colors_detected: ['#1a365d'],
      brand_colors_chosen: [],
      safe_color_tokens: { primary: '#1a365d', accent: '#e53e3e' },
      visual_style: 'modern',
      visual_tone: 'professional',
      typography_direction: 'sans-serif',
      brand_personality: 'confident',
      campaign_guidelines: 'guidelines',
      campaign_brief: 'brief',
      confidence_score: 0.85,
      inferred_primary_color: '#1a365d',
      inferred_accent_color: '#e53e3e',
    });

    const storeChain = makeChain(mockStore);
    const assetChain = makeChain(mockActiveAsset);
    const profileFirstCall = makeChain(mockFailedProfile);
    const fallbackChain = makeChain(mockSyncedProfile);

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return storeChain;
      if (table === 'store_brand_assets') return assetChain;
      if (table === 'store_brand_profiles') {
        const chain = makeChain(null);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => profileFirstCall);
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = vi.fn()
          .mockResolvedValueOnce(mockFailedProfile)
          .mockResolvedValueOnce(mockSyncedProfile);
        chain.insert = vi.fn(() => {
          const insertChain = makeChain(mockNewProfile);
          insertChain.select = vi.fn(() => insertChain);
          insertChain.single = vi.fn(() => Promise.resolve({ data: mockNewProfile, error: null }));
          return insertChain;
        });
        return chain;
      }
      return makeChain(null);
    });

    const { POST } = await import('../route');
    const response = await POST(createRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.profile.status).toBe('synced');
  });

  it('returns 200 with success:true on successful retry without fallback', async () => {
    mockBrandDirectorAnalyze.mockResolvedValue({
      logo_colors_detected: ['#2d3748'],
      brand_colors_chosen: [],
      safe_color_tokens: { primary: '#2d3748', accent: '#e53e3e' },
      visual_style: 'modern',
      visual_tone: 'professional',
      typography_direction: 'sans-serif',
      brand_personality: 'confident',
      campaign_guidelines: 'guidelines',
      campaign_brief: 'brief',
      confidence_score: 0.85,
      inferred_primary_color: '#2d3748',
      inferred_accent_color: '#e53e3e',
    });

    const storeChain = makeChain(mockStore);
    const assetChain = makeChain(mockActiveAsset);
    const profileChain = makeChain(mockFailedProfile);

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return storeChain;
      if (table === 'store_brand_assets') return assetChain;
      if (table === 'store_brand_profiles') {
        const chain = makeChain(null);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => profileChain);
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = vi.fn()
          .mockResolvedValueOnce(mockFailedProfile)
          .mockResolvedValueOnce(null);
        chain.insert = vi.fn(() => {
          const insertChain = makeChain({ ...mockNewProfile, brand_colors_chosen: [] });
          insertChain.select = vi.fn(() => insertChain);
          insertChain.single = vi.fn(() => Promise.resolve({ data: { ...mockNewProfile, brand_colors_chosen: [] }, error: null }));
          return insertChain;
        });
        return chain;
      }
      return makeChain(null);
    });

    const { POST } = await import('../route');
    const response = await POST(createRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.profile.brand_colors_chosen).toEqual([]);
  });

  it('returns success:false without mutations on BrandDirector failure', async () => {
    mockBrandDirectorAnalyze.mockRejectedValue(new Error('AI analysis failed'));

    const storeChain = makeChain(mockStore);
    const assetChain = makeChain(mockActiveAsset);
    const profileChain = makeChain(mockFailedProfile);

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return storeChain;
      if (table === 'store_brand_assets') return assetChain;
      if (table === 'store_brand_profiles') {
        const chain = makeChain(null);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => profileChain);
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = vi.fn()
          .mockResolvedValueOnce(mockFailedProfile)
          .mockResolvedValueOnce(null);
        return chain;
      }
      return makeChain(null);
    });

    const { POST } = await import('../route');
    const response = await POST(createRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.retry).toBe(true);
  });

  it('restores fallback on insert failure', async () => {
    mockBrandDirectorAnalyze.mockResolvedValue({
      logo_colors_detected: ['#1a365d'],
      brand_colors_chosen: [],
      safe_color_tokens: { primary: '#1a365d', accent: '#e53e3e' },
      visual_style: 'modern',
      visual_tone: 'professional',
      typography_direction: 'sans-serif',
      brand_personality: 'confident',
      campaign_guidelines: 'guidelines',
      campaign_brief: 'brief',
      confidence_score: 0.85,
      inferred_primary_color: '#1a365d',
      inferred_accent_color: '#e53e3e',
    });

    const storeChain = makeChain(mockStore);
    const assetChain = makeChain(mockActiveAsset);
    const profileChain = makeChain(mockFailedProfile);
    const fallbackChain = makeChain(mockSyncedProfile);
    const updateCalls: any[] = [];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return storeChain;
      if (table === 'store_brand_assets') return assetChain;
      if (table === 'store_brand_profiles') {
        const chain = makeChain(null);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = vi.fn()
          .mockResolvedValueOnce({ data: mockFailedProfile, error: null })
          .mockResolvedValueOnce({ data: mockSyncedProfile, error: null });
        chain.insert = vi.fn(() => {
          const insertChain = makeChain(null);
          insertChain.select = vi.fn(() => insertChain);
          insertChain.single = vi.fn(() => Promise.resolve({ data: null, error: new Error('insert failed') }));
          return insertChain;
        });
        chain.update = vi.fn((data: any) => {
          updateCalls.push(data);
          return chain;
        });
        return chain;
      }
      return makeChain(null);
    });

    const { POST } = await import('../route');
    const response = await POST(createRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Não foi possível salvar');

    const restoreUpdate = updateCalls.find(c => c.status === 'synced');
    expect(restoreUpdate).toBeDefined();
  });
});
