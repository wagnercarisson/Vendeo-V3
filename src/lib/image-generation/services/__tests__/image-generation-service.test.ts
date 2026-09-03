import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGenerationService } from '../image-generation-service';
import type { CampaignBrief } from '@/lib/campaign/brief';
import { buildCampaignBriefFromFlat } from '@/lib/campaign/brief';
import type { ResolvedCampaignContext } from '@/components/campaign/types';
import type { GenerateImageRequest } from '@/lib/image-generation/schema';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import { ILLUSTRATIVE_NOTICE_TEXT } from '@/lib/campaign/constants';

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

  it('validatePrompts com PromptLoader REAL: offer completo e offer mínimo sem placeholders residuais (D4/F45-11)', () => {
    const realService = new ImageGenerationService(mockProvider as any);

    const completeBrief = createMinimalBrief({
      validity: 'até 30/09/2026',
      mandatoryArtworkText: `${ILLUSTRATIVE_NOTICE_TEXT}\nTexto promocional`,
      campaignDetails: '[Queima de estoque] Aproveite',
      additionalDetails: 'Válido somente em loja física',
      availabilityNotes: 'Restam poucas unidades',
      sensitiveConstraints: 'Não exibir modelo sem camisa',
      hook: 'Oferta imperdível',
      cta: 'Garanta já o seu',
      objective: 'Vender mais',
      targetChannel: 'Instagram',
      format: 'quadrado 1:1',
      productImages: [
        { role: 'primary', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,primary' },
        { role: 'reference', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux1' },
      ],
    });

    const completeResult = realService.validatePrompts(completeBrief, createContext());
    expect(completeResult.valid).toBe(true);
    expect(completeResult.errors).toHaveLength(0);

    const minimalBrief = createMinimalBrief();
    const minimalResult = realService.validatePrompts(minimalBrief, createContext());
    expect(minimalResult.valid).toBe(true);
    expect(minimalResult.errors).toHaveLength(0);
  });

  it('validatePrompts com PromptLoader REAL: spotlight (preço único, preserveImageContext, sem validade/texto obrigatório) sem placeholders residuais (D4)', () => {
    const realService = new ImageGenerationService(mockProvider as any);

    const spotlightBrief = createMinimalBrief({
      campaignIntent: 'spotlight',
      preserveImageContext: true,
      hook: 'Novidade na loja',
      cta: 'Venha conferir',
    });
    const result = realService.validatePrompts(spotlightBrief, createContext());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validatePrompts com PromptLoader REAL: exclusive (sem preço, sem badge) sem placeholders residuais (D4)', () => {
    const realService = new ImageGenerationService(mockProvider as any);

    const exclusiveBrief = createMinimalBrief({
      campaignIntent: 'exclusive',
      discountedPriceCents: undefined,
      badgeText: undefined,
      preserveImageContext: true,
    });
    const result = realService.validatePrompts(exclusiveBrief, createContext());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
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

  it('Teste 23 (F43): override → fase input_validation emitida obrigatoriamente skipped, sem chamada real e sem complete falso', async () => {
    const { service, brief, context, mockInputValidation } = buildService();
    // Sem chamada de IA real: validate retorna match SEM invocar onCall (usage)
    mockInputValidation.validate.mockImplementation(async () => ({ classification: 'match', confidence: 1.0 }));

    for (const literal of ['brief_review_confirmed', 'user_confirmed_continue'] as const) {
      const ctx = createContext({
        campaignInput: {
          ...context.campaignInput,
          inputValidationOverride: { productImageCheck: literal },
        },
      });

      const phaseEvents: any[] = [];
      const metricsEvents: any[] = [];
      const res = await service.generateImage(
        brief,
        ctx,
        (e) => phaseEvents.push(e),
        undefined,
        (e) => metricsEvents.push(e)
      );

      expect(res.success).toBe(true);

      // Fase emitida como skipped — nunca running → complete
      const validationPhases = phaseEvents.filter((e) => e.phase === 'input_validation');
      expect(validationPhases.length).toBeGreaterThan(0);
      for (const ev of validationPhases) {
        expect(ev.status).toBe('skipped');
      }
      expect(validationPhases.some((e) => e.status === 'complete')).toBe(false);
      expect(validationPhases.some((e) => e.status === 'running')).toBe(false);

      // Sem chamada de IA real → sem evento de métrica input_validation
      const validationMetrics = metricsEvents.filter((e) => e.phase === 'input_validation');
      expect(validationMetrics).toHaveLength(0);
    }
  });
});

describe('ImageGenerationService — golden tests por intent (8.16/8.17/8.18, F39-15/F39-19)', () => {
  // Conjunto FINAL do mapa compartilhado (45-04 D5): chaves realmente consumidas
  // pelos 4 templates reescritos (8 slots contextuais + prosa garantida
  // productName/storeName/brandColor) + campaignIntent (orquestração). Chaves
  // legadas da transição (45-03) removidas — nenhum template as interpola mais.
  const EXPECTED_KEYS = [
    'campaignFactsSection', 'commercialDetailsSection', 'requiredArtworkTextSection',
    'illustrativeNoticeSection', 'identityReferenceSection', 'productReferenceSection',
    'constraintsSection', 'creativeDirectionSection',
    'productName', 'storeName', 'brandColor', 'campaignIntent',
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

  it('8.16 offer: buildPromptVariables produz o conjunto final (regressão F39-15)', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      validity: 'válida até 31/12',
      mandatoryArtworkText: 'Imagem meramente ilustrativa',
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    const keys = Object.keys(vars).sort();
    expect(keys).toEqual([...EXPECTED_KEYS].sort());
    expect(keys).toHaveLength(EXPECTED_KEYS.length);
    expect(vars.productName).toBe('Produto Teste');
    // Preço e badge legados saíram do Record — vivem nos fatos (D3/D5).
    expect(vars).not.toHaveProperty('discountedPrice');
    expect(vars).not.toHaveProperty('badgeText');
    expect(vars.campaignFactsSection).toContain('**Preço com desconto:**');
    expect(vars.campaignFactsSection).toContain('19,90');
    expect(vars.campaignFactsSection).toContain('**Badge:** Oferta');
    // Validade repartida: vive apenas no bloco de fatos (D3), não mais em chave própria.
    expect(vars).not.toHaveProperty('validity');
    expect(vars.campaignFactsSection).toContain('**Validade da oferta:** válida até 31/12');
    expect(vars.campaignFactsSection).toContain('19,90');
    expect(vars.commercialDetailsSection).not.toContain('válida até 31/12');
    expect(vars.creativeDirectionSection).not.toContain('válida até 31/12');
    // Aviso marcado SEM texto livre → aviso isolado na seção própria (split caso 1);
    // sem texto obrigatório → requiredArtworkTextSection vazia.
    expect(vars.requiredArtworkTextSection).toBe('');
    expect(vars.illustrativeNoticeSection).toContain(ILLUSTRATIVE_NOTICE_TEXT);
    expect(vars.campaignIntent).toBe('offer');
  });

  it('8.16 spotlight: mesmas chaves finais, preserveImageContext → diretiva no bloco de produto', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      campaignIntent: 'spotlight',
      preserveImageContext: true,
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(Object.keys(vars)).toHaveLength(EXPECTED_KEYS.length);
    expect(vars.campaignIntent).toBe('spotlight');
    // preserveImageDirective legada saiu do Record; a regra de não-recorte vive no
    // bloco productReferenceSection (não-offer + preserveImageContext — D3).
    expect(vars).not.toHaveProperty('preserveImageDirective');
    expect(vars.productReferenceSection).toContain('Preservar o contexto original');
    // Spotlight: preço ÚNICO nos fatos (sem DE/POR), sem validade.
    expect(vars.campaignFactsSection).toContain('**Preço:**');
    expect(vars.campaignFactsSection).toContain('19,90');
    expect(vars.campaignFactsSection).not.toContain('Preço com desconto');
    expect(vars.campaignFactsSection).not.toContain('Validade da oferta');
    expect(vars).not.toHaveProperty('validity');
  });

  it('8.16 exclusive: mesmas chaves finais, facts NUNCA montam preço (DNA sem preço)', () => {
    const service = buildService();
    // Domínio ainda carrega preço (rota limpa em produção) → facts não podem exibi-lo.
    const brief = createMinimalBrief({ campaignIntent: 'exclusive', discountedPriceCents: 9900 });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(Object.keys(vars)).toHaveLength(EXPECTED_KEYS.length);
    expect(vars.campaignIntent).toBe('exclusive');
    expect(vars).not.toHaveProperty('commercialFrame');
    expect(vars).not.toHaveProperty('discountedPrice');
    expect(vars.productReferenceSection).not.toContain('Preservar o contexto original');
    expect(vars.campaignFactsSection).not.toContain('Preço');
    expect(vars.campaignFactsSection).not.toContain('99,00');
  });

  it('9.3 legalNotice ausente (enabled=false) → seções de texto obrigatório e aviso vazias (spotlight e exclusive)', () => {
    const service = buildService();

    const spotlight = createMinimalBrief({ campaignIntent: 'spotlight', preserveImageContext: true });
    const spotlightVars = (service as any).buildPromptVariables(spotlight, createContext(), spotlight.product.name) as Record<string, string>;
    expect(spotlightVars.requiredArtworkTextSection).toBe('');
    expect(spotlightVars.illustrativeNoticeSection).toBe('');

    const exclusive = createMinimalBrief({ campaignIntent: 'exclusive' });
    const exclusiveVars = (service as any).buildPromptVariables(exclusive, createContext(), exclusive.product.name) as Record<string, string>;
    expect(exclusiveVars.requiredArtworkTextSection).toBe('');
    expect(exclusiveVars.illustrativeNoticeSection).toBe('');
  });

  it('9.5 golden offer com novos campos preenchidos mantém o conjunto final (D6)', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      validity: 'até 30/09',
      mandatoryArtworkText: 'Imagem meramente ilustrativa',
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(Object.keys(vars)).toHaveLength(EXPECTED_KEYS.length);
    expect([...EXPECTED_KEYS].sort()).toEqual(Object.keys(vars).sort());
    expect(vars.campaignFactsSection).toContain('**Validade da oferta:** até 30/09');
    // Aviso marcado SEM texto livre → aviso isolado na seção própria (split caso 1);
    // sem texto livre → requiredArtworkTextSection vazia (chaves legadas removidas).
    expect(vars).not.toHaveProperty('mandatoryArtworkText');
    expect(vars.requiredArtworkTextSection).toBe('');
    expect(vars.illustrativeNoticeSection).toContain(ILLUSTRATIVE_NOTICE_TEXT);
  });

  it('20 (F41): golden com multi-imagem mantém o MESMO conjunto final por intent (D6)', () => {
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
      expect(keys, `intent ${intent}`).toHaveLength(EXPECTED_KEYS.length);
      // Hierarquia 1+N: bloco de produto presente com 2+ imagens em todos os intents.
      expect(vars.productReferenceSection, `intent ${intent}`).toContain('apoio comercial real da composição');
    }
  });

  it('260902-kqo (a): aviso + texto livre → seções próprias (só texto do lojista / aviso canônico)', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      mandatoryArtworkText: `${ILLUSTRATIVE_NOTICE_TEXT}\nTexto promocional`,
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(vars).not.toHaveProperty('mandatoryArtworkText');
    expect(vars).not.toHaveProperty('illustrativeNotice');
    expect(vars.requiredArtworkTextSection).toContain('Texto promocional');
    expect(vars.requiredArtworkTextSection).not.toContain(ILLUSTRATIVE_NOTICE_TEXT);
    expect(vars.illustrativeNoticeSection).toContain(ILLUSTRATIVE_NOTICE_TEXT);
    expect(vars.illustrativeNoticeSection).not.toContain('Texto promocional');
  });

  it('260902-kqo (b): texto livre apenas (checkbox desmarcado/legado) → requiredArtworkTextSection integral, sem aviso', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      mandatoryArtworkText: 'Texto promocional',
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(vars.requiredArtworkTextSection).toContain('Texto promocional');
    expect(vars.illustrativeNoticeSection).toBe('');
  });

  it('260902-kqo (c): texto legado que começa com a constante mas SEM quebra de linha → free-only integral (comportamento atual preservado)', () => {
    const service = buildService();
    const brief = createMinimalBrief({
      mandatoryArtworkText: 'Imagem meramente ilustrativa de produtos',
    });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(vars.requiredArtworkTextSection).toContain('Imagem meramente ilustrativa de produtos');
    expect(vars.illustrativeNoticeSection).toBe('');
  });

  it('8.17 validade em ocorrência ÚNICA em campaignFactsSection (repartição D3 do repertório)', () => {
    const service = buildService();
    const brief = createMinimalBrief({ validity: 'Até 30/09' });
    const vars = (service as any).buildPromptVariables(brief, createContext(), brief.product.name) as Record<string, string>;

    expect(vars.campaignFactsSection).toContain('**Validade da oferta:** Até 30/09');
    // Repartição: validade NÃO é reintroduzida no contexto comercial nem na direção criativa.
    expect(vars.commercialDetailsSection).not.toContain('Até 30/09');
    expect(vars.creativeDirectionSection).not.toContain('Até 30/09');

    // validity disabled/absent → sem parte de validade nos fatos
    const semValidityBrief = createMinimalBrief();
    const semValidity = (service as any).buildPromptVariables(semValidityBrief, createContext(), semValidityBrief.product.name) as Record<string, string>;
    expect(semValidity.campaignFactsSection).not.toContain('Validade da oferta');
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

  it('8 (quick 260820-pl1): review recebe referenceImageDataUrls = [primary, aux1, aux2] com brief multi-imagem (ordem preservada)', async () => {
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

    const brief = createMinimalBrief({
      productImages: [
        { role: 'primary', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,primary' },
        { role: 'reference', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux1' },
        { role: 'reference', source: 'camera', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux2' },
      ],
    });

    const result = await service.generateImage(brief, createContext());

    expect(result.success).toBe(true);
    expect(mockImageReview.review).toHaveBeenCalledTimes(1);
    // 3º argumento do review = referenceImageDataUrls na ordem primary-first.
    expect(mockImageReview.review.mock.calls[0][2]).toEqual([
      'data:image/jpeg;base64,primary',
      'data:image/jpeg;base64,aux1',
      'data:image/jpeg;base64,aux2',
    ]);
  });

  it('9 (quick 260820-pl1): brief legado (1 imagem) → review recebe [primary]', async () => {
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

    const brief = createMinimalBrief(); // productImageDataUrl 'data:image/jpeg;base64,test'

    const result = await service.generateImage(brief, createContext());

    expect(result.success).toBe(true);
    expect(mockImageReview.review).toHaveBeenCalledTimes(1);
    expect(mockImageReview.review.mock.calls[0][2]).toEqual(['data:image/jpeg;base64,test']);
  });
});
