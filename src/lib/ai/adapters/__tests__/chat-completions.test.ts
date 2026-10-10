// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AiModelTarget } from '@/lib/ai/model-resolver';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: mockCreate } };
    constructor(_opts: unknown) {}
  },
}));

vi.mock('@/lib/ai/api-keys', () => ({ getApiKey: vi.fn(() => 'test-key') }));

import { ChatCompletionsAdapter } from '../chat-completions';

const TARGET: AiModelTarget = { provider: 'openai', model: 'gpt-4o', protocol: 'chat-completions' };

function responseWith(
  message: Record<string, unknown>,
  finishReason: string | null,
): unknown {
  return {
    choices: [{ message, finish_reason: finishReason }],
    usage: { prompt_tokens: 2546, completion_tokens: 10, total_tokens: 2556 },
  };
}

describe('ChatCompletionsAdapter — metadados aditivos (F-quick)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('conteúdo válido preservado + finishReason capturado, sem recusa', async () => {
    mockCreate.mockResolvedValue(responseWith({ content: '{"a":1}' }, 'stop'));
    const adapter = new ChatCompletionsAdapter();

    const result = await adapter.invoke({ prompt: 'oi' }, TARGET);

    expect(result.content).toBe('{"a":1}');
    expect(result.finishReason).toBe('stop');
    expect(result.refusal).toBeUndefined();
    expect(result.usage).toEqual({ promptTokens: 2546, completionTokens: 10, totalTokens: 2556 });
  });

  it('content vazio é preservado como "" (não altera consumidores legados)', async () => {
    mockCreate.mockResolvedValue(responseWith({ content: '' }, 'stop'));
    const adapter = new ChatCompletionsAdapter();

    const result = await adapter.invoke({ prompt: 'oi' }, TARGET);

    expect(result.content).toBe('');
    expect(result.finishReason).toBe('stop');
  });

  it('content null + recusa explícita é capturado', async () => {
    mockCreate.mockResolvedValue(responseWith({ content: null, refusal: 'não posso ajudar' }, 'stop'));
    const adapter = new ChatCompletionsAdapter();

    const result = await adapter.invoke({ prompt: 'oi' }, TARGET);

    expect(result.content).toBe('');
    expect(result.refusal).toBe('não posso ajudar');
    expect(result.finishReason).toBe('stop');
  });

  it('resposta truncada expõe finish_reason=length', async () => {
    mockCreate.mockResolvedValue(responseWith({ content: '' }, 'length'));
    const adapter = new ChatCompletionsAdapter();

    const result = await adapter.invoke({ prompt: 'oi' }, TARGET);

    expect(result.finishReason).toBe('length');
  });

  it('sem choices → content "", metadados ausentes (compatibilidade)', async () => {
    mockCreate.mockResolvedValue({ usage: undefined });
    const adapter = new ChatCompletionsAdapter();

    const result = await adapter.invoke({ prompt: 'oi' }, TARGET);

    expect(result.content).toBe('');
    expect(result.finishReason).toBeUndefined();
    expect(result.refusal).toBeUndefined();
  });
});
