import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTextProvider } from '../factory';
import { OpenAITextProvider } from '../openai';
import { MockTextProvider } from '../mock';

const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: '{"title":"Test"}' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }),
}));

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
    const provider = createTextProvider('openai');
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
  let provider: OpenAITextProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAITextProvider('gpt-4o');
  });

  it('name is "openai"', () => {
    expect(provider.name).toBe('openai');
  });

  it('generateText chama OpenAI com prompt correto', async () => {
    const result = await provider.generateText('test prompt');
    expect(result.content).toBeDefined();
    expect(result.model).toBe('gpt-4o');
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(5);
  });

  it('generateText com system message inclui system no array', async () => {
    const result = await provider.generateText('test prompt', {
      system: 'Você é um copywriter.',
    });
    expect(result.content).toBe('{"title":"Test"}');
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
