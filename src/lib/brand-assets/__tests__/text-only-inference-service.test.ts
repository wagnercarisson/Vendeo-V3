import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// O serviço importa `@/lib/ai` (gateway default) → sink padrão →
// cost-estimator → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
});

vi.mock('@/lib/image-generation/prompt-loader', () => ({
  PromptLoader: class {
    load = vi.fn(() => 'mocked prompt');
  },
}));

import { NoopAiTelemetrySink } from '@/lib/ai';
import type { AiInvoker, AiInvocationResult, AiTelemetryContext } from '@/lib/ai';

const TELEMETRY: AiTelemetryContext = {
  operationRunId: 'run-1',
  operationRunType: 'brand_profile',
  traceId: 'trace-1',
  storeId: 'store-1',
  sink: new NoopAiTelemetrySink(),
};

const mockResult = {
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

const mockInput = {
  storeName: 'Minha Loja',
  segment: 'alimentacao',
  subsegment: null,
  toneOfVoice: 'moderno',
  positioning: null,
  shortDescription: null,
  slogan: null,
  city: 'São Paulo',
  state: 'SP',
};

/**
 * Fake `AiInvoker`: emite o envelope no sink (simulando o gateway) e devolve o
 * resultado canônico.
 */
function makeInvoker(content: string): AiInvoker {
  const invokeMock = vi.fn(
    async (
      _capability: string,
      _request: unknown,
      telemetry: AiTelemetryContext
    ): Promise<AiInvocationResult> => {
      await telemetry.sink.emit({
        capability: 'brand_profile_text',
        protocol: 'chat-completions',
        status: 'success',
        provider: 'openai',
        model: 'gpt-4o',
        usage: { promptTokens: 120, completionTokens: 40, totalTokens: 160 },
        durationMs: 12,
      });
      return {
        content,
        model: 'gpt-4o',
        usage: { promptTokens: 120, completionTokens: 40, totalTokens: 160 },
      };
    }
  );

  return {
    invoke: invokeMock as unknown as AiInvoker['invoke'],
    hasFallback: vi.fn(async () => false),
  };
}

describe('BrandTextOnlyInferenceService.infer onCall (F38.1, D7/D11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  it('Teste 3: infer via gateway -> onCall invocado com usage + durationMs', async () => {
    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService(makeInvoker(JSON.stringify(mockResult)));
    const onCall = vi.fn();

    const result = await service.infer(mockInput, 30000, onCall, TELEMETRY);

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o');
    expect(info.usage).toEqual({ promptTokens: 120, completionTokens: 40, totalTokens: 160 });
    expect(info.durationMs).toBe(12);
  });

  it('Teste 4: infer em dev sem OPENAI_API_KEY (caminho mock) -> onCall NUNCA invocado', async () => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService(makeInvoker(JSON.stringify(mockResult)));
    const onCall = vi.fn();

    const result = await service.infer(mockInput, 30000, onCall, TELEMETRY);

    // Caminho mock dev: sem chamada real de IA → sem evento (6.4/6.5)
    expect(result.visual_style).toBe('mock — desenvolvimento');
    expect(onCall).not.toHaveBeenCalled();
  });

  it('onCall que LANCA -> infer resolve normalmente (best-effort D7)', async () => {
    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService(makeInvoker(JSON.stringify(mockResult)));
    const onCall = vi.fn(() => {
      throw new Error('boom — onCall deve ser best-effort');
    });

    const result = await service.infer(mockInput, 30000, onCall, TELEMETRY);

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('sem onCall -> infer resolve normalmente (retrocompatibilidade)', async () => {
    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService(makeInvoker(JSON.stringify(mockResult)));

    const result = await service.infer(mockInput, 30000, undefined, TELEMETRY);

    expect(result.visual_style).toBe('Moderno');
  });
});
