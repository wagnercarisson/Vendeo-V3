import { describe, it, expect, vi } from 'vitest';

// O serviço importa `@/lib/ai` (gateway default), que carrega o sink padrão →
// cost-estimator → tracker → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
});

import { InputValidationService } from '../input-validation-service';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { AiCallInfo, TokenUsage } from '@/lib/ai-cost/types';
import type { GenerationMetricsEvent } from '@/lib/image-generation/metrics/types';
import { NoopAiTelemetrySink } from '@/lib/ai';
import type { AiInvoker, AiTelemetryContext } from '@/lib/ai';

const VALID_JSON = JSON.stringify({ classification: 'match', confidence: 1.0 });

const TELEMETRY: AiTelemetryContext = {
  operationRunId: 'run-1',
  operationRunType: 'campaign_delivery',
  traceId: 'trace-1',
  storeId: 'store-1',
  sink: new NoopAiTelemetrySink(),
};

/**
 * Fake `AiInvoker` (seam de teste): emite o envelope no sink (simulando o
 * gateway) e retorna o resultado canônico.
 */
function makeInvoker(
  result: { content?: string; model?: string; usage?: TokenUsage },
  opts?: { capability?: string }
): AiInvoker {
  const invokeMock = vi.fn(async (_capability: string, _request: unknown, telemetry: AiTelemetryContext) => {
    const model = result.model ?? 'gpt-4o';
    await telemetry.sink.emit({
      capability: (opts?.capability ?? 'campaign_input_validation') as never,
      protocol: 'chat-completions',
      status: 'success',
      provider: 'openai',
      model,
      usage: result.usage,
      durationMs: 7,
    });
    return { content: result.content ?? '', model, usage: result.usage };
  });
  return {
    invoke: invokeMock as unknown as AiInvoker['invoke'],
    hasFallback: vi.fn(async () => false),
  };
}

describe('InputValidationService — gateway/onCall (F46-04)', () => {
  const mockLoader = {
    load: vi.fn().mockReturnValue('prompt de validação'),
    clearCache: vi.fn(),
  } as unknown as PromptLoader;

  it('Teste 2: validate via invoke → onCall com envelope (provider/model real/usage/durationMs)', async () => {
    const onCall = vi.fn();
    const service = new InputValidationService(
      mockLoader,
      makeInvoker({
        content: VALID_JSON,
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 },
      })
    );
    const result = await service.validate(
      'Produto Teste',
      'data:image/jpeg;base64,abc',
      undefined,
      onCall,
      TELEMETRY
    );
    expect(result.classification).toBe('match');
    expect(onCall).toHaveBeenCalledTimes(1);
    const info: AiCallInfo = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    // F46-04: modelo REAL da chamada de visão (gpt-4o), nunca o de imagem.
    expect(info.model).toBe('gpt-4o');
    expect(info.usage).toEqual({ promptTokens: 100, completionTokens: 25, totalTokens: 125 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 3: onCall que lança → validate continua e resolve normalmente (best-effort D7)', async () => {
    const onCall = vi.fn(() => {
      throw new Error('callback boom');
    });
    const service = new InputValidationService(mockLoader, makeInvoker({ content: VALID_JSON }));
    const result = await service.validate(
      'Produto Teste',
      'data:image/jpeg;base64,abc',
      undefined,
      onCall,
      TELEMETRY
    );
    expect(result.classification).toBe('match');
  });

  it('Teste 5: sem onCall (undefined) → comportamento idêntico ao atual', async () => {
    const service = new InputValidationService(mockLoader, makeInvoker({ content: VALID_JSON }));
    const result = await service.validate('Produto Teste', 'data:image/jpeg;base64,abc', undefined, undefined, TELEMETRY);
    expect(result.classification).toBe('match');
  });

  it('invoca a capability campaign_input_validation com detail high e maxTokens 500', async () => {
    const invoker = makeInvoker({ content: VALID_JSON });
    const service = new InputValidationService(mockLoader, invoker);
    await service.validate('Produto Teste', 'data:image/jpeg;base64,abc', undefined, undefined, TELEMETRY);

    const invokeMock = invoker.invoke as unknown as ReturnType<typeof vi.fn>;
    expect(invokeMock.mock.calls[0][0]).toBe('campaign_input_validation');
    expect(invokeMock.mock.calls[0][1]).toMatchObject({
      imageDetail: 'high',
      maxTokens: 500,
      productImagesDataUrls: ['data:image/jpeg;base64,abc'],
    });
  });

  it('sem telemetria lança (contexto obrigatório)', async () => {
    const service = new InputValidationService(mockLoader, makeInvoker({ content: VALID_JSON }));
    await expect(
      service.validate('Produto Teste', 'data:image/jpeg;base64,abc')
    ).rejects.toThrow(/AiTelemetryContext/);
  });

  it('override continua pulando a validação sem chamar invoke (anti-dupla-contagem)', async () => {
    const invoker = makeInvoker({ content: VALID_JSON });
    const service = new InputValidationService(mockLoader, invoker);
    const result = await service.validate(
      'Produto Teste',
      'data:image/jpeg;base64,abc',
      { productImageCheck: 'brief_review_confirmed' }
    );
    expect(result).toEqual({ classification: 'match', confidence: 1.0 });
    expect(invoker.invoke).not.toHaveBeenCalled();
  });
});

describe('Teste 1 (compile-time): GenerationMetricsEvent com usage + durationMs (D11)', () => {
  it('aceita usage (TokenUsage) e exige durationMs', () => {
    const event: GenerationMetricsEvent = {
      runId: 'run-1',
      phase: 'image_generation',
      provider: 'openai',
      model: 'gpt-image-2',
      elapsedMs: 100,
      attempt: 0,
      usage: { promptTokens: 10, totalTokens: 10 },
      durationMs: 95,
    };
    expect(event.durationMs).toBe(95);
    expect(event.usage?.promptTokens).toBe(10);
  });
});
