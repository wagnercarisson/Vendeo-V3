import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockProbeColors = vi.fn();
const mockFindClosestProbeCluster = vi.fn();
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

const mockVisionResponse = (usage: Record<string, number>) => ({
  choices: [{
    message: {
      content: JSON.stringify({
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
      }),
    },
  }],
  usage,
});

const basicStoreData = {
  storeName: 'Minha Loja',
  segment: 'alimentacao',
  city: 'São Paulo',
  state: 'SP',
};

describe('BrandDirectorService.analyze onCall (F38.1, D7/D11)', () => {
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
    mockChatCompletionsCreate.mockReset();
  });

  it('Teste 1: analyze com OpenAI mockado retornando usage -> onCall invocado com provider/model/usage/durationMs', async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      mockVisionResponse({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    );

    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService();
    const onCall = vi.fn();

    const result = await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      onCall,
    });

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o');
    expect(info.usage).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 2: onCall que LANCA -> analyze continua e resolve normalmente (best-effort D7)', async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      mockVisionResponse({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    );

    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService();
    const onCall = vi.fn(() => {
      throw new Error('boom — onCall deve ser best-effort');
    });

    const result = await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
      onCall,
    });

    expect(result.visual_style).toBe('Moderno');
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('sem onCall -> analyze resolve normalmente (retrocompatibilidade)', async () => {
    mockChatCompletionsCreate.mockResolvedValue(
      mockVisionResponse({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 })
    );

    const { BrandDirectorService } = await import('../brand-director');
    const service = new BrandDirectorService();
    const result = await service.analyze({
      logoBuffer: Buffer.from('fake-png'),
      logoMimeType: 'image/png',
      storeData: basicStoreData,
    });

    expect(result.visual_style).toBe('Moderno');
  });
});
