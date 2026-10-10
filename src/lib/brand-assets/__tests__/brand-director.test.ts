import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// O serviço importa `@/lib/ai` (gateway default), que carrega o sink padrão →
// cost-estimator → tracker → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
});

const mockProbeColors = vi.fn();
const mockFindClosestProbeCluster = vi.fn();

vi.mock('@/lib/image-generation/prompt-loader', () => ({
  PromptLoader: class {
    load = vi.fn(() => 'mocked prompt');
  },
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

import { NoopAiTelemetrySink, AiInvocationError } from '@/lib/ai';
import type { AiInvoker, AiTelemetryContext, TokenUsage } from '@/lib/ai';

const mockProbe = {
  dominant_pixels: [
    { hex: '#CC0000', rgb: [204, 0, 0], lab: [50, 60, 50], frequency: 0.4, saturation: 0.8, luminance: 0.3, classification: 'dominant', edgeRatio: 0.5 },
  ],
  small_but_structural: [],
  dark_ink_candidates: [],
  neutral_candidates: [],
  background_candidates: [{ hex: '#FFFFFF', rgb: [255, 255, 255], lab: [100, 0, 0], frequency: 0.2, saturation: 0, luminance: 1, classification: 'background', edgeRatio: 0.2 }],
  suspected_transitions: [],
};

const TELEMETRY: AiTelemetryContext = {
  operationRunId: 'run-1',
  operationRunType: 'brand_profile',
  traceId: 'trace-1',
  storeId: 'store-1',
  sink: new NoopAiTelemetrySink(),
};

function visionJson(): string {
  return JSON.stringify({
    logo_colors_detected: ['#CC0000'],
    safe_color_tokens: { primary: '#CC0000', secondary: '#666666', accent: '#CC0000', background: '#FFFFFF' },
    visual_style: 'Moderno',
    visual_tone: 'Elegante',
    typography_direction: 'Sans-serif',
    brand_personality: 'Sofisticado',
    campaign_guidelines: 'Guidelines',
    campaign_brief: 'Brief',
    inferred_primary_color: '#CC0000',
    inferred_accent_color: '#CC0000',
    confidence_score: 0.9,
  });
}

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
      durationMs: 12,
    });
    return { content: visionJson(), model: 'gpt-4o', usage };
  });
  return {
    invoke: invokeMock as unknown as AiInvoker['invoke'],
    hasFallback: vi.fn(async () => false),
  };
}

const basicStoreData = {
  storeName: 'Minha Loja',
  segment: 'alimentacao',
  city: 'São Paulo',
  state: 'SP',
};

describe('BrandDirectorService.analyze onCall (F38.1/F46-04, D7/D9/D11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';
    mockProbeColors.mockResolvedValue(mockProbe);
    mockFindClosestProbeCluster.mockReturnValue({ cluster: { hex: '#CC0000' }, deltaE: 0 });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  it('Teste 1: analyze via invoke → onCall com envelope (provider/model real/usage/durationMs)', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService(
      makeInvoker({ promptTokens: 100, completionTokens: 50, totalTokens: 150 })
    );
    const onCall = vi.fn();

    const result = await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      onCall,
      telemetry: TELEMETRY,
    });

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o');
    expect(info.usage).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 2: onCall que LANÇA -> analyze continua e resolve normalmente (best-effort D7)', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService(
      makeInvoker({ promptTokens: 100, completionTokens: 50, totalTokens: 150 })
    );
    const onCall = vi.fn(() => {
      throw new Error('boom — onCall deve ser best-effort');
    });

    const result = await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      onCall,
      telemetry: TELEMETRY,
    });

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('sem onCall -> analyze resolve normalmente (retrocompatibilidade)', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService(
      makeInvoker({ promptTokens: 10, completionTokens: 20, totalTokens: 30 })
    );
    const result = await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      telemetry: TELEMETRY,
    });

    expect(result.visual_style).toBe('Moderno');
  });

  it('invoca brand_profile_vision com json_object, detail low e maxTokens 3000', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const invoker = makeInvoker();
    const service = new BrandDirectorService(invoker);

    await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      telemetry: TELEMETRY,
    });

    const invokeMock = invoker.invoke as unknown as ReturnType<typeof vi.fn>;
    expect(invokeMock.mock.calls[0][0]).toBe('brand_profile_vision');
    expect(invokeMock.mock.calls[0][1]).toMatchObject({
      responseFormat: 'json_object',
      imageDetail: 'low',
      maxTokens: 3000,
    });
  });

  it('sem telemetria lança (contexto obrigatório)', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService(makeInvoker());

    await expect(
      service.analyze({
        logoBuffer: Buffer.from('fake-png'),
        logoMimeType: 'image/png',
        storeData: basicStoreData,
      })
    ).rejects.toThrow(/AiTelemetryContext/);
  });
});

// ── F-quick: classificação de recusa/truncamento/vazio/JSON ────────────────
describe('BrandDirectorService.analyze — classificação de resposta (F-quick)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';
    mockProbeColors.mockResolvedValue(mockProbe);
    mockFindClosestProbeCluster.mockReturnValue({ cluster: { hex: '#CC0000' }, deltaE: 0 });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  function visionInvoker(result: { content?: string | null; finishReason?: string; refusal?: string }): AiInvoker {
    return {
      invoke: vi.fn(async () => ({
        content: result.content ?? undefined,
        model: 'gpt-4o',
        finishReason: result.finishReason,
        refusal: result.refusal,
      })) as unknown as AiInvoker['invoke'],
      hasFallback: vi.fn(async () => false),
    };
  }

  function rejectingInvoker(err: unknown): AiInvoker {
    return {
      invoke: vi.fn(async () => {
        throw err;
      }) as unknown as AiInvoker['invoke'],
      hasFallback: vi.fn(async () => false),
    };
  }

  async function analyzeExpectError(invoker: AiInvoker): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerKind?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deterministicPreserved: boolean;
  }> {
    const { BrandDirectorService, BrandDirectorAnalysisError } = await import('../brand-director');
    const service = new BrandDirectorService(invoker);
    const err = await service
      .analyze({
        logoBuffer: Buffer.from('fake-png'),
        logoMimeType: 'image/png',
        storeData: basicStoreData,
        telemetry: TELEMETRY,
      })
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(BrandDirectorAnalysisError);
    return {
      errorType: err.metadata.errorType,
      providerKind: err.metadata.providerKind,
      deterministicPreserved: err.deterministicResult !== null,
    };
  }

  it('JSON válido e completo resolve', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService(visionInvoker({ content: visionJson(), finishReason: 'stop' }));
    const result = await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      telemetry: TELEMETRY,
    });
    expect(result.visual_style).toBe('Moderno');
  });

  it('content vazio "" → empty_content', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: '', finishReason: 'stop' }));
    expect(info.errorType).toBe('empty_content');
    expect(info.deterministicPreserved).toBe(true);
  });

  it('content null (sem finishReason) → empty_content', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: null }));
    expect(info.errorType).toBe('empty_content');
  });

  it('recusa explícita + content null → refused (prioridade sobre vazio)', async () => {
    const info = await analyzeExpectError(
      visionInvoker({ content: null, refusal: 'não posso ajudar', finishReason: 'stop' }),
    );
    expect(info.errorType).toBe('refused');
  });

  it('recusa + finish_reason=length → refused (recusa tem prioridade)', async () => {
    const info = await analyzeExpectError(
      visionInvoker({ content: '', refusal: 'recusado', finishReason: 'length' }),
    );
    expect(info.errorType).toBe('refused');
  });

  it('finish_reason=length + content vazio → truncated_response (prioridade sobre vazio)', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: '', finishReason: 'length' }));
    expect(info.errorType).toBe('truncated_response');
  });

  it('finish_reason=content_filter → refused', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: '{}', finishReason: 'content_filter' }));
    expect(info.errorType).toBe('refused');
  });

  it('JSON malformado → invalid_json', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: '{"a":', finishReason: 'stop' }));
    expect(info.errorType).toBe('invalid_json');
  });

  it('JSON null → invalid_json_shape (sem TypeError)', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: 'null', finishReason: 'stop' }));
    expect(info.errorType).toBe('invalid_json_shape');
  });

  it('JSON array → invalid_json_shape', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: '[]', finishReason: 'stop' }));
    expect(info.errorType).toBe('invalid_json_shape');
  });

  it('JSON primitivo → invalid_json_shape', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: '5', finishReason: 'stop' }));
    expect(info.errorType).toBe('invalid_json_shape');
  });

  it('objeto JSON válido sem campos críticos → incomplete_response', async () => {
    const info = await analyzeExpectError(visionInvoker({ content: '{"logo_colors_detected":[]}', finishReason: 'stop' }));
    expect(info.errorType).toBe('incomplete_response');
  });

  it('erro de transporte (AiInvocationError) → api_error com providerKind preservado', async () => {
    const info = await analyzeExpectError(
      rejectingInvoker(new AiInvocationError({ kind: 'network', retryable: true, message: 'fetch failed' })),
    );
    expect(info.errorType).toBe('api_error');
    expect(info.providerKind).toBe('network');
  });

  it('sucesso: exatamente UMA chamada ao invoker e nunca aciona fallback', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const invoke = vi.fn(async () => ({ content: visionJson(), model: 'gpt-4o', finishReason: 'stop' }));
    const hasFallback = vi.fn(async () => false);
    const invoker = { invoke: invoke as unknown as AiInvoker['invoke'], hasFallback } as AiInvoker;
    const service = new BrandDirectorService(invoker);

    await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      telemetry: TELEMETRY,
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(hasFallback).not.toHaveBeenCalled();
  });

  it('falha (JSON inválido): também exatamente UMA invocação — sem fallback automático', async () => {
    const { BrandDirectorService } = await import('../brand-director');
    const invoke = vi.fn(async () => ({ content: '{"a":', model: 'gpt-4o', finishReason: 'stop' }));
    const hasFallback = vi.fn(async () => false);
    const invoker = { invoke: invoke as unknown as AiInvoker['invoke'], hasFallback } as AiInvoker;
    const service = new BrandDirectorService(invoker);

    await service
      .analyze({
        logoBuffer: Buffer.from('fake-png'),
        logoMimeType: 'image/png',
        storeData: basicStoreData,
        telemetry: TELEMETRY,
      })
      .catch(() => {});

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(hasFallback).not.toHaveBeenCalled();
  });

  it('logs sanitizados: não contêm conteúdo bruto nem texto de recusa', async () => {
    const SECRET_CONTENT = 'CONTEUDO-BRUTO-SEGREDO';
    const REFUSAL_TEXT = 'RECUSA-TEXTUAL-EXPLICITA';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { BrandDirectorService } = await import('../brand-director');
      const service = new BrandDirectorService(
        visionInvoker({ content: SECRET_CONTENT, refusal: REFUSAL_TEXT, finishReason: 'stop' }),
      );
      await service
        .analyze({
          logoBuffer: Buffer.from('fake-png'),
          logoMimeType: 'image/png',
          storeData: basicStoreData,
          telemetry: TELEMETRY,
        })
        .catch(() => {});

      const logged = [...errorSpy.mock.calls, ...logSpy.mock.calls].flat().map(String).join(' ');
      expect(logged).not.toContain(SECRET_CONTENT);
      expect(logged).not.toContain(REFUSAL_TEXT);
      expect(logged).toContain('refused');
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it('logs sanitizados: objeto bruto não é logado (regressão do "Full raw")', async () => {
    const MARKER = 'MARCADOR-INTERNO-NAO-DEVE-LOGAR';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { BrandDirectorService } = await import('../brand-director');
      const service = new BrandDirectorService(
        visionInvoker({ content: JSON.stringify({ visual_style: '', segredo: MARKER }), finishReason: 'stop' }),
      );
      await service
        .analyze({
          logoBuffer: Buffer.from('fake-png'),
          logoMimeType: 'image/png',
          storeData: basicStoreData,
          telemetry: TELEMETRY,
        })
        .catch(() => {});

      const logged = [...errorSpy.mock.calls, ...logSpy.mock.calls].flat().map(String).join(' ');
      expect(logged).not.toContain(MARKER);
      expect(logged).toContain('incomplete_response');
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
