import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOpenAICreate } = vi.hoisted(() => ({ mockOpenAICreate: vi.fn() }));

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: { create: mockOpenAICreate },
    };
  },
}));

import { InputValidationService } from '../input-validation-service';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { AiCallInfo } from '@/lib/ai-cost/types';
import type { GenerationMetricsEvent } from '@/lib/image-generation/metrics/types';

const VALID_JSON = JSON.stringify({ classification: 'match', confidence: 1.0 });

describe('InputValidationService — onCall (D11)', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: InputValidationService;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockReturnValue('prompt de validação'),
      clearCache: vi.fn(),
    };
    service = new InputValidationService(mockLoader as unknown as PromptLoader, 'gpt-4o-test');
    mockOpenAICreate.mockReset();
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: VALID_JSON } }],
      usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
    });
  });

  it('Teste 2: validate com OpenAI mockado retornando usage → onCall com provider/model/usage/durationMs', async () => {
    const onCall = vi.fn();
    const result = await service.validate(
      'Produto Teste',
      'data:image/jpeg;base64,abc',
      undefined,
      onCall
    );
    expect(result.classification).toBe('match');
    expect(onCall).toHaveBeenCalledTimes(1);
    const info: AiCallInfo = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o-test');
    expect(info.usage).toEqual({ promptTokens: 100, completionTokens: 25, totalTokens: 125 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 3: onCall que lança → validate continua e resolve normalmente (best-effort D7)', async () => {
    const onCall = vi.fn(() => {
      throw new Error('callback boom');
    });
    const result = await service.validate(
      'Produto Teste',
      'data:image/jpeg;base64,abc',
      undefined,
      onCall
    );
    expect(result.classification).toBe('match');
  });

  it('Teste 5: sem onCall (undefined) → comportamento idêntico ao atual', async () => {
    const result = await service.validate('Produto Teste', 'data:image/jpeg;base64,abc');
    expect(result.classification).toBe('match');
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
