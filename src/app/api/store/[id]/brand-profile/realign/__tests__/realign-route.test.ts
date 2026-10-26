import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockBrandDirectorAnalyze = vi.fn();
const mockTextOnlyInfer = vi.fn();
const mockStorageDownload = vi.fn();
const mockCreateSignedUrl = vi.fn(() => Promise.resolve({ data: { signedUrl: 'signed-vs-url' }, error: null }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    storage: {
      from: vi.fn(() => ({
        download: mockStorageDownload,
        createSignedUrl: mockCreateSignedUrl,
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
    constructor(msg: string, metadata: any = {}) {
      super(msg);
      this.name = 'BrandDirectorAnalysisError';
      this.deterministicResult = null;
      this.metadata = metadata;
    }
  },
}));

vi.mock('@/lib/brand-assets/text-only-inference-service', () => ({
  BrandTextOnlyInferenceService: class {
    infer = mockTextOnlyInfer;
  },
}));

const mockProfilerGenerate = vi.fn();
const mockLoadDirectionState = vi.fn(async (): Promise<Record<string, unknown>> => ({
  pending: true,
  active_signature_id: 'vs-001',
  synced_profile_id: null,
  reference: null,
  failure_at: null,
}));
const mockMarkOutdated = vi.fn(async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true }));
const mockRecordFailure = vi.fn(async (): Promise<{ status: string; error?: string }> => ({ status: 'ok' }));
const mockClearFailure = vi.fn(async (): Promise<{ status: string; error?: string }> => ({ status: 'ok' }));
const mockIsActiveVS = vi.fn(async () => true);
const mockSanitizeDiagnostic = vi.fn((s: string) => s);

vi.mock('@/lib/visual-signature/brand-profiler', () => ({
  BrandProfilerWithoutLogoService: class {
    generate = mockProfilerGenerate;
  },
  BrandProfilerWithoutLogoError: class extends Error {
    metadata: { provider: string; model: string; elapsedMs: number; errorType: string };
    constructor(msg: string, metadata: any = {}) {
      super(msg);
      this.name = 'BrandProfilerWithoutLogoError';
      this.metadata = metadata;
    }
  },
}));

vi.mock('@/lib/visual-signature/direction-pending', () => ({
  loadVisualDirectionState: mockLoadDirectionState,
  markSyncedProfilesOutdatedExceptActive: mockMarkOutdated,
  recordVisualDirectionFailure: mockRecordFailure,
  clearVisualDirectionFailure: mockClearFailure,
  isVisualSignatureActive: mockIsActiveVS,
  sanitizeDirectionDiagnostic: mockSanitizeDiagnostic,
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

// F46-04 (D9): a rota usa `createDefaultTelemetryContext` de `@/lib/ai`; o sink
// captura o envelope e o converte no AiCostEvent (mesmo CostResolution).
vi.mock('@/lib/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai')>();
  return {
    ...actual,
    createDefaultTelemetryContext: (params: any) => {
      const { sink: _sink, tracker: _tracker, onCostResolved, ...ctx } = params;
      return {
        ...ctx,
        sink: {
          emit: async (envelope: any) => {
            const generationType =
              actual.CAPABILITY_GENERATION_TYPE[
                envelope.capability as keyof typeof actual.CAPABILITY_GENERATION_TYPE
              ];
            const cost = await mockResolveAiCost({
              provider: envelope.provider,
              model: envelope.model,
              usage: envelope.usage,
              providerReportedCostUsd: envelope.providerReportedCostUsd,
              imageGenerationTool: envelope.usageMeta?.imageGenerationTool === true,
              generationType,
            });
            onCostResolved?.(cost);
            capturedEvents.push({
              operationRunId: ctx.operationRunId,
              operationRunType: ctx.operationRunType,
              traceId: ctx.traceId,
              storeId: ctx.storeId,
              visualSignatureId: ctx.visualSignatureId ?? null,
              generationType,
              provider: envelope.provider,
              model: envelope.model,
              attemptNumber: ctx.attemptNumber ?? 1,
              durationMs: envelope.durationMs,
              status: envelope.status,
              errorType: envelope.errorType ?? null,
              tokens: envelope.usage,
              cost,
              usdBrlRateAtGeneration: ctx.usdBrlRateAtGeneration ?? null,
              creditValueBrlAtGeneration: ctx.creditValueBrlAtGeneration ?? null,
              metadata: { capability: envelope.capability, protocol: envelope.protocol },
            });
          },
        },
      };
    },
  };
});

// F38.2.1 (D3): mock do EconomicParameterService — snapshot 5.20/2.00 por
// default; cenário de falha via mockRejectedValue (best-effort, não bloqueia).
const { mockGetParameter } = vi.hoisted(() => ({ mockGetParameter: vi.fn() }));
vi.mock('@/lib/economic/economic-parameter-service', () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: mockGetParameter };
  }),
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
  storage_path: `${STORE_ID}/vs.png`,
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
    mockLoadDirectionState.mockReset().mockResolvedValue({
      pending: true,
      active_signature_id: 'vs-001',
      synced_profile_id: null,
      reference: null,
      failure_at: null,
    });
    mockMarkOutdated.mockReset().mockResolvedValue({ ok: true });
    mockRecordFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockClearFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockIsActiveVS.mockReset().mockResolvedValue(true);
    mockSanitizeDiagnostic.mockImplementation((s: string) => s);
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
    expect(body.error).toBe('brand_profile_vision_failed');
    expect(body.error).not.toContain('Inference failed');
  });

  it('VS path — pendência: falha grava referência nova e marca synced antigos outdated', async () => {
    mockProfilerGenerate.mockRejectedValue(new Error('raw provider message'));
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
    expect(body.success).toBe(false);
    expect(body.brand_profile_status).toBe('failed');
    expect(typeof body.failure_reference).toBe('string');
    expect(body.failure_reference).toMatch(/^run-\d+$/);
    expect(mockMarkOutdated).toHaveBeenCalledWith(STORE_ID, { signatureId: 'vs-001' });
    expect(mockRecordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: STORE_ID,
        signatureId: 'vs-001',
        reference: body.failure_reference,
        failureCode: 'unexpected_error',
      }),
    );
    expect(body.error).not.toContain('raw provider');
  });

  it('VS path — sem pendência: falha preserva perfil e mensagem "direção anterior mantida"', async () => {
    mockLoadDirectionState.mockResolvedValue({
      pending: false,
      active_signature_id: 'vs-001',
      synced_profile_id: 'p1',
      reference: null,
      failure_at: null,
    });
    mockProfilerGenerate.mockRejectedValue(new Error('vision down'));
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: { ...mockProfile, visual_signature_id: 'vs-001' }, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain('A direção visual anterior foi mantida.');
    expect(body.error).toBe('brand_profile_vision_failed');
    expect(mockMarkOutdated).not.toHaveBeenCalled();
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it('VS path — superseded → 409 sem cleanup/metadata', async () => {
    const mod = await import('@/lib/visual-signature/brand-profiler');
    mockProfilerGenerate.mockRejectedValue(
      new mod.BrandProfilerWithoutLogoError('superseded', {
        provider: 'openai',
        model: 'gpt-4o',
        elapsedMs: 0,
        errorType: 'visual_signature_superseded',
      }),
    );
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('visual_signature_superseded');
    expect(mockMarkOutdated).not.toHaveBeenCalled();
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it('VS path — leitura de estado falhando → 500 direction_state_unavailable', async () => {
    mockLoadDirectionState.mockRejectedValue(new Error('db down'));
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('direction_state_unavailable');
    expect(mockProfilerGenerate).not.toHaveBeenCalled();
  });

  it('VS path — sucesso limpa metadata e reporta synced', async () => {
    mockProfilerGenerate.mockResolvedValue({
      success: true,
      profile: {
        id: 'vs-profile-001', status: 'synced', source: 'without_logo',
        safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
        inferred_primary_color: '#22C55E', inferred_accent_color: '#1E40AF',
        visual_style: 'Moderno', visual_tone: 'Elegante', brand_personality: 'Sofisticado',
        brand_colors_chosen: ['#22C55E', '#1E40AF'], metadata: {},
      },
    });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    expect(body.brand_profile_status).toBe('synced');
    expect(body.failure_reference).toBeNull();
    expect(mockClearFailure).toHaveBeenCalledWith({ storeId: STORE_ID, signatureId: 'vs-001' });
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

  it('logo path falha de análise → 200 success:false, error sanitizado (errorType), message pública (F-quick)', async () => {
    const mod = await import('@/lib/brand-assets/brand-director');
    mockBrandDirectorAnalyze.mockRejectedValue(
      new mod.BrandDirectorAnalysisError('Unexpected end of JSON input', {
        provider: 'openai',
        model: 'gpt-4o',
        elapsedMs: 5,
        errorType: 'invalid_json',
      }),
    );
    const updateCalls: any[] = [];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockLogoStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: mockLogoAsset, error: null });
      if (table === 'store_brand_profiles') {
        const chain = makeChain({ data: null, error: null });
        chain.update = vi.fn((d: any) => {
          updateCalls.push(d);
          return chain;
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
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Não foi possível interpretar a análise do logotipo. Tente novamente. A direção visual anterior foi mantida.');
    expect(body.error).toBe('invalid_json');
    expect(body.error).not.toContain('JSON input');
    // perfil anterior preservado: nenhum update de status (não marca outdated)
    expect(updateCalls).toEqual([]);
  });
});

// ── F38.1 (6.5): realign cost accounting — 3 caminhos de IA ─────────────────
describe('Brand cost accounting (6.5) — realign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockLoadDirectionState.mockReset().mockResolvedValue({ pending: true, active_signature_id: 'vs-001', synced_profile_id: null, reference: null, failure_at: null });
    mockMarkOutdated.mockReset().mockResolvedValue({ ok: true });
    mockRecordFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockClearFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockIsActiveVS.mockReset().mockResolvedValue(true);
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
    // F38.2.1 (D3): default do snapshot econômico — usd 5.20 / credit 2.00
    mockGetParameter.mockImplementation(async (key: string) => {
      if (key === 'usd_brl_rate') return { key, value: 5.2, source: 'table' };
      return { key, value: 2.0, source: 'table' };
    });
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
    mockTextOnlyInfer.mockImplementation(async (_input: any, _timeoutMs: any, _onCall: any, telemetry?: any) => {
      await telemetry?.sink?.emit({ capability: 'brand_profile_text', protocol: 'chat-completions', status: 'success', provider: 'openai', model: 'gpt-4o', usage: TEXT_USAGE, durationMs: 200 });
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
    mockBrandDirectorAnalyze.mockImplementation(async ({ telemetry }: any) => {
      await telemetry?.sink?.emit({ capability: 'brand_profile_vision', protocol: 'chat-completions', status: 'success', provider: 'openai', model: 'gpt-4o', usage: VISION_USAGE, durationMs: 300 });
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
    mockProfilerGenerate.mockImplementation(async (_input: any, telemetry?: any) => {
      await telemetry?.sink?.emit({ capability: 'brand_profile_vision', protocol: 'chat-completions', status: 'success', provider: 'openai', model: 'gpt-4o', usage: VISION_USAGE, durationMs: 300 });
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
    mockLoadDirectionState.mockReset().mockResolvedValue({ pending: true, active_signature_id: 'vs-001', synced_profile_id: null, reference: null, failure_at: null });
    mockMarkOutdated.mockReset().mockResolvedValue({ ok: true });
    mockRecordFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockClearFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockIsActiveVS.mockReset().mockResolvedValue(true);
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

// ── F38.2.1 (D3): snapshot econômico propagado aos eventos do run ─────────
describe('snapshot econômico (F38.2.1) — realign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockLoadDirectionState.mockReset().mockResolvedValue({ pending: true, active_signature_id: 'vs-001', synced_profile_id: null, reference: null, failure_at: null });
    mockMarkOutdated.mockReset().mockResolvedValue({ ok: true });
    mockRecordFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockClearFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockIsActiveVS.mockReset().mockResolvedValue(true);
    mockBrandDirectorAnalyze.mockResolvedValue(mockDirectorResult);
    mockProfilerGenerate.mockClear();
    mockTextOnlyInfer.mockResolvedValue({
      safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
      visual_style: 'Moderno', visual_tone: 'Elegante', typography_direction: 'Sans-serif',
      brand_personality: 'Sofisticado', campaign_guidelines: 'Guidelines', campaign_brief: 'Brief',
      inferred_primary_color: '#22C55E', inferred_accent_color: '#1E40AF', confidence_score: 0.9,
    });
    mockStorageDownload.mockResolvedValue({ data: new Blob([]), error: null });
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o-mini' ? 0.001 : 0.004,
        costSource: 'pricing_table',
        pricingVersion: 'code_default',
      })
    );
    // F38.2.1 (D3): default do snapshot econômico — usd 5.20 / credit 2.00
    mockGetParameter.mockImplementation(async (key: string) => {
      if (key === 'usd_brl_rate') return { key, value: 5.2, source: 'table' };
      return { key, value: 2.0, source: 'table' };
    });
  });

  const TEXT_USAGE = { promptTokens: 120, completionTokens: 40, totalTokens: 160 };

  function setupTextOnlyStore() {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_brand_assets') return makeChain({ data: null, error: null });
      if (table === 'store_brand_profiles') return makeProfileChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
  }

  it('text_only path: call brand_profile_text e delivery carregam os valores do snapshot (5.20/2.00) — apenas valores', async () => {
    setupTextOnlyStore();
    mockTextOnlyInfer.mockImplementation(async (_input: any, _timeoutMs: any, _onCall: any, telemetry?: any) => {
      await telemetry?.sink?.emit({ capability: 'brand_profile_text', protocol: 'chat-completions', status: 'success', provider: 'openai', model: 'gpt-4o', usage: TEXT_USAGE, durationMs: 200 });
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

    expect(capturedEvents.length).toBeGreaterThan(0);
    for (const e of capturedEvents) {
      expect(e.usdBrlRateAtGeneration).toBe(5.2);
      expect(e.creditValueBrlAtGeneration).toBe(2.0);
      // o evento NÃO carrega origem — o tracker define captured_at_generation
      expect(e.usdBrlRateSourceAtGeneration).toBeUndefined();
      expect(e.creditValueBrlSourceAtGeneration).toBeUndefined();
    }
  });

  it('falha na leitura → snapshots null e resposta inalterada (200, sem 5xx novo)', async () => {
    setupTextOnlyStore();
    mockTextOnlyInfer.mockResolvedValue({
      safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
      visual_style: 'Moderno', visual_tone: 'Elegante', typography_direction: 'Sans-serif',
      brand_personality: 'Sofisticado', campaign_guidelines: 'Guidelines', campaign_brief: 'Brief',
      inferred_primary_color: '#22C55E', inferred_accent_color: '#1E40AF', confidence_score: 0.9,
    });
    mockGetParameter.mockRejectedValue(new Error('economic down'));
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
    expect(delivery.usdBrlRateAtGeneration).toBeNull();
    expect(delivery.creditValueBrlAtGeneration).toBeNull();
  });
});

describe('POST /api/store/[id]/brand-profile/realign — códigos de suporte (261025-v14)', () => {
  const DVRE01_MESSAGE =
    'Não foi possível concluir sua direção visual. A geração de campanhas ficará indisponível até a conclusão. Entre em contato com o suporte e informe o código DVRE01. Após a orientação do suporte, clique em Realinhar direção visual.';

  function setupVS() {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockActiveVS, error: null });
      if (table === 'store_brand_profiles') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadDirectionState.mockReset().mockResolvedValue({
      pending: true, active_signature_id: 'vs-001', synced_profile_id: null, reference: null, failure_at: null,
    });
    mockMarkOutdated.mockReset().mockResolvedValue({ ok: true });
    mockRecordFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockClearFailure.mockReset().mockResolvedValue({ status: 'ok' });
    mockIsActiveVS.mockReset().mockResolvedValue(true);
  });

  it('pendência: falha responde DVRE01, mensagem sem UUID e record com routine realign', async () => {
    setupVS();
    mockProfilerGenerate.mockRejectedValue(new Error('vision down'));
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();

    expect(body.support_code).toBe('DVRE01');
    expect(body.message).toBe(DVRE01_MESSAGE);
    expect(body.message).not.toContain(body.failure_reference);
    expect(body.message.match(/DVRE01/g)).toHaveLength(1);
    expect(body.failure_reference).toMatch(/^run-\d+$/);
    expect(mockRecordFailure).toHaveBeenCalledWith(expect.objectContaining({
      supportCode: 'DVRE01',
      routine: 'realign',
      failureCode: 'unexpected_error',
    }));
  });

  it('provider_error preservado no realinhamento pendente', async () => {
    setupVS();
    const { AiInvocationError } = await import('@/lib/ai/types');
    mockProfilerGenerate.mockRejectedValue(new AiInvocationError({
      kind: 'provider_error', retryable: true, message: 'upstream',
    }));
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(mockRecordFailure).toHaveBeenCalledWith(expect.objectContaining({
      failureCode: 'provider_error',
      supportCode: 'DVRE01',
      routine: 'realign',
    }));
  });

  it('local_asset_download_failed preservado no realinhamento pendente', async () => {
    setupVS();
    const mod = await import('@/lib/visual-signature/brand-profiler');
    mockProfilerGenerate.mockRejectedValue(new mod.BrandProfilerWithoutLogoError('download', {
      provider: 'openai', model: 'gpt-4o', elapsedMs: 0, errorType: 'local_asset_download_failed',
    }));
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(mockRecordFailure).toHaveBeenCalledWith(expect.objectContaining({
      failureCode: 'local_asset_download_failed',
      supportCode: 'DVRE01',
      routine: 'realign',
    }));
  });

  it('sucesso responde support_code null e limpa metadata', async () => {
    setupVS();
    mockProfilerGenerate.mockResolvedValue({
      success: true,
      profile: {
        id: 'vs-profile-001', status: 'synced', source: 'without_logo',
        safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
        inferred_primary_color: '#22C55E', inferred_accent_color: '#1E40AF',
        visual_style: 'Moderno', visual_tone: 'Elegante', brand_personality: 'Sofisticado',
        brand_colors_chosen: ['#22C55E', '#1E40AF'], metadata: {},
      },
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();

    expect(body.support_code).toBeNull();
    expect(body.failure_reference).toBeNull();
    expect(mockClearFailure).toHaveBeenCalledWith({ storeId: STORE_ID, signatureId: 'vs-001' });
  });
});
