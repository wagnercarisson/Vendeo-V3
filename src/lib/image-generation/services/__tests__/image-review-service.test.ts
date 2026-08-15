import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOpenAICreate } = vi.hoisted(() => ({ mockOpenAICreate: vi.fn() }));

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: { create: mockOpenAICreate },
    };
  },
}));

import { ImageReviewService } from '../image-review-service';
import type { ImageReviewInput } from '../image-review-service';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { AiCallInfo } from '@/lib/ai-cost/types';

describe('ImageReviewService', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: ImageReviewService;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockReturnValue('review prompt with {{expectedBadgeBehavior}}'),
      clearCache: vi.fn(),
    };
    service = new ImageReviewService(mockLoader as unknown as PromptLoader);

    vi.spyOn(service as any, 'callVisionModel').mockResolvedValue({
      content: JSON.stringify({ passed: true, issues: [] }),
      usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 },
    });
  });

  it('review() monta expectedBadgeBehavior para offer com badge', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      discountedPrice: 'R$ 19,90',
      badgeText: 'Oferta Imperdível',
      campaignIntent: 'offer',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    expect(mockLoader.load).toHaveBeenCalledWith(
      'campaign-image-reviewer',
      expect.objectContaining({
        expectedBadgeBehavior: expect.stringContaining('DEVE exibir badge promocional'),
      })
    );
  });

  it('review() monta expectedBadgeBehavior para exclusive sem badge', async () => {
    const input = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'exclusive' as const,
    } as ImageReviewInput;

    await service.review('data:image/jpeg;base64,abc', input);

    expect(mockLoader.load).toHaveBeenCalledWith(
      'campaign-image-reviewer',
      expect.objectContaining({
        expectedBadgeBehavior: expect.stringContaining('Nenhum badge foi informado'),
      })
    );
  });

  it('review() monta expectedPriceBehavior para exclusive sem preço', async () => {
    const input = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'exclusive' as const,
      preserveImageContext: true,
    } as ImageReviewInput;

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.expectedPriceBehavior).toContain('NÃO deve exibir preço');
    expect(vars.campaignIntentLabel).toBe('Exclusivo');
    expect(vars.expectedImageTreatment).toContain('preservado');
    expect(vars.expectedCommercialTone).toContain('premium');
  });

  it('review() NUNCA passa {{discountedPrice}} ou {{badgeText}} nas variáveis', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      badgeText: 'Promoção',
      discountedPrice: 'R$ 29,90',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    for (const [key, value] of Object.entries(vars)) {
      expect(value).not.toContain('{{');
    }
    expect(vars).not.toHaveProperty('discountedPrice');
    expect(vars).not.toHaveProperty('badgeText');
  });

  it('parseResult reconhece empty_review como resultado estruturado', async () => {
    const raw = JSON.stringify({
      passed: false,
      failureType: "empty_review",
      issues: [{ type: "empty_review", severity: "critical", description: "O modelo de revisão não retornou conteúdo." }],
    });
    const result = (service as any).parseResult(raw);
    expect(result.passed).toBe(false);
    expect(result.failureType).toBe('empty_review');
    expect(result.issues[0].type).toBe('empty_review');
  });

  it('review() monta expectedPriceBehavior para offer com preço', async () => {
    const input: ImageReviewInput = {
      productName: 'Bolo de Cenoura',
      storeName: 'Padaria Pão & Cia',
      campaignIntent: 'offer',
      discountedPrice: 'R$ 29,90',
      badgeText: 'Promoção',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.expectedPriceBehavior).toContain('R$ 29,90');
    expect(vars.expectedPriceBehavior).not.toContain('{{');
    expect(vars.expectedBadgeBehavior).toContain('DEVE exibir badge promocional');
    expect(vars.campaignIntentLabel).toBe('Promoção');
  });

  it('review() monta expectedPriceBehavior para spotlight com preço único', async () => {
    const input: ImageReviewInput = {
      productName: 'Vestido Floral',
      storeName: 'Moda & Estilo',
      campaignIntent: 'spotlight',
      discountedPrice: 'R$ 149,90',
      badgeText: 'Novidade',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.expectedPriceBehavior).toContain('preço único');
    expect(vars.expectedPriceBehavior).toContain('R$ 149,90');
    expect(vars.campaignIntentLabel).toBe('Destaque');
    expect(vars.expectedCommercialTone).toContain('aspiracional');
  });

  it('review() monta expectedImageTreatment por intent + preserveImageContext', async () => {
    const offerClean: ImageReviewInput = { productName: 'P', storeName: 'L', campaignIntent: 'offer', preserveImageContext: false };
    await service.review('data:image/jpeg;base64,a', offerClean);
    expect(mockLoader.load.mock.calls[0][1].expectedImageTreatment).toContain('isolar o produto em fundo comercial');

    mockLoader.load.mockClear();
    const spotlightCtx: ImageReviewInput = { productName: 'P', storeName: 'L', campaignIntent: 'spotlight', preserveImageContext: true };
    await service.review('data:image/jpeg;base64,a', spotlightCtx);
    expect(mockLoader.load.mock.calls[0][1].expectedImageTreatment).toContain('fundo contextual DA IMAGEM DEVE ser preservado');

    mockLoader.load.mockClear();
    const exclusiveNeutral: ImageReviewInput = { productName: 'P', storeName: 'L', campaignIntent: 'exclusive' };
    await service.review('data:image/jpeg;base64,a', exclusiveNeutral);
    expect(mockLoader.load.mock.calls[0][1].expectedImageTreatment).toContain('não é obrigatório nem proibido');
  });

  it('review() — regressão offer com comportamento equivalente ao anterior', async () => {
    const input: ImageReviewInput = {
      productName: 'Regressão Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      discountedPrice: 'R$ 29,90',
      badgeText: 'Promoção',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.campaignIntentLabel).toBe('Promoção');
    expect(vars.expectedBadgeBehavior).toContain('DEVE exibir badge promocional');
    expect(vars.expectedPriceBehavior).toContain('R$ 29,90');
  });

  it('review() gera mandatoryArtworkTextSection com fidelidade semantica e rigor legal', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      legalNoticeText: 'Imagem meramente ilustrativa',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.mandatoryArtworkTextSection).toContain('Imagem meramente ilustrativa');
    expect(vars.mandatoryArtworkTextSection).toMatch(/conteudo essencial/i);
    expect(vars.mandatoryArtworkTextSection).toMatch(/Nao reprove apenas/i);
    expect(vars.mandatoryArtworkTextSection).toMatch(/quebra de linha/i);
    expect(vars.mandatoryArtworkTextSection).toMatch(/aviso legal ou regulatorio/i);
    expect(vars.mandatoryArtworkTextSection).toMatch(/CRITICA/i);
  });

  it('review() gera authorizedContextSection com campaignDetails e additionalDetails', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      campaignDetails: 'Frete grátis acima de R$ 100',
      additionalDetails: 'Válido somente em loja física',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.authorizedContextSection).toContain('Frete grátis acima de R$ 100');
    expect(vars.authorizedContextSection).toContain('Válido somente em loja física');
    expect(vars.authorizedContextSection).toMatch(/AUTORIZAD/i);
    expect(vars.authorizedContextSection).not.toContain('{{');
  });

  it('review() sem mandatoryArtworkText não exige texto obrigatório', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].mandatoryArtworkTextSection).toBe('');

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,abc', {
      ...input,
      legalNoticeText: '   ',
    });
    expect(mockLoader.load.mock.calls[0][1].mandatoryArtworkTextSection).toBe('');
  });

  it('review() sem campaignDetails/additionalDetails gera authorizedContextSection vazia', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].authorizedContextSection).toBe('');
  });

  it('8.20 legalNotice desabilitado (legalNoticeText ausente) → sem seção de aviso', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].mandatoryArtworkTextSection).toBe('');
  });

  it('8.20 legalNotice habilitado (legalNoticeText presente) → seção de aviso no review', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      legalNoticeText: 'Imagem meramente ilustrativa',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].mandatoryArtworkTextSection).toContain('Imagem meramente ilustrativa');
  });

  it('8.20 validityText propagado quando habilitado (nova seção de validade)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      validityText: 'Até 30/09',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.validityTextSection).toContain('Até 30/09');
  });

  it('8.20 validityText ausente → validade não entra no review', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].validityTextSection).toBe('');
  });

  it('review() sanitiza placeholders em valores de entrada', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      legalNoticeText: 'Oferta {{imperdível}}',
      campaignDetails: 'Promoção {{válida}} até domingo',
      additionalDetails: 'Condições {{sujeitas}} a consulta',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    for (const value of Object.values(vars)) {
      expect(value).not.toContain('{{');
      expect(value).not.toContain('}}');
    }
    expect(vars.mandatoryArtworkTextSection).toContain('Oferta {imperdível}');
  });
});

describe('ImageReviewService — onCall (D11)', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: ImageReviewService;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockReturnValue('review prompt'),
      clearCache: vi.fn(),
    };
    service = new ImageReviewService(mockLoader as unknown as PromptLoader, 'gpt-4o-test');
    mockOpenAICreate.mockReset();
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ passed: true, issues: [] }) } }],
      usage: { prompt_tokens: 200, completion_tokens: 60, total_tokens: 260 },
    });
  });

  it('Teste 4: review com usage mockado → onCall com usage + durationMs', async () => {
    const onCall = vi.fn();
    const result = await service.review(
      'data:image/jpeg;base64,abc',
      { productName: 'Produto', storeName: 'Loja' },
      undefined,
      onCall
    );
    expect(result.passed).toBe(true);
    expect(onCall).toHaveBeenCalledTimes(1);
    const info: AiCallInfo = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o-test');
    expect(info.usage).toEqual({ promptTokens: 200, completionTokens: 60, totalTokens: 260 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 5: sem onCall (undefined) → comportamento idêntico ao atual', async () => {
    const result = await service.review(
      'data:image/jpeg;base64,abc',
      { productName: 'Produto', storeName: 'Loja' }
    );
    expect(result.passed).toBe(true);
  });
});
