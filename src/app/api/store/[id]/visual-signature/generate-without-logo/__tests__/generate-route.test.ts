import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockIdentityDirectorGenerate = vi.fn();
const mockAiGeneratorGenerate = vi.fn();
const mockPersistSignature = vi.fn();
const mockInsertGenerationEvent = vi.fn();
const mockGetLaunchConfig = vi.fn();
const mockGetBalance = vi.fn();
const mockReserveCredit = vi.fn();
const mockRefundCredit = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/legal/clearance', () => ({ requireLegalClearance: vi.fn().mockResolvedValue({ ok: true }) }));

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

vi.mock('@/lib/visual-signature/identity-art-director', () => ({
  StoreIdentityArtDirectorService: class {
    generate = mockIdentityDirectorGenerate;
  },
}));

vi.mock('@/lib/visual-signature/ai-image-generator', () => ({
  AiImageGenerator: class {
    generate = mockAiGeneratorGenerate;
  },
}));

vi.mock('@/lib/visual-signature/persistence', () => ({
  persistSignature: mockPersistSignature,
}));

vi.mock('@/lib/visual-signature/generation-events', () => ({
  insertGenerationEvent: mockInsertGenerationEvent,
}));

// F38.1 (6.4): mock da camada única de registro de custo (D7). O AiCostTracker
// mockado captura os eventos gravados em `capturedEvents` e o startRun devolve
// operationRunId/traceId SEQUENCIAIS — permitindo afirmar que a nova tentativa
// abre um NOVO run (operationRunId distinto — D1, teste 10).
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

vi.mock('@/lib/launch-config/config', () => ({
  getLaunchConfig: mockGetLaunchConfig,
}));

vi.mock('@/lib/credit/credit-service', () => ({
  CreditService: class {
    getBalance = mockGetBalance;
    reserveCredit = mockReserveCredit;
    refundCredit = mockRefundCredit;
  },
}));

const mockGetCost = vi.fn();
vi.mock('@/lib/credit/operation-cost-service', () => ({
  OperationCostService: vi.fn(function () {
    return { getCost: mockGetCost };
  }),
  OperationCostUnavailableError: class extends Error {},
  DEFAULT_OPERATION_COSTS: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => 'mocked prompt content'),
    existsSync: vi.fn(() => true),
  },
  readFileSync: vi.fn(() => 'mocked prompt content'),
  existsSync: vi.fn(() => true),
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-op-id'),
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'abcdef123456'),
      })),
    })),
  },
  randomUUID: vi.fn(() => 'test-op-id'),
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => 'abcdef123456'),
    })),
  })),
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
const SIG_ID = '660e8400-e29b-41d4-a716-446655440001';

// F38.1 (6.4): usage/custo dos eventos call-level (imagem = gpt-5.5, validação = gpt-4o-mini)
const IMAGE_USAGE = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
const VALIDATION_USAGE = { promptTokens: 200, completionTokens: 30, totalTokens: 230 };
const IMAGE_COST = 0.004;
const VALIDATION_COST = 0.001;

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
  visual_signature_attempts: 0,
  identity_state: 'text_only',
};

const mockSignatureResult = {
  signature: {
    id: SIG_ID,
    store_id: STORE_ID,
    asset_url: 'https://example.com/vs.png',
    status: 'draft',
    type: 'ai_generated',
    metadata: {
      artDirectorOutput: {
        visual_direction: 'Moderna',
        content_used: { store_name: true, city: false, state: false, slogan: false },
      },
    },
  },
  artDirectorOutput: {
    creative_description: 'Teste',
    suggested_colors: ['#22C55E'],
    visual_direction: 'Moderna',
    elements_used: ['nome da loja'],
  },
  metadataArtDirectorOutput: {
    visual_direction: 'Moderna',
    content_used: { store_name: true, city: false, state: false, slogan: false },
  },
  assetUrl: 'https://example.com/vs.png',
};

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature/generate-without-logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/store/[id]/visual-signature/generate-without-logo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: true,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });
    mockGetBalance.mockResolvedValue(5);
    mockReserveCredit.mockResolvedValue('ct-001');
    mockRefundCredit.mockResolvedValue('refund-tx');
    mockGetCost.mockResolvedValue({
      operationKey: 'visual_signature_generation',
      costCredits: 1,
      enabled: true,
      source: 'table',
    });
    mockIdentityDirectorGenerate.mockResolvedValue(mockSignatureResult);
    mockPersistSignature.mockResolvedValue(mockSignatureResult.signature);
    mockInsertGenerationEvent.mockResolvedValue(undefined);
    // F38.1 (6.4): reseta o buffer do tracker mockado e resolve custo por model
    capturedEvents.length = 0;
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o-mini' ? VALIDATION_COST : IMAGE_COST,
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

  it('invalid store ID returns 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store/invalid/visual-signature/generate-without-logo', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    const res = await POST(req, { params: Promise.resolve({ id: 'invalid' }) });
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

  it('saldo zero returns 402', async () => {
    mockGetBalance.mockResolvedValue(0);
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe('insufficient_credits');
  });

  it('successful generation returns expected shape', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('assetUrl');
    expect(body).toHaveProperty('signatureId');
    expect(body).toHaveProperty('artDirectorOutput');
  });

  it('generation calls StoreIdentityArtDirectorService', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(mockIdentityDirectorGenerate).toHaveBeenCalled();
  });

  it('credit_tx_id nao e definido quando creditsChargingEnabled=false', async () => {
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: false,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const storeSigUpdateCalls = mockSupabaseFrom.mock.results
      .filter((r: any, i: number) => mockSupabaseFrom.mock.calls[i]?.[0] === 'store_visual_signatures')
      .map((r: any) => r.value.update?.mock?.calls ?? [])
      .flat();
    const hasCreditTx = storeSigUpdateCalls.some((call: any) =>
      call[0]?.metadata?.credit_tx_id !== undefined
    );
    expect(hasCreditTx).toBe(false);
  });

  it('generation records generation event on success', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(mockInsertGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        has_generated_signature: true,
      })
    );
  });

  it('rejection context is passed to service', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: { ...mockStore, visual_signature_attempts: 1 }, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [{ id: 'sig1' }], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    await POST(makeRequest({ rejectionContext: { reason: 'not_good', attempt: 1 } }), { params: Promise.resolve({ id: STORE_ID }) });
    expect(mockIdentityDirectorGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        rejectionContext: expect.objectContaining({ reason: 'not_good' }),
      }),
      expect.any(AbortSignal),
      expect.any(Function) // F38.1 (D11): onCall propagado ao service (imagem + validação)
    );
  });
});

// ── F38.1 (6.4): VS cost accounting ─────────────────────────────────────────
describe('VS cost accounting (6.4)', () => {
  // beforeEach próprio do bloco (describes irmãos não herdam hooks): reseta o
  // buffer do tracker mockado e reconstrói o setup padrão de forma idempotente.
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: true,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });
    mockGetBalance.mockResolvedValue(5);
    mockReserveCredit.mockResolvedValue('ct-001');
    mockRefundCredit.mockResolvedValue('refund-tx');
    mockGetCost.mockResolvedValue({
      operationKey: 'visual_signature_generation',
      costCredits: 1,
      enabled: true,
      source: 'table',
    });
    mockPersistSignature.mockResolvedValue(mockSignatureResult.signature);
    mockInsertGenerationEvent.mockResolvedValue(undefined);
    capturedEvents.length = 0;
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o-mini' ? VALIDATION_COST : IMAGE_COST,
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

  // Setup padrão de sucesso: loja carregada, sem VS ativa, onCall do attempt 1
  // dispara imagem (gpt-5.5) + validação (gpt-4o-mini) antes de retornar.
  function setupStandardStore() {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
  }

  function setupSuccessWithCalls() {
    setupStandardStore();
    mockIdentityDirectorGenerate.mockImplementation(async (_input: any, _signal: any, onCall?: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-5.5', usage: IMAGE_USAGE, durationMs: 300 });
      onCall?.({ provider: 'openai', model: 'gpt-4o-mini', usage: VALIDATION_USAGE, durationMs: 150 });
      return mockSignatureResult;
    });
  }

  function findDeliveryCall(status: string): any {
    return mockInsertGenerationEvent.mock.calls.find(
      (call: any) => call[0]?.generation_type === 'visual_signature' && call[0]?.status === status
    );
  }

  it('Teste 8 (6.4): visual_signature_image + visual_signature_validation com custo/tokens reais no run', async () => {
    setupSuccessWithCalls();
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const imageEvent = capturedEvents.find((e: any) => e.generationType === 'visual_signature_image');
    expect(imageEvent).toBeDefined();
    expect(imageEvent.tokens).toEqual(IMAGE_USAGE);
    expect(imageEvent.cost?.estimatedCostUsd).toBeCloseTo(IMAGE_COST, 6);
    expect(imageEvent.cost?.costSource).toBe('pricing_table');
    expect(imageEvent.attemptNumber).toBe(0);
    expect(imageEvent.status).toBe('success');

    const validationEvent = capturedEvents.find((e: any) => e.generationType === 'visual_signature_validation');
    expect(validationEvent).toBeDefined();
    expect(validationEvent.tokens).toEqual(VALIDATION_USAGE);
    expect(validationEvent.cost?.estimatedCostUsd).toBeCloseTo(VALIDATION_COST, 6);
    expect(validationEvent.attemptNumber).toBe(0);
  });

  it('Teste 9 (6.4): delivery visual_signature com custo NULL + duration_is_pipeline (soma via view)', async () => {
    setupSuccessWithCalls();
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    // call-level com custo > 0 existem (a view soma os call-level do run)
    expect(capturedEvents.length).toBeGreaterThan(0);
    for (const e of capturedEvents) {
      expect(e.cost?.estimatedCostUsd).toBeCloseTo(e.generationType === 'visual_signature_validation' ? VALIDATION_COST : IMAGE_COST, 6);
    }

    // delivery marker: SEM custo e SEM tokens (anti-dupla-contagem D1/D6 — o
    // tracker adiciona duration_is_pipeline:true no delegate)
    const delivery = findDeliveryCall('success');
    expect(delivery).toBeDefined();
    expect(delivery[0].estimated_cost_usd).toBeUndefined();
    expect(delivery[0].provider_reported_cost_usd).toBeUndefined();
    expect(delivery[0].cached_input_tokens).toBeUndefined();
    expect(delivery[0].image_tokens).toBeUndefined();
    expect(delivery[0].operation_run_id).toBeDefined();
    expect(delivery[0].visual_signature_id).toBe(SIG_ID);
  });

  it('Teste 10 (6.4): nova tentativa pós-falha = NOVO run (operationRunId do retry DIFERENTE do attempt 1)', async () => {
    setupStandardStore();
    // ATTEMPT 1 falha após emitir evento de imagem (run 1)
    mockIdentityDirectorGenerate.mockImplementation(async (_input: any, _signal: any, onCall?: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-5.5', usage: IMAGE_USAGE, durationMs: 300 });
      throw new Error('identity_art_director_failed: boom');
    });
    // ATTEMPT 2 (retry) com sucesso — novo run
    mockAiGeneratorGenerate.mockImplementation(async ({ onCall }: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-5.5', usage: IMAGE_USAGE, durationMs: 300 });
      onCall?.({ provider: 'openai', model: 'gpt-4o-mini', usage: VALIDATION_USAGE, durationMs: 150 });
      return {
        tier: 'image_direct',
        assetUrl: 'https://example.com/retry.png',
        storagePath: 'test/retry.png',
        mimeType: 'image/png',
        metadata: { generation_tier: 'image_direct', provider: 'openai', model: 'gpt-5.5' },
        prompt: 'retry prompt',
      };
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const attempt1Events = capturedEvents.filter((e: any) => e.attemptNumber === 0);
    const retryEvents = capturedEvents.filter((e: any) => e.attemptNumber === 1);
    expect(attempt1Events.length).toBeGreaterThan(0);
    expect(retryEvents.length).toBeGreaterThan(0);

    const attempt1RunIds = new Set(attempt1Events.map((e: any) => e.operationRunId));
    const retryRunIds = new Set(retryEvents.map((e: any) => e.operationRunId));
    expect(attempt1RunIds.size).toBe(1);
    expect(retryRunIds.size).toBe(1);
    // nova tentativa = NOVO operationRunId (D1)
    expect([...retryRunIds][0]).not.toBe([...attempt1RunIds][0]);

    // o delivery do sucesso está sob o run do retry
    const delivery = findDeliveryCall('success');
    expect(delivery[0].operation_run_id).toBe([...retryRunIds][0]);
    // eventos do run 1 (falha) gravados sem assinatura
    for (const e of attempt1Events) {
      expect(e.visualSignatureId).toBeNull();
    }
  });

  it('Teste 11 (6.4): visual_signature_id preenchido em todos os eventos do run', async () => {
    setupSuccessWithCalls();
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(capturedEvents.length).toBeGreaterThan(0);
    for (const e of capturedEvents) {
      expect(e.visualSignatureId).toBe(SIG_ID);
      expect(e.operationRunId).toBeDefined();
      expect(e.operationRunType).toBe('visual_signature');
    }
    const delivery = findDeliveryCall('success');
    expect(delivery[0].visual_signature_id).toBe(SIG_ID);
  });

  it('Teste 12 (6.4): typographic fallback SEM evento call-level (sem chamada IA — D5)', async () => {
    setupStandardStore();
    mockIdentityDirectorGenerate.mockRejectedValue(new Error('identity_art_director_failed: boom'));
    // retry retorna tier typographic (SVG programático) — NENHUM onCall dispara
    mockAiGeneratorGenerate.mockResolvedValue({
      tier: 'typographic',
      assetUrl: 'https://example.com/fallback.svg',
      storagePath: 'test/fallback.svg',
      mimeType: 'image/svg+xml',
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(500);

    // nenhum evento call-level gravado (não inventar chamada — D5)
    const callLevel = capturedEvents.filter(
      (e: any) => e.generationType === 'visual_signature_image' || e.generationType === 'visual_signature_validation'
    );
    expect(callLevel).toHaveLength(0);

    // delivery failed registrado (sem custo)
    const failedDelivery = findDeliveryCall('failed');
    expect(failedDelivery).toBeDefined();
    expect(failedDelivery[0].estimated_cost_usd).toBeUndefined();
  });

  it('Teste 13 (6.4): insertGenerationEvent VS compat F37 — mesmos generation_type/status/fields', async () => {
    // attempt 1 sucesso SEM onCall (como os testes existentes — F37)
    setupStandardStore();
    mockIdentityDirectorGenerate.mockResolvedValue(mockSignatureResult);
    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(mockInsertGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: STORE_ID,
        generation_type: 'visual_signature', // mesmos generation_type/status/fields do fluxo existente
        provider: 'openai',
        attempt_number: 1,
        status: 'success',
        asset_generated: true,
        asset_id: SIG_ID,
        has_logo: false,
        has_generated_signature: true,
        has_brand_profile: false,
        // F38.1: campos novos do run context, SEM custo/tokens (delivery marker)
        operation_run_id: expect.any(String),
        trace_id: expect.any(String),
        operation_run_type: 'visual_signature',
        visual_signature_id: SIG_ID,
      })
    );
    expect(mockInsertGenerationEvent.mock.calls[0][0].estimated_cost_usd).toBeUndefined();
    // sem onCall → nenhum evento call-level no run
    expect(capturedEvents).toHaveLength(0);
  });
});

// ── F38.2.1 (D3): snapshot econômico propagado aos eventos do run VS ──────
describe('snapshot econômico (F38.2.1) — VS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: true,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });
    mockGetBalance.mockResolvedValue(5);
    mockReserveCredit.mockResolvedValue('ct-001');
    mockRefundCredit.mockResolvedValue('refund-tx');
    mockGetCost.mockResolvedValue({
      operationKey: 'visual_signature_generation',
      costCredits: 1,
      enabled: true,
      source: 'table',
    });
    mockPersistSignature.mockResolvedValue(mockSignatureResult.signature);
    mockInsertGenerationEvent.mockResolvedValue(undefined);
    capturedEvents.length = 0;
    mockResolveAiCost.mockImplementation(({ model }: any) =>
      Promise.resolve({
        estimatedCostUsd: model === 'gpt-4o-mini' ? VALIDATION_COST : IMAGE_COST,
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

  it('Teste 3: eventos call-level (flushCallEvents) carregam os valores do snapshot do run', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    mockIdentityDirectorGenerate.mockImplementation(async (_input: any, _signal: any, onCall?: any) => {
      onCall?.({ provider: 'openai', model: 'gpt-5.5', usage: IMAGE_USAGE, durationMs: 300 });
      return mockSignatureResult;
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const imageEvent = capturedEvents.find((e: any) => e.generationType === 'visual_signature_image');
    expect(imageEvent).toBeDefined();
    expect(imageEvent.usdBrlRateAtGeneration).toBe(5.2);
    expect(imageEvent.creditValueBrlAtGeneration).toBe(2.0);
    // o evento NÃO carrega origem — o tracker define captured_at_generation
    expect(imageEvent.usdBrlRateSourceAtGeneration).toBeUndefined();
    expect(imageEvent.creditValueBrlSourceAtGeneration).toBeUndefined();
  });

  it('Teste 4: insertGenerationEvent (delivery) carrega os valores quando resolvidos', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    mockIdentityDirectorGenerate.mockResolvedValue(mockSignatureResult);

    const { POST } = await import('../route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(mockInsertGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        usd_brl_rate_at_generation: 5.2,
        credit_value_brl_at_generation: 2.0,
      })
    );
  });

  it('Teste 5: falha na leitura → snapshots null e geração não bloqueada (200)', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    mockIdentityDirectorGenerate.mockResolvedValue(mockSignatureResult);
    mockGetParameter.mockRejectedValue(new Error('economic down'));

    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);

    const delivery = mockInsertGenerationEvent.mock.calls.find(
      (call: any) => call[0]?.generation_type === 'visual_signature' && call[0]?.status === 'success'
    );
    expect(delivery).toBeDefined();
    expect(delivery![0].usd_brl_rate_at_generation).toBeNull();
    expect(delivery![0].credit_value_brl_at_generation).toBeNull();
  });
});
