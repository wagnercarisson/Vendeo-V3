import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockTextOnlyInfer = vi.fn();

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

vi.mock('@/lib/brand-assets/text-only-inference-service', () => ({
  BrandTextOnlyInferenceService: class {
    infer = mockTextOnlyInfer;
  },
}));

vi.mock('@/lib/snapshot', () => ({
  buildStoreProfileInputSnapshot: vi.fn(() => ({ segment: 'alimentacao' })),
}));

// F38.1 (6.5): mock do AiCostTracker — captura eventos e startRun sequencial.
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

function makeProfileInsertChain(profile: any) {
  const base = makeChain({ data: null, error: null });
  const chain: any = Object.assign(() => Promise.resolve({ data: profile, error: null }), {
    then: undefined,
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: profile, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  });
  chain.then = Promise.resolve({ data: profile, error: null }).then.bind(Promise.resolve({ data: profile, error: null }));
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

const TEXT_USAGE = { promptTokens: 120, completionTokens: 40, totalTokens: 160 };
const TEXT_COST = 0.002;

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

const mockInferResult = {
  safe_color_tokens: { primary: '#CC0000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' },
  visual_style: 'Moderno',
  visual_tone: 'Elegante',
  typography_direction: 'Sans-serif',
  brand_personality: 'Sofisticado',
  campaign_guidelines: 'Guidelines',
  campaign_brief: 'Brief',
  inferred_primary_color: '#CC0000',
  inferred_accent_color: '#CC0000',
  confidence_score: 0.8,
};

const mockProfile = {
  id: 'profile-001',
  store_id: STORE_ID,
  status: 'synced',
  source: 'text_only',
  safe_color_tokens: mockInferResult.safe_color_tokens,
  metadata: {},
};

function makeRequest() {
  return new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/brand-profile/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textOnlyOrigin: 'explicit' }),
  }));
}

function setupSuccessStore() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'stores') return makeChain({ data: mockStore, error: null });
    if (table === 'store_brand_profiles') return makeProfileInsertChain(mockProfile);
    return makeChain({ data: null, error: null });
  });
}

describe('POST /api/store/[id]/brand-profile/infer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockTextOnlyInfer.mockResolvedValue(mockInferResult);
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: TEXT_COST,
      costSource: 'pricing_table',
      pricingVersion: 'code_default',
    });
  });

  it('success — returns text_only profile', async () => {
    setupSuccessStore();
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.profile.source).toBe('text_only');
  });

  it('missing textOnlyOrigin returns 400', async () => {
    setupSuccessStore();
    const { POST } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/brand-profile/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    const res = await POST(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
  });
});

// ── F38.1 (6.5): infer cost accounting (antes: ZERO eventos) ────────────────
describe('infer cost accounting (6.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: TEXT_COST,
      costSource: 'pricing_table',
      pricingVersion: 'code_default',
    });
  });

  function setupInferWithCall() {
    setupSuccessStore();
    mockTextOnlyInfer.mockImplementation(async (_input: any, _timeoutMs: any, onCall?: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-4o', usage: TEXT_USAGE, durationMs: 200 });
      return mockInferResult;
    });
  }

  it('Teste 16: rota infer grava call brand_profile_text com custo real + delivery sem custo (antes: zero eventos)', async () => {
    setupInferWithCall();
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const textEvent = capturedEvents.find((e: any) => e.generationType === 'brand_profile_text');
    expect(textEvent).toBeDefined();
    expect(textEvent.tokens).toEqual(TEXT_USAGE);
    expect(textEvent.cost?.estimatedCostUsd).toBeCloseTo(TEXT_COST, 6);
    expect(textEvent.cost?.costSource).toBe('pricing_table');
    expect(textEvent.operationRunId).toBe('run-1');
    expect(textEvent.operationRunType).toBe('brand_profile');

    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
    expect(delivery.cost).toBeUndefined();
    expect(delivery.tokens).toBeUndefined();
    expect(delivery.metadata?.duration_is_pipeline).toBe(true);
  });

  it('infer sem onCall (caminho mock dev) — apenas delivery, sem call-level (sem chamada IA)', async () => {
    setupSuccessStore();
    mockTextOnlyInfer.mockResolvedValue(mockInferResult); // SEM onCall
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const callLevel = capturedEvents.filter((e: any) => e.generationType === 'brand_profile_text');
    expect(callLevel).toHaveLength(0);
    const delivery = capturedEvents.find((e: any) => e.generationType === 'brand_profile_without_logo');
    expect(delivery).toBeDefined();
  });
});
