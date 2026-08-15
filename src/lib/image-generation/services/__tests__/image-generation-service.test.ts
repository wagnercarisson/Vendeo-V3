import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGenerationService } from '../image-generation-service';
import type { CampaignBrief } from '@/lib/campaign/brief';
import { buildCampaignBriefFromFlat } from '@/lib/campaign/brief';
import type { ResolvedCampaignContext } from '@/components/campaign/types';
import type { GenerateImageRequest } from '@/lib/image-generation/schema';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';

// Mock prompt-loader module to avoid file system reads in buildPromptVariables
// The PromptLoader injected via constructor already overrides the default,
// but buildPromptVariables indirectly uses promptLoader through other methods.
// We control the load() return via the constructor-injected mock.

const STORE_ID = '44444444-4444-4444-8444-444444444444';

// Build a structured domain brief via the canonical mapper (39-04) from a flat payload.
function createMinimalBrief(
  overrides?: Partial<GenerateImageRequest>
): CampaignBrief {
  return buildCampaignBriefFromFlat(
    {
      storeId: STORE_ID,
      productName: 'Produto Teste',
      discountedPriceCents: 1990,
      badgeText: 'Oferta',
      campaignIntent: 'offer',
      productImageDataUrl: 'data:image/jpeg;base64,test',
      ...overrides,
    } as GenerateImageRequest,
    STORE_ID
  );
}

// ResolvedCampaignContext (wrapper) matching the domain brief above.
function createContext(overrides?: Partial<ResolvedCampaignContext>): ResolvedCampaignContext {
  return {
    campaignInput: {
      productName: 'Produto Teste',
      discountedPriceCents: 1990,
      productImageDataUrl: 'data:image/jpeg;base64,test',
      badgeText: 'Oferta',
      campaignIntent: 'offer',
    },
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
    const result = service.validatePrompts(brief, createContext());

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
    const result = service.validatePrompts(brief, createContext());

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
    const result = service.validatePrompts(brief, createContext());

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

    const brief = createMinimalBrief({ campaignIntent: 'spotlight' });
    const result = service.validatePrompts(brief, createContext());

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
    const result = service.validatePrompts(brief, createContext());

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

    const spotlightBrief = createMinimalBrief({ campaignIntent: 'spotlight' });
    expect(service.validatePrompts(spotlightBrief, createContext()).valid).toBe(true);

    const exclusiveBrief = createMinimalBrief({ campaignIntent: 'exclusive' });
    expect(service.validatePrompts(exclusiveBrief, createContext()).valid).toBe(true);
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
    const result = service.validatePrompts(brief, createContext());

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('{{discountedPrice}}'))).toBe(true);
  });

  it('validatePrompts propaga legalNotice (mandatoryArtworkText), campaignDetails e additionalDetails ao revisor', () => {
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
      mandatoryArtworkText: 'Imagem meramente ilustrativa',
      campaignDetails: 'Frete grátis acima de R$ 100',
      additionalDetails: 'Válido somente em loja física',
    });

    const result = service.validatePrompts(brief, createContext());
    expect(result.valid).toBe(true);

    const reviewerCall = mockLoad.mock.calls.find((call) => call[0] === 'campaign-image-reviewer');
    expect(reviewerCall).toBeDefined();
    const vars = reviewerCall![1] as Record<string, string>;
    expect(vars).toHaveProperty('mandatoryArtworkTextSection');
    expect(vars).toHaveProperty('authorizedContextSection');
    expect(vars.mandatoryArtworkTextSection).toContain('Imagem meramente ilustrativa');
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
      mandatoryArtworkText: 'Imagem meramente ilustrativa',
      campaignDetails: 'Frete grátis acima de R$ 100',
      additionalDetails: 'Válido somente em loja física',
    });

    const result = service.validatePrompts(brief, createContext());
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
    const result = service.validatePrompts(brief, createContext());
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
      mandatoryArtworkText: 'Imagem meramente ilustrativa',
      campaignDetails: 'Frete grátis acima de R$ 100',
      additionalDetails: 'Válido somente em loja física',
    });

    const result = await service.generateImage(brief, createContext());

    expect(result.success).toBe(true);
    expect(mockImageReview.review).toHaveBeenCalledTimes(1);
    const reviewInput = mockImageReview.review.mock.calls[0][1];
    expect(reviewInput.legalNoticeText).toBe('Imagem meramente ilustrativa');
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
    // Mock review: invoca o onCall interno do serviço (4º arg) com usage
    const mockImageReview = {
      review: vi.fn(async (...args: any[]) => {
        const onCall = args[3];
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
      context: createContext(),
    };
  }

  it('Teste 6: evento image_generation por tentativa com usage + durationMs (attempt 0..n)', async () => {
    const events: any[] = [];
    const { service, brief, context } = buildService();
    const result = await service.generateImage(brief, context, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);
    const genEvents = events.filter((e) => e.phase === 'image_generation' && e.usage);
    expect(genEvents.length).toBeGreaterThan(0);
    expect(genEvents[0].usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(genEvents[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 7: evento input_validation com usage quando a validação faz chamada de visão', async () => {
    const events: any[] = [];
    const { service, brief, context } = buildService();
    const result = await service.generateImage(brief, context, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);
    const validationEvents = events.filter((e) => e.phase === 'input_validation' && e.usage);
    expect(validationEvents.length).toBeGreaterThan(0);
    expect(validationEvents[0].usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(validationEvents[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 8: evento quality_review com usage por tentativa (attempt 1..n)', async () => {
    const events: any[] = [];
    const { service, brief, context } = buildService();
    const result = await service.generateImage(brief, context, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);
    const reviewEvents = events.filter((e) => e.phase === 'quality_review' && e.usage);
    expect(reviewEvents.length).toBeGreaterThan(0);
    expect(reviewEvents[0].usage).toEqual({ promptTokens: 200, completionTokens: 60, totalTokens: 260 });
    expect(reviewEvents[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 9: onMetricsEvent lançando → generateImage continua (best-effort)', async () => {
    const { service, brief, context } = buildService();
    const result = await service.generateImage(
      brief,
      context,
      undefined,
      undefined,
      () => { throw new Error('metrics boom'); }
    );
    expect(result.success).toBe(true);
  });

  it('Teste 10: sem onMetricsEvent → comportamento idêntico ao atual (compat)', async () => {
    const { service, brief, context } = buildService();
    const result = await service.generateImage(brief, context);
    expect(result.success).toBe(true);
  });

  it('Teste 11 (F38.1 anti-dupla-contagem): cada fase emite EXATAMENTE 1 evento por tentativa — sem tick de início sem usage', async () => {
    const events: any[] = [];
    const { service, brief, context } = buildService();
    const result = await service.generateImage(brief, context, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);

    // Sem eventos fantasma: nenhum evento de fase real sem usage (tick de início)
    const realPhases = ['input_validation', 'image_generation', 'quality_review'];
    const noUsagePhantom = events.filter((e) => realPhases.includes(e.phase) && !e.usage);
    expect(noUsagePhantom).toHaveLength(0);

    // Exatamente 1 evento por fase com usage real
    for (const phase of realPhases) {
      const phaseEvents = events.filter((e) => e.phase === phase);
      expect(phaseEvents).toHaveLength(1);
      expect(phaseEvents[0].usage).toBeDefined();
    }
  });

  it('Teste 12 (F38.1 anti-dupla-contagem): override na validação → NENHUM evento de input_validation (sem chamada de IA real)', async () => {
    const { service, brief, context, mockInputValidation } = buildService();
    mockInputValidation.validate.mockImplementation(async () => ({ classification: 'match', confidence: 1.0 }));

    const events: any[] = [];
    const result = await service.generateImage(brief, context, undefined, undefined, (e) => events.push(e));

    expect(result.success).toBe(true);
    const validationEvents = events.filter((e) => e.phase === 'input_validation');
    expect(validationEvents).toHaveLength(0);
  });
});

describe('ImageGenerationService — golden tests por intent (8.16/8.17/8.18, F39-15/F39-19)', () => {
  const EXPECTED_KEYS = [
    'productName', 'storeName', 'storeSegment', 'storeTone', 'brandColor',
    'originalPrice', 'discountedPrice', 'badgeText', 'hook', 'cta', 'objective',
    'campaignDetails', 'additionalDetails', 'targetChannel', 'format', 'validity',
    'availabilityNotes', 'sensitiveConstraints', 'mandatoryArtworkText',
    'identityImageUrl', 'identityDirective', 'campaignIntent', 'preserveImageDirective',
    'commercialFrame', 'brandProfileSection', 'brandColorsChosen', 'visualStyle',
    'visualTone', 'brandPersonality', 'campaignGuidelines', 'campaignBrief',
    'creativePersona', 'inferredCategory', 'hasCategoryConflict',
    'categoryConflictDirective', 'commercialRepertoire', 'inputValidationSummary',
    'creativeContextGuidance',
  ];

  function buildService() {
    const mockProvider = { name: 'test', generateImage: vi.fn() };
    const mockLoad = vi.fn((name: string) => `prompt ${name}`);
    const service = new ImageGenerationService(
      mockProvider as any,
      { load: mockLoad, clearCache: vi.fn() } as unknown as PromptLoader,
    );
    return service;
  }

  it('8.16 offer: buildPromptVariables produz o MESMO conjunto de 38 keys (regressão F39-15)', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      validity: 'válida até 31/12',
      mandatoryArtworkText: 'Imagem meramente ilustrativa',
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    const keys = Object.keys(vars).sort();
    expect(keys).toEqual([...EXPECTED_KEYS].sort());
    expect(keys).toHaveLength(38);
    expect(vars.productName).toBe('Produto Teste');
    expect(vars.discountedPrice).toContain('19,90');
    expect(vars.badgeText).toBe('Oferta');
    expect(vars.validity).toBe('válida até 31/12');
    expect(vars.mandatoryArtworkText).toBe('Imagem meramente ilustrativa');
    expect(vars.campaignIntent).toBe('offer');
  });

  it('8.16 spotlight: mesmas 38 keys, preserveImageContext não-normalizado', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      campaignIntent: 'spotlight',
      preserveImageContext: true,
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(Object.keys(vars)).toHaveLength(38);
    expect(vars.campaignIntent).toBe('spotlight');
    expect(vars.preserveImageDirective).toContain('Preservar o contexto original');
    expect(vars.validity).toBe('');
  });

  it('8.16 exclusive: mesmas 38 keys', () => {
    const service = buildService();
    const brief = createMinimalBrief({ campaignIntent: 'exclusive' });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(Object.keys(vars)).toHaveLength(38);
    expect(vars.campaignIntent).toBe('exclusive');
    expect(vars.commercialFrame).toContain('sem divulgação de preço');
  });

  it('9.3 legalNotice ausente (enabled=false) → mandatoryArtworkText vazio no prompt (spotlight e exclusive)', () => {
    const service = buildService();

    const spotlight = createMinimalBrief({ campaignIntent: 'spotlight', preserveImageContext: true });
    const spotlightVars = (service as any).buildPromptVariables(spotlight, createContext(), spotlight.product.name) as Record<string, string>;
    expect(spotlightVars.mandatoryArtworkText).toBe('');

    const exclusive = createMinimalBrief({ campaignIntent: 'exclusive' });
    const exclusiveVars = (service as any).buildPromptVariables(exclusive, createContext(), exclusive.product.name) as Record<string, string>;
    expect(exclusiveVars.mandatoryArtworkText).toBe('');
  });

  it('9.5 golden offer com novos campos preenchidos mantém 38 keys (D6)', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      validity: 'até 30/09',
      mandatoryArtworkText: 'Imagem meramente ilustrativa',
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(Object.keys(vars)).toHaveLength(38);
    expect([...EXPECTED_KEYS].sort()).toEqual(Object.keys(vars).sort());
    expect(vars.validity).toBe('até 30/09');
    expect(vars.mandatoryArtworkText).toBe('Imagem meramente ilustrativa');
  });

  it('20 (F41): golden com multi-imagem mantém o MESMO conjunto de 38 keys por intent (D6)', () => {
    const service = buildService();
    const multiBrief = (intent: 'offer' | 'spotlight' | 'exclusive') =>
      createMinimalBrief({
        campaignIntent: intent,
        productImages: [
          { role: 'primary', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,primary' },
          { role: 'reference', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux1' },
          { role: 'reference', source: 'camera', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux2' },
        ],
      });

    for (const intent of ['offer', 'spotlight', 'exclusive'] as const) {
      const brief = multiBrief(intent);
      const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;
      const keys = Object.keys(vars).sort();
      expect(keys, `intent ${intent}`).toEqual([...EXPECTED_KEYS].sort());
      expect(keys, `intent ${intent}`).toHaveLength(38);
    }
  });

  it('8.17 buildCommercialRepertoire decide por validity.enabled/displayText (sem heurística string)', () => {
    const service = buildService();
    const brief = createMinimalBrief({ validity: 'Até 30/09' });
    const repertoire = (service as any).buildCommercialRepertoire(brief) as string;
    expect(repertoire).toContain('Oferta válida: Até 30/09');

    // validity disabled/absent → sem parte de validade
    const semValidity = (service as any).buildCommercialRepertoire(createMinimalBrief()) as string;
    expect(semValidity).not.toContain('Oferta válida');
  });

  it('8.18 provider/input-validation recebem media.primary.dataUrl (ponte base64 em memória)', async () => {
    const mockProvider = {
      name: 'test',
      generateImage: vi.fn().mockResolvedValue({
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/png',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    };
    const mockLoad = vi.fn((name: string) => {
      if (name === 'campaign-image-director-offer') return 'Prompt sem placeholders';
      if (name === 'campaign-image-reviewer') return 'Revise sem placeholders';
      return '';
    });
    const mockInputValidation = { validate: vi.fn().mockResolvedValue({ classification: 'match' }) };
    const mockImageReview = {
      review: vi.fn().mockResolvedValue({ passed: true, issues: [], failureType: null }),
      buildReviewPromptVariables: vi.fn(),
    };
    const mockMetricsWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const service = new ImageGenerationService(
      mockProvider as any,
      { load: mockLoad, clearCache: vi.fn() } as unknown as PromptLoader,
      mockInputValidation as any,
      mockImageReview as any,
      mockMetricsWriter as any
    );

    const brief = createMinimalBrief();
    const result = await service.generateImage(brief, createContext());

    expect(result.success).toBe(true);
    expect(mockInputValidation.validate).toHaveBeenCalledWith(
      'Produto Teste',
      'data:image/jpeg;base64,test',
      undefined,
      expect.any(Function)
    );
    expect(mockProvider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ productImageDataUrl: 'data:image/jpeg;base64,test' })
    );
  });

  it('22 (F41): InputValidationService usa APENAS a primary com brief multi-imagem (D8)', async () => {
    const mockProvider = {
      name: 'test',
      generateImage: vi.fn().mockResolvedValue({
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/png',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    };
    const mockLoad = vi.fn((name: string) => {
      if (name === 'campaign-image-director-offer') return 'Prompt sem placeholders';
      if (name === 'campaign-image-reviewer') return 'Revise sem placeholders';
      return '';
    });
    const mockInputValidation = { validate: vi.fn().mockResolvedValue({ classification: 'match' }) };
    const mockImageReview = {
      review: vi.fn().mockResolvedValue({ passed: true, issues: [], failureType: null }),
      buildReviewPromptVariables: vi.fn(),
    };
    const mockMetricsWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const service = new ImageGenerationService(
      mockProvider as any,
      { load: mockLoad, clearCache: vi.fn() } as unknown as PromptLoader,
      mockInputValidation as any,
      mockImageReview as any,
      mockMetricsWriter as any
    );

    const primaryDataUrl = 'data:image/jpeg;base64,primary';
    const brief = createMinimalBrief({
      productImages: [
        { role: 'primary', source: 'upload', mimeType: 'image/jpeg', dataUrl: primaryDataUrl },
        { role: 'reference', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux1' },
        { role: 'reference', source: 'camera', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux2' },
      ],
    });
    const result = await service.generateImage(brief, createContext());

    expect(result.success).toBe(true);
    // D8: a validação recebe APENAS a primary (mediaImagesDataUrls(brief)[0]).
    expect(mockInputValidation.validate).toHaveBeenCalledWith(
      'Produto Teste',
      primaryDataUrl,
      undefined,
      expect.any(Function)
    );
    // D7: o provider input carrega a lista ordenada (posição 0 = primary).
    expect(mockProvider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        productImagesDataUrls: expect.arrayContaining([primaryDataUrl]),
      })
    );
  });
});
