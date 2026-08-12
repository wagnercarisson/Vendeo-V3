import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockProfilerGenerate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
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

vi.mock('@/lib/visual-signature/brand-profiler', () => ({
  BrandProfilerWithoutLogoService: class {
    generate = mockProfilerGenerate;
  },
}));

// F38.1 (6.5): mock da camada única de registro de custo (D7). O AiCostTracker
// mockado captura os eventos gravados em `capturedEvents` e o startRun devolve
// operationRunId/traceId SEQUENCIAIS.
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

// F38.2.1 (D3): mock do EconomicParameterService — snapshot 5.20/2.00 por
// default; cenário de falha via mockRejectedValue (best-effort, não bloqueia).
const { mockGetParameter } = vi.hoisted(() => ({ mockGetParameter: vi.fn() }));
vi.mock('@/lib/economic/economic-parameter-service', () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: mockGetParameter };
  }),
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
const VS_ID = '660e8400-e29b-41d4-a716-446655440001';

const VISION_USAGE = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
const TEXT_USAGE = { promptTokens: 200, completionTokens: 30, totalTokens: 230 };
const VISION_COST = 0.004;
const TEXT_COST = 0.001;

const mockStore = {
  id: STORE_ID,
  name: 'Minha Loja',
  segment: 'alimentacao',
  subsegment: null,
  tone_of_voice: 'moderno',
  positioning: null,
  short_description: null,
  slogan: null,
  city: 'São Paulo',
  state: 'SP',
  brand_color: '#CC0000',
};

const mockProfileResult = {
  success: true,
  profile: {
    id: 'profile-001',
    status: 'synced',
    source: 'without_logo',
  },
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/brand-profile/generate-without-logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function setupStandardStore() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'stores') return makeChain({ data: mockStore, error: null });
    return makeChain({ data: null, error: null });
  });
}

describe('POST /api/store/[id]/brand-profile/generate-without-logo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockProfilerGenerate.mockResolvedValue(mockProfileResult);
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o' ? VISION_COST : TEXT_COST,
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

  it('success — returns brand profile', async () => {
    setupStandardStore();
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      visualSignatureId: VS_ID,
      assetUrl: 'https://example.com/vs.png',
      artDirectorOutput: { creative_description: 'x', suggested_colors: [], visual_direction: 'y', elements_used: [] },
    }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.brandProfile.source).toBe('without_logo');
  });

  it('missing required fields returns 400', async () => {
    setupStandardStore();
    const { POST } = await import('../route');
    const res = await POST(makeRequest({}), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
  });
});

// ── F38.1 (6.5): brand cost accounting — generate-without-logo ─────────────
describe('Brand cost accounting (6.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o' ? VISION_COST : TEXT_COST,
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

  // path 2 simulado: profiler emite 2 onCalls (1a = visão, 2a = texto — ordem fixa documentada)
  function setupSuccessWithTwoCalls() {
    setupStandardStore();
    mockProfilerGenerate.mockImplementation(async ({ onCall }: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-4o', usage: VISION_USAGE, durationMs: 300 });
      onCall?.({ provider: 'openai', model: 'gpt-4o-mini', usage: TEXT_USAGE, durationMs: 150 });
      return mockProfileResult;
    });
  }

  it('Teste 12: brand_profile_vision com custo/tokens (1a chamada do buffer)', async () => {
    setupSuccessWithTwoCalls();
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      visualSignatureId: VS_ID,
      assetUrl: 'https://example.com/vs.png',
      artDirectorOutput: { creative_description: 'x', suggested_colors: [], visual_direction: 'y', elements_used: [] },
    }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const visionEvent = capturedEvents.find((e: any) => e.generationType === 'brand_profile_vision');
    expect(visionEvent).toBeDefined();
    expect(visionEvent.tokens).toEqual(VISION_USAGE);
    expect(visionEvent.cost?.estimatedCostUsd).toBeCloseTo(VISION_COST, 6);
    expect(visionEvent.cost?.costSource).toBe('pricing_table');
    expect(visionEvent.attemptNumber).toBe(0);
    expect(visionEvent.status).toBe('success');
    expect(visionEvent.operationRunId).toBeDefined();
    expect(visionEvent.operationRunType).toBe('brand_profile');
  });

  it('Teste 13: brand_profile_text com custo/tokens (2a chamada do buffer — path 2)', async () => {
    setupSuccessWithTwoCalls();
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      visualSignatureId: VS_ID,
      assetUrl: 'https://example.com/vs.png',
      artDirectorOutput: { creative_description: 'x', suggested_colors: [], visual_direction: 'y', elements_used: [] },
    }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const textEvent = capturedEvents.find((e: any) => e.generationType === 'brand_profile_text');
    expect(textEvent).toBeDefined();
    expect(textEvent.tokens).toEqual(TEXT_USAGE);
    expect(textEvent.cost?.estimatedCostUsd).toBeCloseTo(TEXT_COST, 6);
    expect(textEvent.attemptNumber).toBe(0);
    expect(textEvent.operationRunId).toBeDefined();
  });

  it('Teste 14: delivery brand_profile_without_logo com custo NULL + duration_is_pipeline', async () => {
    setupSuccessWithTwoCalls();
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      visualSignatureId: VS_ID,
      assetUrl: 'https://example.com/vs.png',
      artDirectorOutput: { creative_description: 'x', suggested_colors: [], visual_direction: 'y', elements_used: [] },
    }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
    // delivery marker: SEM custo e SEM tokens (anti-dupla-contagem D1/D6)
    expect(delivery.cost).toBeUndefined();
    expect(delivery.tokens).toBeUndefined();
    expect(delivery.metadata?.duration_is_pipeline).toBe(true);
    expect(delivery.operationRunId).toBeDefined();
    expect(delivery.visualSignatureId).toBe(VS_ID);

    // TODOS os eventos do request compartilham o mesmo operationRunId (D1)
    const allRunIds = new Set(capturedEvents.map((e: any) => e.operationRunId));
    expect(allRunIds.size).toBe(1);
  });

  it('sem onCall do profiler — nenhum call-level, apenas delivery (sem chamada IA = sem evento D5)', async () => {
    setupStandardStore();
    mockProfilerGenerate.mockResolvedValue(mockProfileResult); // SEM onCall
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      visualSignatureId: VS_ID,
      assetUrl: 'https://example.com/vs.png',
      artDirectorOutput: { creative_description: 'x', suggested_colors: [], visual_direction: 'y', elements_used: [] },
    }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const callLevel = capturedEvents.filter(
      (e: any) => e.generationType === 'brand_profile_vision' || e.generationType === 'brand_profile_text'
    );
    expect(callLevel).toHaveLength(0);
    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
  });
});

// ── F38.2.1 (D3): snapshot econômico propagado aos eventos do run ─────────
describe('snapshot econômico (F38.2.1) — brand-profile generate-without-logo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o' ? VISION_COST : TEXT_COST,
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

  const reqBody = {
    visualSignatureId: VS_ID,
    assetUrl: 'https://example.com/vs.png',
    artDirectorOutput: { creative_description: 'x', suggested_colors: [], visual_direction: 'y', elements_used: [] },
  };

  it('call-level e delivery carregam os valores do snapshot (5.20/2.00) — apenas valores, sem origem', async () => {
    setupStandardStore();
    mockProfilerGenerate.mockImplementation(async ({ onCall }: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-4o', usage: VISION_USAGE, durationMs: 300 });
      return mockProfileResult;
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(reqBody), { params: Promise.resolve({ id: STORE_ID }) });
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
    setupStandardStore();
    mockProfilerGenerate.mockResolvedValue(mockProfileResult);
    mockGetParameter.mockRejectedValue(new Error('economic down'));
    const { POST } = await import('../route');
    const res = await POST(makeRequest(reqBody), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
    expect(delivery.usdBrlRateAtGeneration).toBeNull();
    expect(delivery.creditValueBrlAtGeneration).toBeNull();
  });
});
