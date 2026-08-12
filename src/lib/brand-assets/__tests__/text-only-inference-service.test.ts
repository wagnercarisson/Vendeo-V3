import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockChatCompletionsCreate = vi.fn();

vi.mock('@/lib/image-generation/prompt-loader', () => ({
  PromptLoader: class {
    load = vi.fn(() => 'mocked prompt');
  },
}));

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: mockChatCompletionsCreate,
      },
    };
  },
}));

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

describe('BrandTextOnlyInferenceService.infer onCall (F38.1, D7/D11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockResult) } }],
      usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
    });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';
    mockChatCompletionsCreate.mockReset();
  });

  it('Teste 3: infer com OpenAI mockado -> onCall invocado com usage + durationMs', async () => {
    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService();
    const onCall = vi.fn();

    const result = await service.infer(mockInput, 30000, onCall);

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o');
    expect(info.usage).toEqual({ promptTokens: 120, completionTokens: 40, totalTokens: 160 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 4: infer em dev sem OPENAI_API_KEY (caminho mock) -> onCall NUNCA invocado', async () => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService();
    const onCall = vi.fn();

    const result = await service.infer(mockInput, 30000, onCall);

    // Caminho mock dev: sem chamada real de IA → sem evento (6.4/6.5)
    expect(result.visual_style).toBe('mock — desenvolvimento');
    expect(onCall).not.toHaveBeenCalled();
  });

  it('onCall que LANCA -> infer resolve normalmente (best-effort D7)', async () => {
    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService();
    const onCall = vi.fn(() => {
      throw new Error('boom — onCall deve ser best-effort');
    });

    const result = await service.infer(mockInput, 30000, onCall);

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('sem onCall -> infer resolve normalmente (retrocompatibilidade)', async () => {
    const { BrandTextOnlyInferenceService } = await import('../text-only-inference-service');
    const service = new BrandTextOnlyInferenceService();

    const result = await service.infer(mockInput, 30000);

    expect(result.visual_style).toBe('Moderno');
  });
});
