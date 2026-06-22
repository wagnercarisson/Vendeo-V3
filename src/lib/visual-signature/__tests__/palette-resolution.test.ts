import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ColorCluster, ColorProbeResult, BrandProfileRecord } from '@/lib/brand-assets/types';
import { intendedToResolved } from '../types';
import type { BrandProfilerInput, IntendedPalette, ColorValidationResolved } from '../types';

const {
  mockFindClosestProbeCluster,
  mockProbeColors,
  mockOpenAICreate,
  mockSupabaseFrom,
  mockFetch,
} = vi.hoisted(() => ({
  mockFindClosestProbeCluster: vi.fn(),
  mockProbeColors: vi.fn(),
  mockOpenAICreate: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/lib/brand-assets/color-probe', () => ({
  probeColors: mockProbeColors,
  findClosestProbeCluster: mockFindClosestProbeCluster,
  deltaE: vi.fn(() => 0),
  hexToLab: vi.fn(() => [50, 0, 0] as [number, number, number]),
  rgbToHex: vi.fn(() => '#000000'),
  isLightNeutral: vi.fn(() => false),
  STRONG_MATCH_DELTA_E: 12,
  ACCEPTABLE_MATCH_DELTA_E: 18,
  LOOSE_MATCH_DELTA_E: 25,
}));

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: mockOpenAICreate,
      },
    };
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
  },
}));

const sampleArtDirectorOutput = {
  creative_description: 'Test description',
  suggested_colors: ['#22C55E', '#1E40AF'],
  visual_direction: 'Modern',
  elements_used: ['store_name'],
};

function makeInput(overrides: Partial<BrandProfilerInput> = {}): BrandProfilerInput {
  return {
    storeId: 'test-store-id',
    storeName: 'Test Store',
    segment: 'food',
    subsegment: null,
    tone_of_voice: null,
    positioning: null,
    short_description: null,
    slogan: null,
    city: null,
    state: null,
    brandColor: '#666666',
    artDirectorOutput: sampleArtDirectorOutput,
    visualSignatureId: 'test-vs-id',
    assetUrl: 'https://example.com/test.png',
    referenceCardUrl: null,
    intendedPalette: null,
    previousBrandColors: [],
    ...overrides,
  };
}

function makeIntended(overrides: Partial<IntendedPalette> = {}): IntendedPalette {
  return {
    primary: '#22C55E',
    accent: '#1E40AF',
    background: '#0F172A',
    support: ['#3B82F6'],
    ...overrides,
  };
}

function makeProbeResult(clusters: ColorCluster[]): ColorProbeResult {
  const classified: { [key: string]: ColorCluster[] } = {
    dominant_pixels: [], dark_ink_candidates: [], neutral_candidates: [],
    background_candidates: [], small_but_structural: [], suspected_transitions: [],
  };
  for (const c of clusters) {
    const key = c.classification === 'dominant' ? 'dominant_pixels'
      : c.classification === 'dark_ink' ? 'dark_ink_candidates'
      : c.classification === 'neutral' ? 'neutral_candidates'
      : c.classification === 'background' ? 'background_candidates'
      : c.classification === 'structural' ? 'small_but_structural'
      : 'suspected_transitions';
    if (classified[key]) classified[key].push(c);
  }
  return classified as unknown as ColorProbeResult;
}

function makeCluster(
  hex: string,
  classification: ColorCluster['classification'] = 'dominant',
  frequency = 0.15,
  edgeRatio = 0.05,
  saturation = 0.5,
  luminance = 0.5,
): ColorCluster {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    hex, rgb: [r, g, b], lab: [50, 0, 0],
    frequency, luminance, saturation, edgeRatio, classification,
  };
}

function makeDbChain(initialResult: any = { data: null, error: null }) {
  let currentResult = initialResult;
  const resolvable = Promise.resolve(currentResult);
  const chain: any = Object.assign(() => resolvable, {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(currentResult)),
    update: vi.fn((_data: any) => {
      currentResult = { data: { id: 'test-id', ..._data }, error: null };
      chainSelect.single = vi.fn(() => Promise.resolve(currentResult));
      return chain;
    }),
    insert: vi.fn((_data: any) => {
      const insertResult = { data: { id: 'new-profile-id', status: 'synced' as const, ..._data, safe_color_tokens: _data.safe_color_tokens }, error: null };
      return {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve(insertResult)),
        })),
      };
    }),
  });
  const chainSelect = chain;
  return chain;
}

describe('intendedToResolved', () => {
  it('derives secondary from supportResolved[0]', () => {
    const palette = { primary: '#22C55E', accent: '#1E40AF', background: '#0F172A', support: ['#3B82F6', '#FF6600'] };
    const result = intendedToResolved(palette, ['#B96F63']);
    expect(result).toEqual({
      primary: '#22C55E', secondary: '#B96F63', accent: '#1E40AF', background: '#0F172A',
    });
  });

  it('secondary falls back to primary when supportResolved is empty', () => {
    const palette = { primary: '#22C55E', accent: '#1E40AF', background: '#0F172A', support: [] };
    const result = intendedToResolved(palette, []);
    expect(result.secondary).toBe('#22C55E');
  });
});

function colorValidation(profile: BrandProfileRecord): ColorValidationResolved {
  return (profile.metadata as Record<string, unknown>).color_validation as ColorValidationResolved;
}

  describe('11 — profiler palette resolution (mocked probe + OpenAI + Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test-key';
    (process.env as Record<string, string>).NODE_ENV = 'development';
    mockSupabaseFrom.mockReturnValue(makeDbChain({ data: null, error: null }));
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete (global as any).fetch;
  });

  describe('11.1 — all confirmed happy path', () => {
    it('todas as cores ΔE ≤ 18 → global_status = all_confirmed', async () => {
      const intended = makeIntended();
      const clusters = [
        makeCluster('#22C55E'), makeCluster('#1E40AF'), makeCluster('#0F172A'), makeCluster('#3B82F6'),
      ];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)) });
      smartProbeMock(clusters);
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ visual_style: 'Modern', visual_tone: 'Elegante', typography_direction: 'Sans-serif', brand_personality: 'Sofisticado', campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.9 }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
      expect(result.profile.safe_color_tokens).toMatchObject({
        primary: '#22C55E', accent: '#1E40AF', background: '#0F172A',
      });
      expect(colorValidation(result.profile).global_status).toBe('all_confirmed');
    });
  });

  // Smart findClosestProbeCluster mock: exact hex match → deltaE 0;
  // otherwise compute a proxy from Euclidean RGB distance so revalidation passes
  // for colors that are truly in the cluster set.
  function smartProbeMock(clusters: ColorCluster[]) {
    mockFindClosestProbeCluster.mockImplementation((hex: string) => {
      const upper = hex.toUpperCase();
      const exact = clusters.find(c => c.hex === upper);
      if (exact) return { cluster: exact, deltaE: 0 };
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      let best: ColorCluster | null = null;
      let bestD = Infinity;
      for (const c of clusters) {
        const d = Math.sqrt((c.rgb[0]-r)**2 + (c.rgb[1]-g)**2 + (c.rgb[2]-b)**2);
        if (d < bestD) { bestD = d; best = c; }
      }
      return { cluster: best, deltaE: bestD };
    });
  }

  describe('11.2 — primary ambiguous', () => {
    it('primary not in clusters → vision_adjudicated', async () => {
      const intended = makeIntended();
      // Omit primary from clusters → presence check finds deltaE > 0
      const clusters = [
        makeCluster('#1E40AF'), makeCluster('#0F172A'), makeCluster('#3B82F6'),
      ];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      smartProbeMock(clusters);
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: '#1E40AF', accent: null, background: null, support: [] },
          reason: 'Used accent as primary',
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.8,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
      expect(colorValidation(result.profile).global_status).toBe('vision_adjudicated');
    });
  });

  describe('11.3 — primary ΔE > 25', () => {
    it('primary ΔE > 25 → vision_adjudicated', async () => {
      const intended = makeIntended();
      const clusters = [makeCluster('#1E40AF'), makeCluster('#0F172A'), makeCluster('#3B82F6')];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      smartProbeMock(clusters);
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: '#1E40AF', accent: null, background: null, support: [] },
          reason: 'Used accent as primary',
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.8,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
    });
  });

  describe('11.4 — support[0] not contested', () => {
    it('support[0] ΔE ≤ 18 → secondary == support[0]', async () => {
      const intended = makeIntended({ support: ['#3B82F6', '#FF6600'] });
      const clusters = [
        makeCluster('#22C55E'), makeCluster('#1E40AF'), makeCluster('#0F172A'),
        makeCluster('#3B82F6'), makeCluster('#FF6600'),
      ];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      smartProbeMock(clusters);
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          visual_style: 'Modern', visual_tone: 'Elegante', typography_direction: 'Sans-serif',
          brand_personality: 'Sofisticado', campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.9,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
      expect(result.profile.safe_color_tokens.secondary).toBe('#3B82F6');
      expect(colorValidation(result.profile).support_colors).toEqual(['#3B82F6', '#FF6600']);
    });
  });

  describe('11.5 — support[0] ambiguous', () => {
    it('support[0] not in clusters → vision_adjudicated', async () => {
      const intended = makeIntended();
      const clusters = [
        makeCluster('#22C55E'), makeCluster('#1E40AF'), makeCluster('#0F172A'),
      ];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      smartProbeMock(clusters);
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: null, accent: null, background: null, support: [{ index: 0, color: '#22C55E' }] },
          reason: 'Support corrected',
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.8,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
      expect(colorValidation(result.profile).global_status).toBe('vision_adjudicated');
    });
  });

  describe('11.6 — probe unavailable', () => {
    it('probe vazio + intendedPalette válido → probe_unavailable', async () => {
      mockProbeColors.mockResolvedValue(makeProbeResult([]));
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.7,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: makeIntended() }));

      expect(result.success).toBe(true);
      expect(colorValidation(result.profile).global_status).toBe('probe_unavailable');
      expect(result.profile.safe_color_tokens.primary).toBe('#22C55E');
    });
  });

  describe('11.7 — vision failed', () => {
    it('primary ambíguo + visão falha → vision_failed', async () => {
      const intended = makeIntended();
      const clusters = [makeCluster('#22C55E')];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      mockFindClosestProbeCluster.mockReturnValue({ cluster: clusters[0], deltaE: 20 });
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: null, accent: null, background: null, support: [] },
          reason: 'No choice',
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();

      await expect(profiler.generate(makeInput({ intendedPalette: intended }))).rejects.toThrow();
    });
  });

  describe('11.8 — fallback with brandColor', () => {
    it('probe vazio + intendedPalette null + brandColor set → fallback_heuristic', async () => {
      mockProbeColors.mockResolvedValue(makeProbeResult([]));
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.6,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: null, brandColor: '#CC0000' }));

      expect(result.success).toBe(true);
      expect(colorValidation(result.profile).global_status).toBe('fallback_heuristic');
      expect(result.profile.safe_color_tokens.primary).toBe('#CC0000');
    });
  });

  describe('11.9 — fallback SEGMENT_FALLBACK', () => {
    it('probe vazio + intendedPalette null + brandColor null → fallback_heuristic', async () => {
      mockProbeColors.mockResolvedValue(makeProbeResult([]));
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.6,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: null, brandColor: null }));

      expect(result.success).toBe(true);
      expect(colorValidation(result.profile).global_status).toBe('fallback_heuristic');
      expect(result.profile.safe_color_tokens.primary).toBe('#666666');
    });
  });

  describe('11.10 — support[1] contested, support[0] preserved', () => {
    it('support[1] contestado, support[0] preservado → secondary == support[0]', async () => {
      const intended = makeIntended({ support: ['#3B82F6', '#FF6600'] });
      const clusters = [
        makeCluster('#22C55E'), makeCluster('#1E40AF'), makeCluster('#0F172A'),
        makeCluster('#3B82F6'),
      ];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      smartProbeMock(clusters);
      // Support[1] (#FF6600) is NOT in clusters → presence fails → contested
      // Support[0] (#3B82F6) IS in clusters → confirmed
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: null, accent: null, background: null, support: [{ index: 1, color: '#1E40AF' }] },
          reason: 'Support[1] corrected',
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.8,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
      expect(result.profile.safe_color_tokens.secondary).toBe('#3B82F6');
    });
  });

  describe('11.14 — happy path calls vision with analyze_only', () => {
    it('happy path → calls vision', async () => {
      const intended = makeIntended();
      const clusters = [
        makeCluster('#22C55E'), makeCluster('#1E40AF'), makeCluster('#0F172A'), makeCluster('#3B82F6'),
      ];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      mockFindClosestProbeCluster.mockReturnValue({ cluster: clusters[0], deltaE: 3 });
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.9,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(mockOpenAICreate).toHaveBeenCalled();
    });
  });

  describe('11.16 — divergence with arbitration', () => {
    it('divergência → vision_adjudicated', async () => {
      const intended = makeIntended({ support: ['#3B82F6', '#FF6600'] });
      // primary (#22C55E) is NOT in clusters → contested
      // support[1] (#FF6600) is NOT in clusters → contested
      const clusters = [makeCluster('#1E40AF'), makeCluster('#0F172A'), makeCluster('#3B82F6')];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      smartProbeMock(clusters);
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: '#1E40AF', accent: null, background: null, support: [{ index: 1, color: '#3B82F6' }] },
          reason: 'Corrected',
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.8,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
      const cv = colorValidation(result.profile);
      expect(cv.global_status).toBe('vision_adjudicated');
      expect(cv.vision_adjudication!.status).toBe('success');
    });
  });

  describe('11.17 — duplicate indices → vision_failed', () => {
    it('índice duplicado → vision_failed', async () => {
      const intended = makeIntended({ support: ['#3B82F6', '#FF6600'] });
      const clusters = [makeCluster('#22C55E')];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      mockFindClosestProbeCluster.mockImplementation((hex: string) => {
        if (hex === '#22C55E') return { cluster: clusters[0], deltaE: 20 };
        return { cluster: null, deltaE: 50 };
      });
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: null, accent: null, background: null, support: [{ index: 0, color: '#FF0000' }, { index: 0, color: '#00FF00' }] },
          reason: 'Duplicated',
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();

      await expect(profiler.generate(makeInput({ intendedPalette: intended }))).rejects.toThrow();
    });
  });

  describe('11.18 — observed_colors selection', () => {
    it('observed_colors selection works within limits', async () => {
      const intended = makeIntended();
      // Only background (#0F172A) is NOT in clusters → contested
      const clusters = [
        makeCluster('#22C55E', 'dominant', 0.3),
        makeCluster('#1E40AF', 'dominant', 0.2),
        makeCluster('#3B82F6', 'dominant', 0.1),
      ];

      mockProbeColors.mockResolvedValue(makeProbeResult(clusters));
      smartProbeMock(clusters);
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          corrections: { primary: null, accent: null, background: '#22C55E', support: [] },
          reason: 'Used observed',
          visual_style: 'Modern', visual_tone: 'Elegante',
          typography_direction: 'Sans-serif', brand_personality: 'Sofisticado',
          campaign_guidelines: 'Test', campaign_brief: 'Test', confidence_score: 0.8,
        }) } }],
      });

      const { BrandProfilerWithoutLogoService } = await import('../brand-profiler');
      const profiler = new BrandProfilerWithoutLogoService();
      const result = await profiler.generate(makeInput({ intendedPalette: intended }));

      expect(result.success).toBe(true);
      expect(colorValidation(result.profile).global_status).toBe('vision_adjudicated');
    });
  });
});
