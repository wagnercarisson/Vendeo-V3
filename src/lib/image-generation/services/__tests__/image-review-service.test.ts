import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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
import { ILLUSTRATIVE_NOTICE_TEXT } from '@/lib/campaign/constants';

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

  it('review() gera requiredArtworkTextSection com valor e natureza (sem politica embutida)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      requiredArtworkText: 'Imagem meramente ilustrativa',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.requiredArtworkTextSection).toContain('"Imagem meramente ilustrativa"');
    expect(vars.requiredArtworkTextSection).toContain('## Texto Obrigatório na Arte');
    // Sem politica de julgamento embutida (vive no .md — Task 6).
    expect(vars.requiredArtworkTextSection).not.toMatch(/reprove|CRITICA|conteudo essencial|aviso legal ou regulatorio/i);
    expect(vars.illustrativeNoticeSection).toBe('');
    expect(vars).not.toHaveProperty('mandatoryArtworkTextSection');
    expect(vars).not.toHaveProperty('legalNoticeText');
  });

  it('review() — texto obrigatorio sozinho nao gera secao de aviso (prova 45-08 #2)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      requiredArtworkText: 'Texto promocional livre',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.requiredArtworkTextSection).toContain('"Texto promocional livre"');
    expect(vars.illustrativeNoticeSection).toBe('');
  });

  it('review() — aviso somente: recebe APENAS secao de aviso, sem texto obrigatorio (prova 45-08 #1)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT,
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.illustrativeNoticeSection).toContain('"Imagem meramente ilustrativa"');
    expect(vars.illustrativeNoticeSection).toContain('## Aviso Ilustrativo');
    expect(vars.requiredArtworkTextSection).toBe('');
    // Sem regra de posicao/lateral e sem tratar aviso como parte de outro texto legal.
    expect(vars.illustrativeNoticeSection).not.toMatch(/lateral|posi|outro texto|legal|parte de/i);
  });

  it('review() — ambos: duas secoes independentes, sem concatenacao (provas 45-08 #3/#4)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      requiredArtworkText: 'Texto promocional livre',
      illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT,
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.requiredArtworkTextSection).toContain('"Texto promocional livre"');
    expect(vars.illustrativeNoticeSection).toContain('"Imagem meramente ilustrativa"');
    // Seccoes independentes: conteudo distinto, sem concatenacao de um no outro.
    expect(vars.requiredArtworkTextSection).not.toContain(ILLUSTRATIVE_NOTICE_TEXT);
    expect(vars.illustrativeNoticeSection).not.toContain('Texto promocional livre');
    expect(vars.requiredArtworkTextSection).toContain('## Texto Obrigatório na Arte');
    expect(vars.illustrativeNoticeSection).toContain('## Aviso Ilustrativo');
    // Nenhum valor concatena os dois textos num bloco unico.
    expect(vars.requiredArtworkTextSection + vars.illustrativeNoticeSection).not.toMatch(
      /Texto promocional livre[^\n]*Imagem meramente ilustrativa/
    );
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

  it('review() sem requiredArtworkText/illustrativeNotice não exige texto obrigatório nem aviso', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].requiredArtworkTextSection).toBe('');
    expect(mockLoader.load.mock.calls[0][1].illustrativeNoticeSection).toBe('');

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,abc', {
      ...input,
      requiredArtworkText: '   ',
      illustrativeNotice: '   ',
    });
    expect(mockLoader.load.mock.calls[0][1].requiredArtworkTextSection).toBe('');
    expect(mockLoader.load.mock.calls[0][1].illustrativeNoticeSection).toBe('');
  });

  it('review() sem campaignDetails/additionalDetails gera authorizedContextSection vazia', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].authorizedContextSection).toBe('');
  });

  it('8.20 legalNotice desabilitado (campos ausentes) → sem seções de texto obrigatório/aviso', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].requiredArtworkTextSection).toBe('');
    expect(mockLoader.load.mock.calls[0][1].illustrativeNoticeSection).toBe('');
  });

  it('8.20 legalNotice habilitado com texto livre → seção obrigatória no review (split caso 3)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      requiredArtworkText: 'Imagem meramente ilustrativa',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].requiredArtworkTextSection).toContain('Imagem meramente ilustrativa');
    expect(mockLoader.load.mock.calls[0][1].illustrativeNoticeSection).toBe('');
  });

  it('8.20 legalNotice habilitado com aviso puro → seção de aviso no review (split caso 1)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT,
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].illustrativeNoticeSection).toContain(ILLUSTRATIVE_NOTICE_TEXT);
    expect(mockLoader.load.mock.calls[0][1].requiredArtworkTextSection).toBe('');
  });

  it('8.20 validityText propagado quando habilitado (nova seção de validade)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      validityText: 'Até 30/09/2026',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.validityTextSection).toContain('Até 30/09/2026');
  });

  it('8.20b validade com data exige fidelidade de dia/mês/ano (dd/mm/aaaa)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      validityText: 'até 30/09/2026',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.validityTextSection).toContain('até 30/09/2026');
    expect(vars.validityTextSection).toMatch(/dd\/mm\/aaaa/i);
    expect(vars.validityTextSection).toMatch(/dia, mes e ano/i);
    expect(vars.validityTextSection).toMatch(/CRITICA/i);
    expect(vars.validityTextSection).toMatch(/illegible_text/i);
  });

  it('8.20c validade vazia → seção vazia (regressão)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      validityText: '   ',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].validityTextSection).toBe('');
  });

  it('8.20d sanitização mantida na seção de validade (sem {{ )', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      validityText: 'até {{30/09/2026}}',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    expect(vars.validityTextSection).not.toContain('{{');
    expect(vars.validityTextSection).not.toContain('}}');
    expect(vars.validityTextSection).toContain('até {30/09/2026}');
  });

  it('8.20 validityText ausente → validade não entra no review', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };

    await service.review('data:image/jpeg;base64,abc', input);
    expect(mockLoader.load.mock.calls[0][1].validityTextSection).toBe('');
  });

  it('review() sanitiza placeholders em valores de entrada (requiredArtworkText/illustrativeNotice)', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      requiredArtworkText: 'Oferta {{imperdível}}',
      illustrativeNotice: 'Aviso {{ilustrativo}}',
      campaignDetails: 'Promoção {{válida}} até domingo',
      additionalDetails: 'Condições {{sujeitas}} a consulta',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    const vars = mockLoader.load.mock.calls[0][1];
    for (const value of Object.values(vars)) {
      expect(value).not.toContain('{{');
      expect(value).not.toContain('}}');
    }
    expect(vars.requiredArtworkTextSection).toContain('Oferta {imperdível}');
    expect(vars.illustrativeNoticeSection).toContain('Aviso {ilustrativo}');
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

  it('23 (F41 D9): review com 1 referência → prompt ganha a linha fixa singular e callVisionModel recebe 2 imagens', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
    };
    const primaryDataUrl = 'data:image/jpeg;base64,primary';

    const callSpy = vi.spyOn(service as any, 'callVisionModel').mockResolvedValue({
      content: JSON.stringify({ passed: true, issues: [] }),
      usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 },
    });

    await service.review('data:image/jpeg;base64,gen', input, [primaryDataUrl]);

    // A linha fixa entra no prompt carregado (D9).
    expect(mockLoader.load).toHaveBeenCalledWith(
      'campaign-image-reviewer',
      expect.objectContaining({ productName: 'Produto Teste' })
    );
    const loadedPrompt = mockLoader.load.mock.calls[0][0] === 'campaign-image-reviewer' ? mockLoader.load.mock.results[0].value : '';
    expect(loadedPrompt + '\n\nCompare o produto da arte com a imagem de referência.').toContain(
      'Compare o produto da arte com a imagem de referência.'
    );
    // callVisionModel recebe o prompt com a linha fixa + a referência como 2ª imagem.
    expect(callSpy).toHaveBeenCalledWith(
      expect.stringContaining('Compare o produto da arte com a imagem de referência.'),
      'data:image/jpeg;base64,gen',
      [primaryDataUrl]
    );
  });

  it('23b (F41 D9): sem referências (3º arg) → comportamento atual (sem linha fixa, sem imagem extra)', async () => {
    const callSpy = vi.spyOn(service as any, 'callVisionModel').mockResolvedValue({
      content: JSON.stringify({ passed: true, issues: [] }),
      usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 },
    });

    await service.review(
      'data:image/jpeg;base64,gen',
      { productName: 'Produto', storeName: 'Loja' }
    );

    expect(callSpy).toHaveBeenCalledWith(
      expect.not.stringContaining('Compare o produto da arte'),
      'data:image/jpeg;base64,gen',
      []
    );
  });
});

describe('ImageReviewService — multi-referências autorizadas (quick 260820-pl1)', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: ImageReviewService;

  // Loader que interpola {{placeholders}} como o PromptLoader real, para que o
  // "prompt final" (o que vai ao callVisionModel) contenha a seção interpolada.
  function interpolatingLoader() {
    return {
      load: vi.fn((name: string, vars?: Record<string, string>) => {
        let content = 'review prompt\n\n{{referenceImagesContextSection}}';
        if (vars) {
          for (const [key, value] of Object.entries(vars)) {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          }
        }
        return content;
      }),
      clearCache: vi.fn(),
    };
  }

  const primary = 'data:image/jpeg;base64,primary';
  const aux1 = 'data:image/jpeg;base64,aux1';
  const aux2 = 'data:image/jpeg;base64,aux2';

  function mockCall() {
    return vi.spyOn(service as any, 'callVisionModel').mockResolvedValue({
      content: JSON.stringify({ passed: true, issues: [] }),
      usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 },
    });
  }

  beforeEach(() => {
    mockLoader = interpolatingLoader();
    service = new ImageReviewService(mockLoader as unknown as PromptLoader);
  });

  it('1: review() com 3 referências → callVisionModel recebe [generated, primary, aux1, aux2] em ordem', async () => {
    const callSpy = mockCall();

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary, aux1, aux2]);

    expect(callSpy).toHaveBeenCalledWith(
      expect.any(String),
      'data:image/jpeg;base64,gen',
      [primary, aux1, aux2]
    );
  });

  it('2: prompt final contém a regra — imagem adicional AUTORIZADA e produto fora das referências = invented_information', async () => {
    const callSpy = mockCall();

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary, aux1]);

    const finalPrompt = callSpy.mock.calls[0][0] as string;
    expect(finalPrompt).toContain('Referências Autorizadas da Campanha');
    expect(finalPrompt).toMatch(/referências autorizadas de apoio, variação, combo ou ângulo/);
    expect(finalPrompt).toMatch(/não trate como invenção um item visível em qualquer referência/i);
    expect(finalPrompt).toMatch(/invenção CRÍTICA \(invented_information\)/i);
  });

  it('3: sem referências (arg undefined) → sem seção, sem imagens extras (regressão 23b F41)', async () => {
    const callSpy = mockCall();

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' });

    expect(callSpy).toHaveBeenCalledWith(expect.any(String), 'data:image/jpeg;base64,gen', []);
    const finalPrompt = callSpy.mock.calls[0][0] as string;
    expect(finalPrompt).not.toContain('Referências Autorizadas');
    expect(mockLoader.load.mock.calls[0][1].referenceImagesContextSection).toBe('');
  });

  it('4: 1 referência → linha fixa singular + 2 imagens (regressão 23 F41)', async () => {
    const callSpy = mockCall();

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary]);

    expect(callSpy).toHaveBeenCalledWith(
      expect.stringContaining('Compare o produto da arte com a imagem de referência.'),
      'data:image/jpeg;base64,gen',
      [primary]
    );
    expect(mockLoader.load.mock.calls[0][1].referenceImagesContextSection).toBe('');
  });

  it('5: 2+ referências → linha fixa plural "as imagens de referência autorizadas"', async () => {
    const callSpy = mockCall();

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary, aux1]);

    expect(callSpy).toHaveBeenCalledWith(
      expect.stringContaining('Compare o produto da arte com as imagens de referência autorizadas.'),
      'data:image/jpeg;base64,gen',
      [primary, aux1]
    );
  });

  it('6: referenceImagesContextSection vazia para count <= 1', async () => {
    mockCall();

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' });
    expect(mockLoader.load.mock.calls[0][1].referenceImagesContextSection).toBe('');

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary]);
    expect(mockLoader.load.mock.calls[0][1].referenceImagesContextSection).toBe('');

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary, aux1]);
    expect(mockLoader.load.mock.calls[0][1].referenceImagesContextSection).not.toBe('');
  });

  it('7: proteção/hierarquia — seção afirma invenção crítica fora de todas as referências e primeira imagem = referência principal', async () => {
    mockCall();

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary, aux1]);

    const section = mockLoader.load.mock.calls[0][1].referenceImagesContextSection as string;
    expect(section).toMatch(/primeira imagem é a referência principal do produto anunciado/);
    expect(section).toMatch(/não deve ser substituído por uma referência adicional/);
    expect(section).toMatch(/ausente de TODAS as referências/);
    expect(section).toMatch(/invenção CRÍTICA/i);
  });

  it('1b: callVisionModel monta blocos image_url na ordem gerada → primary → aux1 → aux2', async () => {
    // Caminho real do callVisionModel (mockOpenAICreate) — sem modelo real.
    const callSpy = vi.spyOn(service as any, 'callVisionModel');
    mockOpenAICreate.mockReset();
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ passed: true, issues: [] }) } }],
      usage: { prompt_tokens: 200, completion_tokens: 60, total_tokens: 260 },
    });

    await service.review('data:image/jpeg;base64,gen', { productName: 'P', storeName: 'L' }, [primary, aux1, aux2]);

    expect(callSpy).toHaveBeenCalled();
    const createArgs = mockOpenAICreate.mock.calls[0][0];
    const content = createArgs.messages[0].content;
    const imageUrls = content
      .filter((b: { type: string }) => b.type === 'image_url')
      .map((b: { image_url: { url: string } }) => b.image_url.url);
    expect(imageUrls).toEqual(['data:image/jpeg;base64,gen', primary, aux1, aux2]);
  });
});

describe('ImageReviewService — provas 45-08 (contrato splitado Diretor × Revisor)', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: ImageReviewService;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockReturnValue('review prompt with {{expectedBadgeBehavior}}'),
      clearCache: vi.fn(),
    };
    service = new ImageReviewService(mockLoader as unknown as PromptLoader);
  });

  function lastVars(): Record<string, string> {
    return mockLoader.load.mock.calls[0][1] as Record<string, string>;
  }

  it('prova 5: sensitiveConstraints chega ao Revisor em seção própria', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      sensitiveConstraints: 'Não exibir modelo sem camisa',
    });
    const vars = lastVars();
    expect(vars.sensitiveConstraintsSection).toContain('## Restrições Sensíveis');
    expect(vars.sensitiveConstraintsSection).toContain('- Não exibir modelo sem camisa');
    // Sem política de julgamento no builder.
    expect(vars.sensitiveConstraintsSection).not.toMatch(/CRITICA|reprovar|minor|bloque/i);
  });

  it('prova 5b: sem sensitiveConstraints → seção vazia', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P',
      storeName: 'L',
    });
    expect(lastVars().sensitiveConstraintsSection).toBe('');
  });

  it('prova 6: objective chega como contexto não-bloqueante (seção presente; ausência nunca reprova)', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      objective: 'Vender mais',
    });
    const vars = lastVars();
    expect(vars.objectiveSection).toContain('## Objetivo da Campanha');
    expect(vars.objectiveSection).toContain('não é conteúdo obrigatório na arte');

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P',
      storeName: 'L',
    });
    expect(lastVars().objectiveSection).toBe('');
  });

  it('prova 7: campaignDetails/additionalDetails seguem apenas como contexto autorizado', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      campaignDetails: 'Frete grátis acima de R$ 100',
      additionalDetails: 'Válido somente em loja física',
    });
    const vars = lastVars();
    expect(vars.authorizedContextSection).toContain('## Contexto Autorizado da Campanha');
    expect(vars.authorizedContextSection).toContain('Frete grátis acima de R$ 100');
    expect(vars.authorizedContextSection).toContain('Válido somente em loja física');
    // Nenhuma política embutida no builder (regra de invenção vive no .md).
    expect(vars.authorizedContextSection).not.toMatch(/invented_information|NÃO devem ser reportadas/i);
  });

  it('prova 8: offer sem "CTA de compra esperado" e sem "senso de urgência" no expectedCommercialTone', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
    });
    const vars = lastVars();
    expect(vars.expectedCommercialTone).toBe('Tom comercial e promocional coerente com uma campanha de oferta.');
    expect(vars.expectedCommercialTone).not.toContain('CTA de compra esperado');
    expect(vars.expectedCommercialTone).not.toContain('senso de urgência');
  });

  it('prova 9: buildExpectedBadgeBehavior intacto — offer obrigatório exato e demais intents informado-opcional', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P',
      storeName: 'L',
      campaignIntent: 'offer',
      badgeText: 'Oferta Imperdível',
    });
    expect(lastVars().expectedBadgeBehavior).toBe(
      "A imagem DEVE exibir badge promocional. O texto deve ser 'Oferta Imperdível'. Badge promocional é obrigatório."
    );

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P',
      storeName: 'L',
      campaignIntent: 'spotlight',
      badgeText: 'Novidade',
    });
    expect(lastVars().expectedBadgeBehavior).toContain("Badge é opcional, mas foi informado 'Novidade'");
  });

  it('prova 10: availabilityNotes não chega ao Revisor (sem campo no input e sem conteúdo na montagem)', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      requiredArtworkText: 'Texto livre',
      validityText: 'Até 30/09/2026',
    });
    const vars = lastVars();
    expect(vars).not.toHaveProperty('availabilityNotes');
    const allText = Object.values(vars).join('\n');
    expect(allText).not.toMatch(/Disponíve[lm]|Restam poucas|últimas unidades|estoque/i);
  });

  it('prova 13: issues minor continuam aprovando (passed=true) — regressão', () => {
    const raw = JSON.stringify({
      passed: true,
      issues: [
        { type: 'weak_visual_quality', severity: 'minor', description: 'Leve assimetria' },
        { type: 'commercial_tone_mismatch', severity: 'minor', description: 'Tom levemente desalinhado' },
      ],
    });
    const result = (service as any).parseResult(raw);
    expect(result.passed).toBe(true);
    expect(result.failureType).toBeNull();
  });

  it('prova 13b: crítica mantém passed=false com failureType correspondente', () => {
    const raw = JSON.stringify({
      passed: false,
      issues: [{ type: 'wrong_price', severity: 'critical', description: 'Preço divergente' }],
    });
    const result = (service as any).parseResult(raw);
    expect(result.passed).toBe(false);
  });

  it('prova 14: prompt final do Revisor sem placeholders residuais; placeholders ⊆ variáveis; sem identidade no conjunto', async () => {
    const realService = new ImageReviewService();
    const vars = realService.buildReviewPromptVariables({
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      originalPrice: 'R$ 49,90',
      discountedPrice: 'R$ 39,90',
      badgeText: 'Oferta',
      requiredArtworkText: 'Texto obrigatório livre',
      illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT,
      sensitiveConstraints: 'Não exibir modelo sem camisa',
      objective: 'Vender mais',
      campaignDetails: 'Frete grátis',
      validityText: 'Até 30/09/2026',
      validationContext: { inputCorrection: { field: 'productName', from: 'A', to: 'B', reason: 'x' } },
    });
    const prompt = new PromptLoader().load('campaign-image-reviewer', vars);

    // Placeholders do template ⊆ variáveis fornecidas e sem identidade.
    expect(prompt).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
    const templatePlaceholders = [...readFileSync(
      path.join(process.cwd(), 'prompts', 'campaign-image-reviewer.md'),
      'utf-8'
    ).matchAll(/\{\{([a-zA-Z]+)\}\}/g)].map((m) => m[1]);
    for (const placeholder of templatePlaceholders) {
      expect(vars, `placeholder {{${placeholder}}} sem variável`).toHaveProperty(placeholder);
    }
    expect(templatePlaceholders).not.toContain('identityReferenceSection');
    expect(templatePlaceholders).not.toContain('identityImageUrl');
  });

  it('prova 15: .md do Revisor não contém instrução de avaliação de identidade nem concatenação/posição dos dois textos', () => {
    const md = readFileSync(path.join(process.cwd(), 'prompts', 'campaign-image-reviewer.md'), 'utf-8');
    // Nenhuma menção a corte/borda/fidelidade/logotipo/assinatura/área segura como alvo.
    for (const term of ['área segura', 'corte', 'borda', 'fidelidade', 'logotipo', 'assinatura']) {
      expect(md, `.md menciona "${term}"`).not.toContain(term);
    }
    // Verificação separada dos dois textos (sem co-presença/ordem/proximidade/concatenação).
    expect(md).toMatch(/separadamente/i);
    expect(md).toMatch(/NÃO exija co-presença, ordem, proximidade, concatenação/i);
    expect(md).toMatch(/NÃO avalie a posição do aviso/i);
    // Objetivo não-bloqueante e offer sem CTA/urgência no .md (política: CTA não
    // exigido — a menção textual existe apenas para negar a exigência).
    expect(md).toMatch(/ausência textual dele nunca reprova/i);
    expect(md).toMatch(/CTA e hook não são exigidos/i);
    expect(md).toMatch(/não há "CTA de compra esperado" em campanha de oferta/i);
  });
});

describe('ImageReviewService — rodada de ajuste focado 45-08 (revisão humana pós-checkpoint)', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: ImageReviewService;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockReturnValue('review prompt with {{expectedBadgeBehavior}}'),
      clearCache: vi.fn(),
    };
    service = new ImageReviewService(mockLoader as unknown as PromptLoader);
  });

  function lastVars(): Record<string, string> {
    return mockLoader.load.mock.calls[0][1] as Record<string, string>;
  }

  function readReviewerMd(): string {
    return readFileSync(path.join(process.cwd(), 'prompts', 'campaign-image-reviewer.md'), 'utf-8');
  }

  it('rodada 1 — offer background: expectedImageTreatment orienta isolar mas NÃO bloqueia fundo contextual automaticamente', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      preserveImageContext: false,
    });
    const treatment = lastVars().expectedImageTreatment;
    // Diretor segue orientado a isolar o produto em fundo comercial limpo.
    expect(treatment).toContain('isolar o produto em fundo comercial limpo');
    // Revisor trata como expectativa visual, não como bloqueio automático.
    expect(treatment).not.toContain('NÃO é aceito');
    expect(treatment).not.toMatch(/fundo contextual[^.]*não é aceito/i);
    expect(treatment).toMatch(/não é bloqueio automático/i);
    expect(treatment).toMatch(/é minor e passa quando a peça permanece publicável/i);
    expect(treatment).toMatch(/prejudicar claramente a identificação do produto|prejudicar claramente a identificação do produto, a legibilidade/i);
  });

  it('rodada 1b — .md afirma que fundo contextual publicável não bloqueia isoladamente', () => {
    const md = readReviewerMd();
    expect(md).toMatch(/não bloqueia isoladamente/i);
    expect(md).toMatch(/não[^.]*bloqueio automático/i);
    expect(md).toMatch(/apenas diferente do esperado é `minor` e passa/i);
  });

  it('rodada 2 — ausência de originalPrice não significa ausência de preço (dedução removida do .md)', () => {
    const md = readReviewerMd();
    expect(md).not.toMatch(/estiver vazio \(zerado\), nenhum preço foi informado/i);
    expect(md).not.toContain('nenhum preço foi informado');
    expect(md).toMatch(/NÃO\*\* significa ausência de preço na campanha/i);
    expect(md).toMatch(/sem exigir preço original/i);
  });

  it('rodada 2b — expectedPriceBehavior mantém os 3 intents corretos', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P', storeName: 'L', campaignIntent: 'offer', discountedPrice: 'R$ 19,90',
    });
    expect(lastVars().expectedPriceBehavior).toContain('DEVE exibir preço promocional');
    expect(lastVars().expectedPriceBehavior).toContain('R$ 19,90');

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P', storeName: 'L', campaignIntent: 'spotlight', discountedPrice: 'R$ 29,90',
    });
    expect(lastVars().expectedPriceBehavior).toContain('DEVE exibir preço único');
    expect(lastVars().expectedPriceBehavior).toContain('R$ 29,90');

    mockLoader.load.mockClear();
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P', storeName: 'L', campaignIntent: 'exclusive',
    });
    expect(lastVars().expectedPriceBehavior).toContain('NÃO deve exibir preço');
  });

  it('rodada 3 — escassez não autorizada permanece critical; disclaimers genéricos neutros podem ser minor', () => {
    const md = readReviewerMd();
    // Escassez não autorizada é invented_information critical.
    expect(md).toMatch(/alegações de escassez/i);
    expect(md).toMatch(/estoque limitado.*últimas unidades.*poucas unidades/i);
    expect(md).toMatch(/escassez não autorizadas são `critical`/i);
    expect(md).toMatch(/não\*\* são minor — são `invented_information` critical/i);
    // Disclaimers genéricos neutros podem continuar minor.
    expect(md).toMatch(/consulte condições.*sujeito a disponibilidade/i);
    expect(md).toMatch(/minor, salvo se contrariarem dado explícito/i);
    // O exemplo de tom minor NÃO usa mais "últimas unidades" como tom leve.
    expect(md).not.toMatch(/Tom levemente desalinhado[^.]*"Últimas unidades"/);
  });

  it('rodada 4 — wrong_product_name exige divergência clara e inequívoca; .md tolera ambiguidade tipográfica', () => {
    const md = readReviewerMd();
    expect(md).toMatch(/divergência \*\*clara e inequívoca\*\* do nome do produto/i);
    expect(md).toMatch(/Não faça comparação de OCR rígida caractere por caractere/i);
    expect(md).toMatch(/l`.*`I`.*`1|`l`\/`I`\/`1`/i);
    expect(md).toMatch(/`O`\/`0`|O` e `0/i);
    expect(md).toMatch(/Coca Cola 2l Original/i);
    expect(md).toMatch(/Coca Cola 21 Original/i);
    expect(md).toMatch(/trate como correspondência válida/i);
    expect(md).toMatch(/NÃO use OCR rígido caractere por caractere/i);
    expect(md).toMatch(/Quando a dúvida for entre texto correto e divergência real → `minor` e aprove/i);
    expect(md).toMatch(/Permanece crítico:/i);
  });

  it('rodada 4b — decisão: dúvida objetiva → minor → approve (regra final preservada)', () => {
    const md = readReviewerMd();
    expect(md).toMatch(/Na dúvida entre `minor` e `critical`, classifique como `minor`/i);
    expect(md).toMatch(/Se o problema não impede o lojista de publicar a peça com confiança, a revisão \*\*passa\*\*/i);
  });

  it('rodada 5 — badge permanece intacto (offer obrigatório exato)', async () => {
    await service.review('data:image/jpeg;base64,abc', {
      productName: 'P', storeName: 'L', campaignIntent: 'offer', badgeText: 'Oferta Imperdível',
    });
    expect(lastVars().expectedBadgeBehavior).toBe(
      "A imagem DEVE exibir badge promocional. O texto deve ser 'Oferta Imperdível'. Badge promocional é obrigatório."
    );
  });

  it('rodada 6 — prompt final do Revisor sem placeholders residuais após o ajuste (montagem real)', () => {
    const realService = new ImageReviewService();
    const vars = realService.buildReviewPromptVariables({
      productName: 'Coca Cola 2l Original',
      storeName: 'Loja Teste',
      campaignIntent: 'offer',
      originalPrice: '',
      discountedPrice: 'R$ 8,90',
      badgeText: 'Oferta',
    });
    const prompt = new PromptLoader().load('campaign-image-reviewer', vars);
    expect(prompt).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
  });

  it('rodada 7 — fundo contextual apenas diferente do esperado → minor/passa (exemplo explícito no .md)', () => {
    const md = readReviewerMd();
    expect(md).toMatch(/um fundo contextual apenas diferente do esperado é `minor` e passa/i);
    expect(md).not.toMatch(/Fundo contextual NÃO é aceito/i);
  });
});
