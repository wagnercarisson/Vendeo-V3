import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGenerationService } from '../image-generation-service';
import type { CampaignBrief } from '@/components/campaign/types';
import type { CampaignInput } from '@/components/campaign/types';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';

// Mock prompt-loader module to avoid file system reads in buildPromptVariables
// The PromptLoader injected via constructor already overrides the default,
// but buildPromptVariables indirectly uses promptLoader through other methods.
// We control the load() return via the constructor-injected mock.

// Helper: build a minimal CampaignBrief suitable for validatePrompts
function createMinimalBrief(overrides?: Partial<CampaignBrief>): CampaignBrief {
  return {
    campaignInput: {
      productName: 'Produto Teste',
      discountedPriceCents: 1990,
      productImageDataUrl: 'data:image/jpeg;base64,test',
      badgeText: 'Oferta',
    } as CampaignInput,
    store: {
      name: 'Loja Teste',
      segment: 'outros',
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      brandColor: '#22C55E',
    },
    brandProfile: null,
    identity: {
      state: 'text_only',
      imageUrl: null,
      directive: '',
    },
    ...overrides,
  };
}

describe('ImageGenerationService.validatePrompts', () => {
  let mockLoad: ReturnType<typeof vi.fn>;
  let mockProvider: { name: string; generateImage: ReturnType<typeof vi.fn> };
  let service: ImageGenerationService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLoad = vi.fn();
    mockProvider = {
      name: 'test',
      generateImage: vi.fn(),
    };

    service = new ImageGenerationService(
      mockProvider as any,
      { load: mockLoad, clearCache: vi.fn() } as unknown as PromptLoader,
    );
  });

  it('validatePrompts retorna valid=true para prompt válido', () => {
    // Configure mock loader to return prompts with no unresolved variables
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        // All director variables resolved (no {{...}} patterns)
        return 'Prompt de direção visual para Produto Teste na Loja Teste segmento outros';
      }
      if (name === 'campaign-image-reviewer') {
        // All reviewer variables resolved
        return 'Revise Produto Teste na Loja Teste preço R$ 19,90 badge Oferta';
      }
      return '';
    });

    const brief = createMinimalBrief();
    const result = service.validatePrompts(brief);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validatePrompts retorna valid=false quando director prompt tem placeholder não resolvido', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        // Unresolved placeholder
        return 'Prompt sobre {{variavelInexistente}}';
      }
      if (name === 'campaign-image-reviewer') {
        // Clean reviewer prompt
        return 'Revise Produto Teste na Loja Teste';
      }
      return '';
    });

    const brief = createMinimalBrief();
    const result = service.validatePrompts(brief);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Diretor de imagem');
    expect(result.errors[0]).toContain('variavelInexistente');
  });

  it('validatePrompts retorna valid=false quando reviewer prompt tem placeholder não resolvido', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        // Clean director prompt
        return 'Prompt de direção visual para Produto Teste';
      }
      if (name === 'campaign-image-reviewer') {
        // Unresolved placeholder
        return 'Revise produto {{outraVar}}';
      }
      return '';
    });

    const brief = createMinimalBrief();
    const result = service.validatePrompts(brief);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Revisor de imagem');
    expect(result.errors[0]).toContain('outraVar');
  });

  it('validatePrompts falha quando prompt de intent válida não existe — sem fallback (F31.2 7.12)', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-spotlight') {
        throw new Error('ENOENT: prompt not found');
      }
      if (name === 'campaign-image-reviewer') {
        return 'Revise produto';
      }
      return '';
    });

    const brief = createMinimalBrief({
      campaignInput: {
        productName: 'Produto Teste',
        productImageDataUrl: 'data:image/jpeg;base64,test',
        campaignIntent: 'spotlight',
      } as import('@/components/campaign/types').CampaignInput,
    });
    const result = service.validatePrompts(brief);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('campaign-image-director-spotlight');
    expect(result.errors[0]).toContain('spotlight');

    // Verifica que NÃO houve fallback para o prompt antigo
    expect(mockLoad).not.toHaveBeenCalledWith('campaign-image-director', expect.anything());
    expect(mockLoad).not.toHaveBeenCalledWith('campaign-image-director.md', expect.anything());
  });

  it('validatePrompts valida prompt do revisor com campaignIntent (F31.3)', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        return 'Prompt de direção visual';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Revise produto com comportamento esperado: preço promocional';
      }
      return '';
    });

    const brief = createMinimalBrief();
    const result = service.validatePrompts(brief);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validatePrompts valida com spotlight e exclusive intents', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-spotlight') {
        return 'Prompt spotlight';
      }
      if (name === 'campaign-image-director-exclusive') {
        return 'Prompt exclusive';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Revise produto com comportamento esperado';
      }
      return '';
    });

    const spotlightBrief = createMinimalBrief({
      campaignInput: {
        productName: 'Vestido',
        productImageDataUrl: 'data:image/jpeg;base64,test',
        campaignIntent: 'spotlight',
      } as import('@/components/campaign/types').CampaignInput,
    });
    expect(service.validatePrompts(spotlightBrief).valid).toBe(true);

    const exclusiveBrief = createMinimalBrief({
      campaignInput: {
        productName: 'Buquê',
        productImageDataUrl: 'data:image/jpeg;base64,test',
        campaignIntent: 'exclusive',
      } as import('@/components/campaign/types').CampaignInput,
    });
    expect(service.validatePrompts(exclusiveBrief).valid).toBe(true);
  });

  it('validatePrompts falha se placeholder antigo {{discountedPrice}} no prompt do revisor', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        return 'Prompt direção';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Revise produto com {{discountedPrice}}';
      }
      return '';
    });

    const brief = createMinimalBrief();
    const result = service.validatePrompts(brief);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('{{discountedPrice}}'))).toBe(true);
  });

  it('validatePrompts propaga mandatoryArtworkText, campaignDetails e additionalDetails ao revisor', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        return 'Prompt de direção visual';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Revise produto com contexto';
      }
      return '';
    });

    const brief = createMinimalBrief({
      campaignInput: {
        productName: 'Produto Teste',
        productImageDataUrl: 'data:image/jpeg;base64,test',
        campaignIntent: 'offer',
        mandatoryArtworkText: 'Imagens meramente ilustrativas',
        campaignDetails: 'Frete grátis acima de R$ 100',
        additionalDetails: 'Válido somente em loja física',
      } as CampaignInput,
    });

    const result = service.validatePrompts(brief);
    expect(result.valid).toBe(true);

    const reviewerCall = mockLoad.mock.calls.find((call) => call[0] === 'campaign-image-reviewer');
    expect(reviewerCall).toBeDefined();
    const vars = reviewerCall![1] as Record<string, string>;
    expect(vars).toHaveProperty('mandatoryArtworkTextSection');
    expect(vars).toHaveProperty('authorizedContextSection');
    expect(vars.mandatoryArtworkTextSection).toContain('Imagens meramente ilustrativas');
    expect(vars.authorizedContextSection).toContain('Frete grátis acima de R$ 100');
    expect(vars.authorizedContextSection).toContain('Válido somente em loja física');
  });

  it('validatePrompts continua valid=true com os novos campos preenchidos', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        return 'Prompt de direção visual';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Revise produto com contexto';
      }
      return '';
    });

    const brief = createMinimalBrief({
      campaignInput: {
        productName: 'Produto Teste',
        productImageDataUrl: 'data:image/jpeg;base64,test',
        campaignIntent: 'offer',
        mandatoryArtworkText: 'Imagens meramente ilustrativas',
        campaignDetails: 'Frete grátis acima de R$ 100',
        additionalDetails: 'Válido somente em loja física',
      } as CampaignInput,
    });

    const result = service.validatePrompts(brief);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validatePrompts sem mandatoryArtworkText continua válido', () => {
    mockLoad.mockImplementation((name: string) => {
      if (name === 'campaign-image-director-offer') {
        return 'Prompt de direção visual';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Revise produto';
      }
      return '';
    });

    const brief = createMinimalBrief();
    const result = service.validatePrompts(brief);
    expect(result.valid).toBe(true);
  });
});

describe('ImageGenerationService.generateImage', () => {
  it('generateImage propaga os 3 campos ao review() no fluxo REAL de geração', async () => {
    const mockProvider = {
      name: 'test',
      generateImage: vi.fn().mockResolvedValue({
        success: true,
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/png',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    };
    const mockLoad = vi.fn((name: string) => {
      if (name === 'campaign-image-director-offer') {
        return 'Prompt de direção visual sem placeholders';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Prompt de revisão sem placeholders';
      }
      return '';
    });
    const mockInputValidation = {
      validate: vi.fn().mockResolvedValue({ classification: 'match' }),
    };
    const mockImageReview = {
      review: vi.fn().mockResolvedValue({ passed: true, issues: [], failureType: null }),
      buildReviewPromptVariables: vi.fn(),
    };
    const mockMetricsWriter = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ImageGenerationService(
      mockProvider as any,
      { load: mockLoad, clearCache: vi.fn() } as unknown as PromptLoader,
      mockInputValidation as any,
      mockImageReview as any,
      mockMetricsWriter as any
    );

    const brief = createMinimalBrief({
      campaignInput: {
        productName: 'Produto Teste',
        productImageDataUrl: 'data:image/jpeg;base64,test',
        campaignIntent: 'offer',
        mandatoryArtworkText: 'Imagens meramente ilustrativas',
        campaignDetails: 'Frete grátis acima de R$ 100',
        additionalDetails: 'Válido somente em loja física',
      } as CampaignInput,
    });

    const result = await service.generateImage(brief);

    expect(result.success).toBe(true);
    expect(mockImageReview.review).toHaveBeenCalledTimes(1);
    const reviewInput = mockImageReview.review.mock.calls[0][1];
    expect(reviewInput.mandatoryArtworkText).toBe('Imagens meramente ilustrativas');
    expect(reviewInput.campaignDetails).toBe('Frete grátis acima de R$ 100');
    expect(reviewInput.additionalDetails).toBe('Válido somente em loja física');
  });
});

describe('ImageGenerationService.generateImage — telemetria D11 (usage/durationMs por tentativa)', () => {
  function buildService(onMetricsEvent?: (e: any) => void) {
    const mockProvider = {
      name: 'test',
      generateImage: vi.fn().mockResolvedValue({
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/png',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }),
    };
    const mockLoad = vi.fn((name: string) => {
      if (name === 'campaign-image-director-offer') {
        return 'Prompt de direção visual sem placeholders';
      }
      if (name === 'campaign-image-reviewer') {
        return 'Prompt de revisão sem placeholders';
      }
      return '';
    });
    // Mock validation: invoca o onCall interno do serviço (4º arg) com usage
    const mockInputValidation = {
      validate: vi.fn(async (...args: any[]) => {
        const onCall = args[3];
        if (typeof onCall === 'function') {
          onCall({
            provider: 'openai',
            model: 'gpt-4o',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            durationMs: 100,
          });
        }
        return { classification: 'match' };
      }),
    };
    // Mock review: invoca o onCall interno do serviço (3º arg) com usage
    const mockImageReview = {
      review: vi.fn(async (...args: any[]) => {
        const onCall = args[2];
        if (typeof onCall === 'function') {
          onCall({
            provider: 'openai',
            model: 'gpt-4o',
            usage: { promptTokens: 200, completionTokens: 60, totalTokens: 260 },
            durationMs: 500,
          });
        }
        return { passed: true, issues: [], failureType: null };
      }),
      buildReviewPromptVariables: vi.fn(),
    };
    const mockMetricsWriter = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ImageGenerationService(
      mockProvider as any,
      { load: mockLoad, clearCache: vi.fn() } as unknown as PromptLoader,
      mockInputValidation as any,
      mockImageReview as any,
      mockMetricsWriter as any
    );

    return {
      service,
      mockProvider,
      mockInputValidation,
      mockImageReview,
      mockMetricsWriter,
      brief: createMinimalBrief(),
    };
  }

  it('Teste 6: evento image_generation por tentativa com usage + durationMs (attempt 0..n)', async () => {
    const events: any[] = [];
    const { service, brief } = buildService();
    const result = await service.generateImage(brief, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);
    const genEvents = events.filter((e) => e.phase === 'image_generation' && e.usage);
    expect(genEvents.length).toBeGreaterThan(0);
    expect(genEvents[0].usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(genEvents[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 7: evento input_validation com usage quando a validação faz chamada de visão', async () => {
    const events: any[] = [];
    const { service, brief } = buildService();
    const result = await service.generateImage(brief, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);
    const validationEvents = events.filter((e) => e.phase === 'input_validation' && e.usage);
    expect(validationEvents.length).toBeGreaterThan(0);
    expect(validationEvents[0].usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(validationEvents[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 8: evento quality_review com usage por tentativa (attempt 1..n)', async () => {
    const events: any[] = [];
    const { service, brief } = buildService();
    const result = await service.generateImage(brief, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);
    const reviewEvents = events.filter((e) => e.phase === 'quality_review' && e.usage);
    expect(reviewEvents.length).toBeGreaterThan(0);
    expect(reviewEvents[0].usage).toEqual({ promptTokens: 200, completionTokens: 60, totalTokens: 260 });
    expect(reviewEvents[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 9: onMetricsEvent lançando → generateImage continua (best-effort)', async () => {
    const { service, brief } = buildService();
    const result = await service.generateImage(
      brief,
      undefined,
      undefined,
      () => { throw new Error('metrics boom'); }
    );
    expect(result.success).toBe(true);
  });

  it('Teste 10: sem onMetricsEvent → comportamento idêntico ao atual (compat)', async () => {
    const { service, brief } = buildService();
    const result = await service.generateImage(brief);
    expect(result.success).toBe(true);
  });
});
