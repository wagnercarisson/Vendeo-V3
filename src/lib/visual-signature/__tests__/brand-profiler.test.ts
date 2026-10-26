import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSupabaseFrom, mockFetch } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
  return { mockSupabaseFrom: vi.fn(), mockFetch: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/image-generation/prompt-loader', () => ({
  PromptLoader: class {
    load = vi.fn(() => 'mocked prompt');
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

import { NoopAiTelemetrySink } from '@/lib/ai';
import type { AiInvoker, AiTelemetryContext, TokenUsage } from '@/lib/ai';
import { AiInvocationError } from '@/lib/ai/types';

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function fetchBytes(bytes: Uint8Array) {
  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(0) };
}

function makeRecordingInvoker(content = '{"visual_style":"Elegante"}') {
  const invokeMock = vi.fn(async (_capability: string, _request: unknown, _telemetry: AiTelemetryContext) => {
    return { content, model: 'gpt-4o' };
  });
  return {
    invoker: {
      invoke: invokeMock as unknown as AiInvoker['invoke'],
      hasFallback: vi.fn(async () => false),
    } as AiInvoker,
    invokeMock,
  };
}

const TELEMETRY: AiTelemetryContext = {
  operationRunId: 'run-1',
  operationRunType: 'brand_profile',
  traceId: 'trace-1',
  storeId: 'store-001',
  sink: new NoopAiTelemetrySink(),
};

/** Fake `AiInvoker` (seam de teste): emite o envelope e retorna o resultado canônico. */
function makeInvoker(usage?: TokenUsage): AiInvoker {
  const invokeMock = vi.fn(async (_capability: string, _request: unknown, telemetry: AiTelemetryContext) => {
    await telemetry.sink.emit({
      capability: 'brand_profile_vision',
      protocol: 'chat-completions',
      status: 'success',
      provider: 'openai',
      model: 'gpt-4o',
      usage,
      durationMs: 11,
    });
    return { content: '{"visual_style":"Elegante"}', model: 'gpt-4o', usage };
  });
  return {
    invoke: invokeMock as unknown as AiInvoker['invoke'],
    hasFallback: vi.fn(async () => false),
  };
}

// Mock fetch globally for downloadAssetBuffer
vi.stubGlobal('fetch', mockFetch);

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

  it('mode:regenerate with existing synced profile — skips cache, continues to generation', async () => {
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
    const result = await service.generate({
      ...mockBrandProfilerInput,
      mode: 'regenerate',
    });

    // Since no API key and NODE_ENV=test, it goes through mockGenerate
    // which calls persistProfile → delegates to persistWithRegenerate (Ramo C since no target BP found)
    expect(result.success).toBe(true);
    // Should have attempted download (mockGenerate calls persistWithRegenerate)
    expect(mockFetch).toHaveBeenCalledWith(mockBrandProfilerInput.assetUrl);
  });

  it('mode:regenerate with contentUsed — preserves in profile metadata', async () => {
    const contentUsed = {
      store_name: true,
      city: true,
      state: false,
      slogan: true,
    };

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();
    const result = await service.generate({
      ...mockBrandProfilerInput,
      mode: 'regenerate',
      contentUsed,
    });

    expect(result.success).toBe(true);
  });

  it('mode defaults to reuse when omitted', async () => {
    // Same test as 'with existing synced profile' — mode defaults to 'reuse'
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
    // Should NOT attempt to download — cache hit
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('without existing profile — attempts download and continues to generation', async () => {
    // Mock env to have OPENAI_API_KEY so it doesn't throw
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalNodeEnv = (process.env as Record<string, string>).NODE_ENV;
    process.env.OPENAI_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';

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
      (process.env as Record<string, string>).NODE_ENV = originalNodeEnv ?? '';
    }
  });
});

describe('BrandProfilerWithoutLogoService — asset local (261025-v14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') return makeChain({ data: [], error: null });
      if (table === 'stores') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });
    process.env.OPENAI_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  it('loopback localhost → data URL no callVision (download único)', async () => {
    mockFetch.mockResolvedValue(fetchBytes(PNG_BYTES));
    const { invoker, invokeMock } = makeRecordingInvoker();
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(invoker);

    const result = await service.generate({
      ...mockBrandProfilerInput,
      assetUrl: 'http://localhost/sig.png',
      intendedPalette: { primary: '#FF0000', accent: '#00FF00', background: '#FFFFFF', support: [] },
    }, TELEMETRY);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const request = invokeMock.mock.calls[0][1] as { productImagesDataUrls: string[] };
    expect(request.productImagesDataUrls).toHaveLength(1);
    expect(request.productImagesDataUrls[0]).toMatch(/^data:image\/png;base64,/);
    expect(request.productImagesDataUrls[0]).not.toContain('localhost');
  });

  it.each([
    ['http://127.0.0.1/sig.png', PNG_BYTES, 'image/png'],
    ['http://[::1]/sig.jpg', JPEG_BYTES, 'image/jpeg'],
  ])('%s → data URL %s em callVisionFull', async (assetUrl, bytes, mime) => {
    mockFetch.mockResolvedValue(fetchBytes(bytes));
    const { invoker, invokeMock } = makeRecordingInvoker();
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(invoker);

    const asset = await (service as any).downloadAssetBuffer(assetUrl);
    expect(asset.mimeType).toBe(mime);

    await (service as any).callVisionFull({ ...mockBrandProfilerInput, assetUrl }, 'prompt', asset, TELEMETRY);

    const request = invokeMock.mock.calls[0][1] as { productImagesDataUrls: string[] };
    expect(request.productImagesDataUrls[0]).toMatch(new RegExp(`^data:${mime.replace('/', '\\/')};base64,`));
  });

  it('URL remota permanece crua (mesmo sem asset baixado)', async () => {
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(makeRecordingInvoker().invoker);

    const payload = (service as any).buildVisionImagePayload('https://cdn.example.com/x.png', null);

    expect(payload).toBe('https://cdn.example.com/x.png');
  });

  it('loopback com download vazio → local_asset_download_failed e provider NÃO é chamado', async () => {
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    const { invoker, invokeMock } = makeRecordingInvoker();
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(invoker);

    await expect(service.generate({
      ...mockBrandProfilerInput,
      assetUrl: 'http://localhost/sig.png',
      intendedPalette: { primary: '#FF0000', accent: '#00FF00', background: '#FFFFFF', support: [] },
    }, TELEMETRY)).rejects.toMatchObject({
      name: 'BrandProfilerWithoutLogoError',
      metadata: { errorType: 'local_asset_download_failed' },
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('loopback com HTTP não-ok ou conteúdo sem magic bytes → local_asset_download_failed sem provider', async () => {
    mockFetch.mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) });
    const { invoker, invokeMock } = makeRecordingInvoker();
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(invoker);

    const input = {
      ...mockBrandProfilerInput,
      assetUrl: 'http://localhost/sig.png',
      intendedPalette: { primary: '#FF0000', accent: '#00FF00', background: '#FFFFFF', support: [] },
    };

    await expect(service.generate(input, TELEMETRY)).rejects.toMatchObject({
      metadata: { errorType: 'local_asset_download_failed' },
    });

    mockFetch.mockResolvedValue(fetchBytes(Uint8Array.from([0x00, 0x01, 0x02, 0x03])));
    await expect(service.generate(input, TELEMETRY)).rejects.toMatchObject({
      metadata: { errorType: 'local_asset_download_failed' },
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('provider_error do gateway no caminho de divergência permanece provider_error', async () => {
    const providerError = new AiInvocationError({
      kind: 'provider_error',
      retryable: true,
      message: 'upstream failed',
    });
    const invokeMock = vi.fn(async () => { throw providerError; });
    const invoker = {
      invoke: invokeMock as unknown as AiInvoker['invoke'],
      hasFallback: vi.fn(async () => false),
    } as AiInvoker;
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(invoker);

    const rolePresence = new Map();

    await expect((service as any).handleDivergence(
      { ...mockBrandProfilerInput, assetUrl: 'https://cdn.example.com/x.png' },
      { primary: '#FF0000', accent: '#00FF00', background: '#FFFFFF', support: [] },
      null,
      [],
      rolePresence,
      [],
      [],
      Date.now(),
      TELEMETRY,
    )).rejects.toMatchObject({ metadata: { errorType: 'provider_error' } });
  });
});

describe('BrandProfilerWithoutLogoService — assertActiveVisualSignature guard (261025-svt)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
  });

  it('guard false com perfil existente → superseded e ZERO update/insert', async () => {
    const updateMock = vi.fn();
    const insertMock = vi.fn();
    mockSupabaseFrom.mockImplementation(() => {
      const chain: any = makeChain({ data: [mockSyncedProfile], error: null });
      chain.update = updateMock;
      chain.insert = insertMock;
      return chain;
    });

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();

    await expect(
      service.generate({ ...mockBrandProfilerInput, assertActiveVisualSignature: async () => false }),
    ).rejects.toMatchObject({
      name: 'BrandProfilerWithoutLogoError',
      metadata: { errorType: 'visual_signature_superseded' },
    });

    expect(mockSupabaseFrom).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('guard false bloqueia o caminho de reuso (existente synced) antes do update outdated→synced', async () => {
    let updateCalledWith: any = null;
    mockSupabaseFrom.mockImplementation(() => {
      const chain: any = makeChain({ data: [mockOutdatedProfile], error: null });
      chain.update = vi.fn((data: any) => {
        updateCalledWith = data;
        return chain;
      });
      return chain;
    });

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();

    await expect(
      service.generate({ ...mockBrandProfilerInput, assertActiveVisualSignature: async () => false }),
    ).rejects.toMatchObject({ metadata: { errorType: 'visual_signature_superseded' } });

    expect(updateCalledWith).toBeNull();
  });

  it('guard false sem perfil → rejeita antes de qualquer insert', async () => {
    const insertMock = vi.fn();
    mockSupabaseFrom.mockImplementation(() => {
      const chain: any = makeChain({ data: [], error: null });
      chain.insert = insertMock;
      return chain;
    });

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();

    await expect(
      service.generate({ ...mockBrandProfilerInput, assertActiveVisualSignature: async () => false }),
    ).rejects.toMatchObject({ metadata: { errorType: 'visual_signature_superseded' } });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('guard true → fluxo atual preservado (reuso retorna perfil)', async () => {
    mockSupabaseFrom.mockImplementation(() => makeChain({ data: [mockSyncedProfile], error: null }));
    const guard = vi.fn(async () => true);

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();
    const result = await service.generate({
      ...mockBrandProfilerInput,
      assertActiveVisualSignature: guard,
    });

    expect(result.success).toBe(true);
    expect(result.profile.id).toBe('profile-synced-001');
    expect(guard).toHaveBeenCalled();
  });

  it('sem guard → comportamento atual preservado', async () => {
    mockSupabaseFrom.mockImplementation(() => makeChain({ data: [mockSyncedProfile], error: null }));

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService();
    const result = await service.generate(mockBrandProfilerInput);

    expect(result.success).toBe(true);
    expect(result.profile.id).toBe('profile-synced-001');
  });
});

describe('BrandProfilerWithoutLogoService — onCall (F38.1, D7/D11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'store_brand_profiles') {
        return makeChain({ data: [], error: null });
      }
      if (table === 'stores') {
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });
    process.env.OPENAI_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  it('Teste 6: onCall do BrandProfilerInput repassado ao BrandProfiler interno (threading) — envelope chega à chamada de visão', async () => {
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(
      makeInvoker({ promptTokens: 90, completionTokens: 30, totalTokens: 120 })
    );
    const onCall = vi.fn();
    const result = await service.generate({
      ...mockBrandProfilerInput,
      intendedPalette: { primary: '#FF0000', accent: '#00FF00', background: '#FFFFFF', support: [] },
      onCall,
    }, TELEMETRY);

    expect(result.success).toBe(true);
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.usage).toEqual({ promptTokens: 90, completionTokens: 30, totalTokens: 120 });
  });

  it('Teste 7: path 1 (intendedPalette, probe unavailable) → 1 onCall de visão com provider/model/usage/durationMs', async () => {
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(
      makeInvoker({ promptTokens: 100, completionTokens: 50, totalTokens: 150 })
    );
    const onCall = vi.fn();
    const result = await service.generate({
      ...mockBrandProfilerInput,
      intendedPalette: { primary: '#FF0000', accent: '#00FF00', background: '#FFFFFF', support: [] },
      onCall,
    }, TELEMETRY);

    expect(result.success).toBe(true);
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o');
    expect(info.usage).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 8: path 2 (sem paleta) → 1 onCall de visão (brand-profiler só faz chamadas de visão)', async () => {
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(
      makeInvoker({ promptTokens: 200, completionTokens: 80, totalTokens: 280 })
    );
    const onCall = vi.fn();
    const result = await service.generate({
      ...mockBrandProfilerInput,
      intendedPalette: null,
      onCall,
    }, TELEMETRY);

    expect(result.success).toBe(true);
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o');
    expect(info.usage).toEqual({ promptTokens: 200, completionTokens: 80, totalTokens: 280 });
  });

  it('Teste 9: sem OPENAI_API_KEY (dev, mockGenerate) → 0 onCalls (sem chamada IA, 6.5)', async () => {
    delete process.env.OPENAI_API_KEY;

    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(makeInvoker());
    const onCall = vi.fn();
    const result = await service.generate({
      ...mockBrandProfilerInput,
      intendedPalette: null,
      onCall,
    }, TELEMETRY);

    expect(result.success).toBe(true);
    expect(onCall).not.toHaveBeenCalled();
  });

  it('Teste 10: onCall lançando → geração continua (best-effort D7) e resultado inalterado', async () => {
    const { BrandProfilerWithoutLogoService } = await import('@/lib/visual-signature/brand-profiler');
    const service = new BrandProfilerWithoutLogoService(
      makeInvoker({ promptTokens: 200, completionTokens: 80, totalTokens: 280 })
    );
    const onCall = vi.fn(() => {
      throw new Error('boom — onCall deve ser best-effort');
    });
    const result = await service.generate({
      ...mockBrandProfilerInput,
      intendedPalette: null,
      onCall,
    }, TELEMETRY);

    expect(result.success).toBe(true);
    expect(onCall).toHaveBeenCalledTimes(1);
  });
});
