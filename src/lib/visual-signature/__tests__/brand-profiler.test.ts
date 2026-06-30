import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabaseFrom = vi.fn();
const mockFetch = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/image-generation/prompt-loader', () => ({
  PromptLoader: class {
    load = vi.fn(() => 'mocked prompt');
  },
}));

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  },
}));

vi.mock('@/lib/brand-assets/color-probe', () => ({
  probeColors: vi.fn(),
  findClosestProbeCluster: vi.fn(),
  deltaE: vi.fn(() => 0),
  hexToLab: vi.fn(() => [50, 0, 0] as [number, number, number]),
  rgbToHex: vi.fn(() => '#000000'),
  isLightNeutral: vi.fn(() => false),
  STRONG_MATCH_DELTA_E: 12,
  ACCEPTABLE_MATCH_DELTA_E: 18,
  LOOSE_MATCH_DELTA_E: 25,
}));

// Mock fetch globally for downloadAssetBuffer
vi.stubGlobal('fetch', mockFetch);

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
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  });
  return chain;
}

const mockSyncedProfile = {
  id: 'profile-synced-001',
  store_id: 'store-001',
  visual_signature_id: 'vs-001',
  source: 'without_logo',
  status: 'synced',
  logo_colors_detected: ['#22C55E', '#1E40AF'],
  brand_colors_chosen: ['#22C55E', '#1E40AF'],
  safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
  visual_style: 'Moderno',
  visual_tone: 'Elegante',
  typography_direction: 'Sans-serif',
  brand_personality: 'Sofisticado',
  campaign_guidelines: 'Guidelines',
  campaign_brief: 'Brief',
  inferred_primary_color: '#22C55E',
  inferred_accent_color: '#1E40AF',
  confidence_score: 0.9,
  metadata: {},
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockOutdatedProfile = {
  ...mockSyncedProfile,
  id: 'profile-outdated-001',
  status: 'outdated',
};

const mockBrandProfilerInput = {
  storeId: 'store-001',
  storeName: 'Minha Loja',
  segment: 'alimentacao',
  subsegment: null,
  tone_of_voice: 'moderno',
  positioning: 'Posicionamento',
  short_description: 'Descrição',
  slogan: 'Slogan',
  city: 'São Paulo',
  state: 'SP',
  brandColor: '#CC0000',
  artDirectorOutput: {
    creative_description: 'Teste',
    suggested_colors: ['#22C55E', '#1E40AF'],
    visual_direction: 'Moderna',
    elements_used: ['nome da loja'],
  },
  visualSignatureId: 'vs-001',
  assetUrl: 'https://example.com/vs.png',
  referenceCardUrl: null,
  intendedPalette: null,
  previousBrandColors: [],
};

describe('BrandProfilerWithoutLogoService.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    // By default, no existing profile → continue to full generation
    // We'll override per-test for the reuse/outdated paths
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') {
        return makeChain({ data: [], error: null });
      }
      if (table === 'stores') {
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });
  });

  it('with existing synced profile — reuses without calling full generation', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') {
        return makeChain({ data: [mockSyncedProfile], error: null });
      }
      if (table === 'stores') {
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();
    const result = await service.generate(mockBrandProfilerInput);

    expect(result.success).toBe(true);
    expect(result.profile.id).toBe('profile-synced-001');
    // Should NOT attempt to download the asset or call probe
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('with existing outdated profile — updates to synced and reuses', async () => {
    let updateCalledWith: any = null;
    const makeChainWithUpdateTracking = (result: any) => {
      const resolvable = Promise.resolve(result);
      const chain: any = Object.assign(() => resolvable, {
        then: resolvable.then.bind(resolvable),
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        single: vi.fn(() => Promise.resolve(result)),
        update: vi.fn((data: any) => {
          updateCalledWith = data;
          return chain;
        }),
        insert: vi.fn(() => chain),
      });
      return chain;
    };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') {
        return makeChainWithUpdateTracking({ data: [mockOutdatedProfile], error: null });
      }
      if (table === 'stores') {
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();
    const result = await service.generate(mockBrandProfilerInput);

    expect(result.success).toBe(true);
    expect(result.profile.status).toBe('outdated'); // returns original profile record
    // Should update the outdated profile to synced
    expect(updateCalledWith).not.toBeNull();
    expect(updateCalledWith.status).toBe('synced');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('without existing profile — attempts download and continues to generation', async () => {
    // Mock env to have OPENAI_API_KEY so it doesn't throw
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') {
        return makeChain({ data: [], error: null });
      }
      if (table === 'stores') {
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });

    // Mock fetch to return empty buffer (causes probe to work with empty)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();

    // This should reach the generation path and attempt to download
    // Since no intendedPalette and no probe result, will go to fallback path
    // Since no OPENAI_API_KEY (wait, we set it)... it will try OpenAI calls
    // Let's just check it reaches somewhere without throwing
    try {
      await service.generate(mockBrandProfilerInput);
      // If it reaches here, download was called
      expect(mockFetch).toHaveBeenCalledWith(mockBrandProfilerInput.assetUrl);
    } catch {
      // Generation might fail due to mocked OpenAI, but the fetch should have been called
      expect(mockFetch).toHaveBeenCalledWith(mockBrandProfilerInput.assetUrl);
    } finally {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });
});
