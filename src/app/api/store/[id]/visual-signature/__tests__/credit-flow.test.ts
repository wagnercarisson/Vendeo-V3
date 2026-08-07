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
const mockRevalidateCriticalDrift = vi.fn();
const mockGetActiveVisualSignature = vi.fn();

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
  getActiveVisualSignature: (...args: any[]) => mockGetActiveVisualSignature(...args),
}));

vi.mock('@/lib/visual-signature/generation-events', () => ({
  insertGenerationEvent: mockInsertGenerationEvent,
}));

vi.mock('@/lib/visual-signature/drift-revalidator', () => ({
  revalidateCriticalDrift: mockRevalidateCriticalDrift,
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
const CREDIT_TX_ID = 'ct-001';

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

function setupDefaultMocks() {
  mockGetLaunchConfig.mockReturnValue({
    v15Enabled: true,
    creditsChargingEnabled: true,
    copyDirectorEnabled: true,
    rateLimitEnabled: true,
    generationPaused: false,
  });
  mockGetBalance.mockResolvedValue(5);
  mockReserveCredit.mockResolvedValue(CREDIT_TX_ID);
  mockRefundCredit.mockResolvedValue('refund-tx-id');
  mockGetCost.mockResolvedValue({
    operationKey: 'visual_signature_generation',
    costCredits: 1,
    enabled: true,
    source: 'table',
  });
  mockIdentityDirectorGenerate.mockResolvedValue(mockSignatureResult);
  mockPersistSignature.mockResolvedValue(mockSignatureResult.signature);
  mockInsertGenerationEvent.mockResolvedValue(undefined);
  mockGetActiveVisualSignature.mockResolvedValue(null);
}

describe('POST generate-without-logo — Credit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
  });

  // Task 3.1 — Credit flow tests

  it('saldo suficiente: reserva crédito, gera VS, retorna success', async () => {
    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    expect(mockGetBalance).toHaveBeenCalledWith(STORE_ID);
    expect(mockReserveCredit).toHaveBeenCalledWith(STORE_ID, 1, {
      campaignId: null,
      idempotencyKey: `vs_reserve_${STORE_ID}_test-op-id`,
      metadata: {
        feature: "visual_signature",
        mode: "standard",
        operationId: "test-op-id",
        operation_key: "visual_signature_generation",
        operation_cost_credits: 1,
        operation_cost_source: "table",
      },
    });
    expect(mockIdentityDirectorGenerate).toHaveBeenCalled();

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assetUrl).toBeDefined();
    expect(body.signatureId).toBeDefined();
    // credit_tx_id + cost snapshot should be persisted in metadata
    const storeSigUpdateCalls = mockSupabaseFrom.mock.results
      .filter((r: any, i: number) => mockSupabaseFrom.mock.calls[i]?.[0] === 'store_visual_signatures')
      .map((r: any) => r.value.update?.mock?.calls ?? [])
      .flat();
    const hasCreditTx = storeSigUpdateCalls.some((call: any) =>
      call[0]?.metadata?.credit_tx_id === CREDIT_TX_ID
    );
    expect(hasCreditTx).toBe(true);
    const hasCostSnapshot = storeSigUpdateCalls.some((call: any) =>
      call[0]?.metadata?.operation_key === 'visual_signature_generation' &&
      call[0]?.metadata?.operation_cost_credits === 1 &&
      call[0]?.metadata?.operation_cost_source === 'table'
    );
    expect(hasCostSnapshot).toBe(true);
  });

  it('saldo zero: retorna 402 insufficient_credits', async () => {
    mockGetBalance.mockResolvedValue(0);

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe('insufficient_credits');
    expect(body.error).toBe('Créditos insuficientes');
    expect(mockReserveCredit).not.toHaveBeenCalled();
    expect(mockIdentityDirectorGenerate).not.toHaveBeenCalled();
  });

  it('falha de IA com estorno: reserveCredit chamado, IA falha → refundCredit', async () => {
    mockIdentityDirectorGenerate.mockRejectedValue(new Error('AI provider timeout'));

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(500);
    expect(mockReserveCredit).toHaveBeenCalled();
    expect(mockRefundCredit).toHaveBeenCalledWith(
      CREDIT_TX_ID,
      "generation_error",
      {
        metadata: {
          feature: "visual_signature",
          mode: "standard",
          operationId: "test-op-id",
        },
      },
    );
  });

  it('falha de storage com estorno: reserveCredit chamado, storage fail → refund + 503', async () => {
    mockIdentityDirectorGenerate.mockRejectedValue(new Error('Failed to upload to Storage: network error'));

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(503);
    expect(mockReserveCredit).toHaveBeenCalled();
    expect(mockRefundCredit).toHaveBeenCalledWith(
      CREDIT_TX_ID,
      "storage_error",
      {
        metadata: {
          feature: "visual_signature",
          mode: "standard",
          operationId: "test-op-id",
        },
      },
    );
  });

  it('creditsChargingEnabled=false: sem balance check, sem reserve, VS gerada sem crédito', async () => {
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: false,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    expect(mockGetBalance).not.toHaveBeenCalled();
    expect(mockReserveCredit).not.toHaveBeenCalled();
    expect(mockRefundCredit).not.toHaveBeenCalled();
  });

  it('generationPaused=true: retorna 503 antes de qualquer operação', async () => {
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: true,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: true,
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(503);
    expect(mockGetBalance).not.toHaveBeenCalled();
    expect(mockReserveCredit).not.toHaveBeenCalled();
    expect(mockIdentityDirectorGenerate).not.toHaveBeenCalled();
  });

  it('v15Enabled=false: geração sem consumo de crédito', async () => {
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: false,
      creditsChargingEnabled: false,
      copyDirectorEnabled: false,
      rateLimitEnabled: false,
      generationPaused: false,
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(200);
    expect(mockGetBalance).not.toHaveBeenCalled();
    expect(mockReserveCredit).not.toHaveBeenCalled();
    expect(mockIdentityDirectorGenerate).toHaveBeenCalled();
  });

  it('idempotência: mesma operationId com same idempotencyKey funciona (não quebra)', async () => {
    mockReserveCredit.mockResolvedValue(CREDIT_TX_ID);

    const { POST } = await import('../generate-without-logo/route');
    const res1 = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const res2 = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockReserveCredit).toHaveBeenCalledTimes(2);
  });

  it('operation_disabled com cobrança desligada → 503 (D4/F38-CONFIG-01)', async () => {
    mockGetLaunchConfig.mockReturnValue({
      v15Enabled: true,
      creditsChargingEnabled: false,
      copyDirectorEnabled: true,
      rateLimitEnabled: true,
      generationPaused: false,
    });
    mockGetCost.mockResolvedValue({
      operationKey: 'visual_signature_generation',
      costCredits: 1,
      enabled: false,
      source: 'table',
    });

    const { POST } = await import('../generate-without-logo/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('operation_disabled');
    expect(mockReserveCredit).not.toHaveBeenCalled();
    expect(mockIdentityDirectorGenerate).not.toHaveBeenCalled();
  });
});
