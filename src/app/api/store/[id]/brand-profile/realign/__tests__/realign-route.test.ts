import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockBrandDirectorAnalyze = vi.fn();
const mockTextOnlyInfer = vi.fn();
const mockStorageDownload = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    storage: {
      from: vi.fn(() => ({
        download: mockStorageDownload,
      })),
    },
  },
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

vi.mock('@/lib/brand-assets/brand-director', () => ({
  BrandDirectorService: class {
    analyze = mockBrandDirectorAnalyze;
  },
  BrandDirectorAnalysisError: class extends Error {
    deterministicResult: any;
    metadata: any;
    constructor(msg: string) {
      super(msg);
      this.name = 'BrandDirectorAnalysisError';
      this.deterministicResult = null;
      this.metadata = {};
    }
  },
}));

vi.mock('@/lib/brand-assets/text-only-inference-service', () => ({
  BrandTextOnlyInferenceService: class {
    infer = mockTextOnlyInfer;
  },
}));

const mockProfilerGenerate = vi.fn();

vi.mock('@/lib/visual-signature/brand-profiler', () => ({
  BrandProfilerWithoutLogoService: class {
    generate = mockProfilerGenerate;
  },
  BrandProfilerWithoutLogoError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'BrandProfilerWithoutLogoError';
    }
  },
}));

vi.mock('@/lib/constants', () => ({
  IDENTITY_TO_LOGO_STATUS: {
    logo: 'synced',
    text_only: 'explicit_none',
    visual_signature: 'generated',
  },
}));

vi.mock('@/lib/snapshot', () => ({
  buildStoreProfileInputSnapshot: vi.fn(() => ({
    segment: 'alimentacao',
    subsegment: null,
    tone_of_voice: 'moderno',
    name: 'Minha Loja',
    positioning: null,
    short_description: null,
    slogan: null,
  })),
}));

// F38.1 (6.5): mock do AiCostTracker — captura eventos e startRun sequencial
// (permite afirmar que regenerate abre NOVO run — operationRunId distinto).
const { capturedEvents, mockResolveAiCost, MockAiCostTracker } = vi.hoisted(() => {
  const capturedEvents: any[] = [];
  let runCounter = 0;
  class MockAiCostTracker {
    startRun(_type: string) {
      runCounter += 1;
      return { operationRunId: `run-${runCounter}`, traceId: `trace-${runCounter}` };
    }
    async record(event: any) {
      capturedEvents.push(event);
    }
  }
  return { capturedEvents, mockResolveAiCost: vi.fn(), MockAiCostTracker };
});

vi.mock('@/lib/ai-cost', () => ({
  AiCostTracker: MockAiCostTracker,
  resolveAiCost: mockResolveAiCost,
}));

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';
const ASSET_ID = '660e8400-e29b-41d4-a716-446655440001';
const PROFILE_ID = 'profile-001';

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
  identity_state: 'text_only',
};

const mockLogoStore = {
  ...mockStore,
  identity_state: 'logo',
};

const mockVSStore = {
  ...mockStore,
  identity_state: 'visual_signature',
};

const mockActiveVS = {
  id: 'vs-001',
  store_id: STORE_ID,
  asset_url: 'https://example.com/vs.png',
  status: 'active',
  metadata: {
    artDirectorOutput: {
      creative_description: 'Visual criativo',
      suggested_colors: ['#22C55E', '#1E40AF'],
      visual_direction: 'Moderna',
      elements_used: ['nome da loja'],
      content_used: { store_name: true, city: false, state: false, slogan: true },
      intended_palette: {
        primary: '#22C55E',
        accent: '#1E40AF',
        background: '#0F172A',
        support: [],
      },
    },
  },
};

const mockLogoAsset = {
  id: ASSET_ID,
  store_id: STORE_ID,
  variant_type: 'original',
  status: 'active',
  storage_path: 'logos/test.png',
  mime_type: 'image/png',
};

const mockProfile = {
  id: PROFILE_ID,
  store_id: STORE_ID,
  status: 'synced',
  source: 'text_only',
  brand_colors_chosen: ['#22C55E', '#1E40AF'],
  safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
  visual_style: 'Moderno',
  visual_tone: 'Elegante',
  brand_personality: 'Sofisticado',
  inferred_primary_color: '#22C55E',
  inferred_accent_color: '#1E40AF',
  metadata: {},
};

const mockDirectorResult = {
  logo_colors_detected: ['#22C55E', '#1E40AF'],
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
};

/**
 * Creates a basic Supabase query chain that terminates by calling .single() or .maybeSingle()
 * and resolves to the provided result.
 */
function makeChain(result: any) {
  const resolvable = Promise.resolve(result);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
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

/**
 * Creates a Supabase query chain for store_brand_profiles that supports
 * .insert().select().single() resolving to a proper profile result.
 */
function makeProfileChain(listResult: any) {
  const profileResult = { data: mockProfile, error: null };
  const listResolvable = Promise.resolve(listResult);

  // Insert chain supports .select().single()
  const insertChain: any = {
    then: undefined,
    select: vi.fn(() => {
      const sc: any = {
        then: undefined,
        single: vi.fn(() => Promise.resolve(profileResult)),
      };
      sc.then = Promise.resolve(profileResult).then.bind(Promise.resolve(profileResult));
      return sc;
    }),
    eq: vi.fn(() => insertChain),
    in: vi.fn(() => insertChain),
    order: vi.fn(() => insertChain),
    limit: vi.fn(() => insertChain),
    single: vi.fn(() => Promise.resolve(profileResult)),
    update: vi.fn(() => insertChain),
    insert: vi.fn(() => insertChain),
  };
  insertChain.then = Promise.resolve(profileResult).then.bind(Promise.resolve(profileResult));

  // Outer chain supports .maybeSingle() for profile queries
  const chain: any = Object.assign(() => listResolvable, {
    then: listResolvable.then.bind(listResolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(listResult)),
    maybeSingle: vi.fn(() => Promise.resolve(listResult)),
    update: vi.fn(() => chain),
    insert: vi.fn(() => insertChain),
  });
  return chain;
}

function makeRequest(storeId: string = STORE_ID) {
  return new NextRequest(new Request(`http://localhost/api/store/${storeId}/brand-profile/realign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }));
}

describe('POST /api/store/[id]/brand-profile/realign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrandDirectorAnalyze.mockResolvedValue(mockDirectorResult);
    mockProfilerGenerate.mockClear();
    mockTextOnlyInfer.mockResolvedValue({
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
    });
    // Default storage download returns a Blob file
    mockStorageDownload.mockResolvedValue({
      data: new Blob([]),
      error: null,
    });
  });

  it('invalid store ID returns 400', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest('invalid-id'), { params: Promise.resolve({ id: 'invalid-id' }) });
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

  it('text_only path — returns 200 with profile', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: null, error: null });
      if (table === 'store_brand_profiles') return makeProfileChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.profile.source).toBe('text_only');
  });

  it('text_only path with existing profile — marks outdated before insert', async () => {
    let wasMarkedOutdated = false;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        const chain = makeChain({ data: mockStore, error: null });
        chain.update = vi.fn(() => makeChain({ data: null, error: null }));
        return chain;
      }
      if (table === 'store_brand_assets') return makeChain({ data: null, error: null });
      if (table === 'store_brand_profiles') {
        const chain = makeChain({ data: [mockProfile], error: null });
        chain.update = vi.fn(() => {
          wasMarkedOutdated = true;
          return makeChain({ data: null, error: null });
        });
        chain.insert = vi.fn(() => {
          const ic = makeChain({ data: mockProfile, error: null });
          ic.select = vi.fn(() => {
            const sc = makeChain({ data: mockProfile, error: null });
            sc.single = vi.fn(() => Promise.resolve({ data: mockProfile, error: null }));
            return sc;
          });
          return ic;
        });
        return chain;
      }
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    expect(wasMarkedOutdated).toBe(true);
  });

  it('logo path — returns 200 with profile source=logo_analysis', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockLogoStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: mockLogoAsset, error: null });
      if (table === 'store_brand_profiles') return makeProfileChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.profile.source).toBe('logo_analysis');
  });

  it('logo path with storage download — calls BrandDirectorService', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockLogoStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: mockLogoAsset, error: null });
      if (table === 'store_brand_profiles') return makeProfileChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    expect(mockBrandDirectorAnalyze).toHaveBeenCalled();
  });

  it('VS path — returns 200 with profile', async () => {
    const mockProfilerResult = {
      success: true,
      profile: {
        id: 'vs-profile-001',
        status: 'synced',
        source: 'without_logo',
        safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
        inferred_primary_color: '#22C55E',
        inferred_accent_color: '#1E40AF',
        visual_style: 'Moderno',
        visual_tone: 'Elegante',
        brand_personality: 'Sofisticado',
        brand_colors_chosen: ['#22C55E', '#1E40AF'],
        metadata: {},
      },
    };
    mockProfilerGenerate.mockResolvedValue(mockProfilerResult);

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.profile.source).toBe('without_logo');
  });

  it('VS path — calls profiler with mode:regenerate', async () => {
    const mockProfilerResult = {
      success: true,
      profile: {
        id: 'vs-profile-001',
        status: 'synced',
        source: 'without_logo',
        safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
        inferred_primary_color: '#22C55E',
        inferred_accent_color: '#1E40AF',
        visual_style: 'Moderno',
        visual_tone: 'Elegante',
        brand_personality: 'Sofisticado',
        brand_colors_chosen: ['#22C55E', '#1E40AF'],
        metadata: {},
      },
    };
    mockProfilerGenerate.mockResolvedValue(mockProfilerResult);

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    expect(mockProfilerGenerate).toHaveBeenCalled();
    // Verify mode:regenerate was passed
    const callArg = mockProfilerGenerate.mock.calls[0][0];
    expect(callArg.mode).toBe('regenerate');
    expect(callArg.visualSignatureId).toBe('vs-001');
    expect(callArg.contentUsed).toEqual({ store_name: true, city: false, state: false, slogan: true });
  });

  it('VS path — no active VS returns 400', async () => {
    mockProfilerGenerate.mockResolvedValue({ success: true, profile: {} });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: null, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Nenhuma assinatura visual ativa encontrada para realinhamento.');
  });

  it('VS path — profiler failure returns error, previous profile not outdated', async () => {
    mockProfilerGenerate.mockRejectedValue(new Error('Inference failed'));

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200); // Returns 200 with success: false
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Inference failed');
  });

  it('logo path inserts profile with selected fields in response', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockLogoStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: mockLogoAsset, error: null });
      if (table === 'store_brand_profiles') return makeProfileChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    expect(body.profile).toHaveProperty('safe_color_tokens');
    expect(body.profile).toHaveProperty('inferred_primary_color');
    expect(body.profile).toHaveProperty('inferred_accent_color');
    expect(body.profile).toHaveProperty('visual_style');
    expect(body.profile).toHaveProperty('visual_tone');
    expect(body.profile).toHaveProperty('brand_personality');
  });
});

// ── F38.1 (6.5): realign cost accounting — 3 caminhos de IA ─────────────────
describe('Brand cost accounting (6.5) — realign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockBrandDirectorAnalyze.mockResolvedValue(mockDirectorResult);
    mockProfilerGenerate.mockClear();
    mockTextOnlyInfer.mockResolvedValue({
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
    });
    mockStorageDownload.mockResolvedValue({
      data: new Blob([]),
      error: null,
    });
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o-mini' ? 0.001 : 0.004,
        costSource: 'pricing_table',
        pricingVersion: 'code_default',
      })
    );
  });

  const VISION_USAGE = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
  const TEXT_USAGE = { promptTokens: 120, completionTokens: 40, totalTokens: 160 };

  it('Teste 9a: realign text_only (112-114) -> call brand_profile_text com custo real + delivery sem custo', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: null, error: null });
      if (table === 'store_brand_profiles') return makeProfileChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    mockTextOnlyInfer.mockImplementation(async (_input: any, _timeoutMs: any, onCall?: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-4o', usage: TEXT_USAGE, durationMs: 200 });
      return {
        safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
        visual_style: 'Moderno', visual_tone: 'Elegante', typography_direction: 'Sans-serif',
        brand_personality: 'Sofisticado', campaign_guidelines: 'Guidelines', campaign_brief: 'Brief',
        inferred_primary_color: '#22C55E', inferred_accent_color: '#1E40AF', confidence_score: 0.9,
      };
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const textEvent = capturedEvents.find((e: any) => e.generationType === 'brand_profile_text');
    expect(textEvent).toBeDefined();
    expect(textEvent.tokens).toEqual(TEXT_USAGE);
    expect(textEvent.cost?.estimatedCostUsd).toBeCloseTo(0.004, 6);

    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
    expect(delivery.cost).toBeUndefined();
    expect(delivery.tokens).toBeUndefined();
    expect(delivery.metadata?.duration_is_pipeline).toBe(true);
  });

  it('Teste 9b: realign logo/analysis (290-291) -> call brand_profile_vision com custo real + delivery brand_profile_with_logo', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockLogoStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: mockLogoAsset, error: null });
      if (table === 'store_brand_profiles') return makeProfileChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    mockBrandDirectorAnalyze.mockImplementation(async ({ onCall }: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-4o', usage: VISION_USAGE, durationMs: 300 });
      return mockDirectorResult;
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const visionEvent = capturedEvents.find((e: any) => e.generationType === 'brand_profile_vision');
    expect(visionEvent).toBeDefined();
    expect(visionEvent.tokens).toEqual(VISION_USAGE);
    expect(visionEvent.cost?.estimatedCostUsd).toBeCloseTo(0.004, 6);

    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_with_logo');
    expect(delivery).toBeDefined();
    expect(delivery.cost).toBeUndefined();
    expect(delivery.tokens).toBeUndefined();
    expect(delivery.metadata?.duration_is_pipeline).toBe(true);
  });

  it('Teste 15: regenerate -> NOVO operationRunId (distinto do run anterior)', async () => {
    const mockProfilerResult = {
      success: true,
      profile: {
        id: 'vs-profile-001',
        status: 'synced',
        source: 'without_logo',
        safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
        inferred_primary_color: '#22C55E',
        inferred_accent_color: '#1E40AF',
        visual_style: 'Moderno', visual_tone: 'Elegante',
        brand_personality: 'Sofisticado',
        brand_colors_chosen: ['#22C55E', '#1E40AF'],
        metadata: {},
      },
    };
    mockProfilerGenerate.mockImplementation(async ({ onCall }: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-4o', usage: VISION_USAGE, durationMs: 300 });
      return mockProfilerResult;
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');

    // Dois requests de regenerate SEQUENCIAIS: cada um deve abrir um run NOVO
    // (operationRunId distinto do run anterior — D1, 6.5 test 4)
    const res1 = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res1.status).toBe(200);
    const firstRunEvents = capturedEvents.filter(
      (e: any) => e.generationType === 'brand_profile_vision' || e.generationType === 'brand_profile_text'
    );
    expect(firstRunEvents.length).toBeGreaterThan(0);
    const firstRunIds = new Set(firstRunEvents.map((e: any) => e.operationRunId));
    expect(firstRunIds.size).toBe(1);
    const firstRunId = [...firstRunIds][0];

    capturedEvents.length = 0;
    const res2 = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res2.status).toBe(200);
    const secondRunEvents = capturedEvents.filter(
      (e: any) => e.generationType === 'brand_profile_vision' || e.generationType === 'brand_profile_text'
    );
    expect(secondRunEvents.length).toBeGreaterThan(0);
    const secondRunIds = new Set(secondRunEvents.map((e: any) => e.operationRunId));
    expect(secondRunIds.size).toBe(1);
    const secondRunId = [...secondRunIds][0];

    // regenerate = NOVO run — id distinto do run anterior
    expect(secondRunId).not.toBe(firstRunId);

    // delivery do segundo run compartilha o mesmo run novo
    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
    expect(delivery.operationRunId).toBe(secondRunId);
    expect(delivery.cost).toBeUndefined();
    expect(delivery.metadata?.duration_is_pipeline).toBe(true);
  });
});
