import { describe, it, expect, vi, beforeEach } from 'vitest';

// As fachadas importam `@/lib/ai` (gateway default) → sink padrão →
// cost-estimator → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
});

import { createTextProvider } from '../factory';
import { OpenAITextProvider } from '../openai';
import { MockTextProvider } from '../mock';
import { NoopAiTelemetrySink } from '@/lib/ai';
import type { AiInvoker, AiInvocationResult, AiTelemetryContext } from '@/lib/ai';

const TELEMETRY: AiTelemetryContext = {
  operationRunId: 'run-1',
  operationRunType: 'campaign_delivery',
  traceId: 'trace-1',
  storeId: 'store-1',
  sink: new NoopAiTelemetrySink(),
};

function makeInvoker(result: AiInvocationResult): AiInvoker {
  return {
    invoke: vi.fn(async () => result),
    hasFallback: vi.fn(async () => false),
  };
}

describe('TextProvider Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createTextProvider() sem env retorna OpenAITextProvider', () => {
    const provider = createTextProvider();
    expect(provider).toBeInstanceOf(OpenAITextProvider);
    expect(provider.name).toBe('openai');
  });

  it('createTextProvider("openai") retorna OpenAITextProvider', () => {
    const provider = createTextProvider('openai', TELEMETRY);
    expect(provider).toBeInstanceOf(OpenAITextProvider);
    expect(provider.name).toBe('openai');
  });

  it('createTextProvider("mock") retorna MockTextProvider', () => {
    const provider = createTextProvider('mock');
    expect(provider).toBeInstanceOf(MockTextProvider);
    expect(provider.name).toBe('mock');
  });
});

describe('OpenAITextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('name is "openai"', () => {
    const provider = new OpenAITextProvider(TELEMETRY, makeInvoker({ content: 'x', model: 'gpt-4o' }));
    expect(provider.name).toBe('openai');
  });

  it('generateText delega ao gateway e mapeia TextProviderResult', async () => {
    const invoker = makeInvoker({
      content: '{"title":"Test"}',
      model: 'gpt-4o',
      usage: { promptTokens: 10, completionTokens: 5 },
    });
    const provider = new OpenAITextProvider(TELEMETRY, invoker);

    const result = await provider.generateText('test prompt');

    expect(result.content).toBe('{"title":"Test"}');
    expect(result.model).toBe('gpt-4o');
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(5);
    expect(invoker.invoke).toHaveBeenCalledWith(
      'campaign_copy',
      expect.objectContaining({ prompt: 'test prompt' }),
      TELEMETRY
    );
  });

  it('generateText com system inclui system no request', async () => {
    const invoker = makeInvoker({ content: 'ok', model: 'gpt-4o' });
    const provider = new OpenAITextProvider(TELEMETRY, invoker);

    await provider.generateText('test prompt', { system: 'Você é um copywriter.' });

    const request = (invoker.invoke as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(request.system).toBe('Você é um copywriter.');
  });
});

describe('MockTextProvider', () => {
  let provider: MockTextProvider;

  beforeEach(() => {
    provider = new MockTextProvider();
  });

  it('name is "mock"', () => {
    expect(provider.name).toBe('mock');
  });

  it('generateText retorna dados determinísticos', async () => {
    const result = await provider.generateText('qualquer prompt');
    const parsed = JSON.parse(result.content);
    expect(parsed.title).toBe('Mock Título Persuasivo');
    expect(parsed.caption).toContain('Descrição do produto');
    expect(parsed.hashtags).toHaveLength(4);
    expect(parsed.cta_post).toBe('Garanta já a sua!');
  });

  it('generateText retorna usage zero', async () => {
    const result = await provider.generateText('qualquer prompt');
    expect(result.usage.promptTokens).toBe(0);
    expect(result.usage.completionTokens).toBe(0);
  });

  it('generateText retorna model mock-model-v1', async () => {
    const result = await provider.generateText('qualquer prompt');
    expect(result.model).toBe('mock-model-v1');
  });
});
