import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopyDirectorService } from '../copy-director-service';
import { CopyDirectorInputSchema, CopyDirectorResultSchema } from '../schema';
import type { CopyDirectorInput } from '../schema';
import { MockTextProvider } from '@/lib/text-provider/mock';
import type { TextProvider } from '@/lib/text-provider/types';
import { MalformedResponseError } from '../errors';
import { mapBriefToCopyDirectorInput } from '../mapper';
import { buildCampaignBriefFromFlat } from '@/lib/campaign/brief';
import type { GenerateImageRequest } from '@/lib/image-generation/schema';
import type { ResolvedCampaignContext } from '@/components/campaign/types';

const STORE_ID = '44444444-4444-4444-8444-444444444444';

function flatPayload(overrides: Partial<GenerateImageRequest> = {}): GenerateImageRequest {
  return {
    storeId: STORE_ID,
    productName: 'Tênis Runner Pro',
    description: 'Tênis esportivo com amortecimento avançado',
    originalPriceCents: 39990,
    discountedPriceCents: 24990,
    badgeText: 'Oferta',
    campaignIntent: 'offer',
    productImageDataUrl: 'data:image/jpeg;base64,abc123',
    ...overrides,
  };
}

function mockContext(overrides: Partial<ResolvedCampaignContext> = {}): ResolvedCampaignContext {
  return {
    campaignInput: {
      productName: 'Tênis Runner Pro',
      discountedPriceCents: 24990,
      campaignIntent: 'offer',
      productImageDataUrl: 'data:image/jpeg;base64,abc123',
    },
    store: {
      name: 'Esportes e Cia',
      segment: 'moda-calcados-acessorios',
      subsegment: null,
      toneOfVoice: 'jovem e energético',
      positioning: 'Loja referência em artigos esportivos',
      shortDescription: 'Tênis para corrida e academia',
      slogan: 'Seu melhor desempenho começa aqui',
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

const COMPLETE_INPUT: CopyDirectorInput = {
  productName: "Tênis Runner Pro",
  description: "Tênis esportivo com amortecimento avançado",
  commercialFrame: "De R$ 399,90 por R$ 249,90",
  campaignIntent: "offer",
  storeName: "Esportes e Cia",
  segment: "moda-calcados-acessorios",
  toneOfVoice: "jovem e energético",
  positioning: "Loja referência em artigos esportivos",
  shortDescription: "Tênis para corrida e academia",
  slogan: "Seu melhor desempenho começa aqui",
  brandPersonality: "Moderna, dinâmica, inspiradora",
  campaignGuidelines: "Foco em performance e qualidade",
};

const MINIMUM_INPUT: CopyDirectorInput = {
  productName: "Café Gourmet",
  commercialFrame: "Leve 2 pague 1",
  campaignIntent: "offer",
  storeName: "Café & Aroma",
  segment: "bebidas-adegas-conveniencia",
};

describe('CopyDirectorInputSchema', () => {
  it('aceita input completo com todos os campos opcionais', () => {
    const result = CopyDirectorInputSchema.parse(COMPLETE_INPUT);
    expect(result.productName).toBe('Tênis Runner Pro');
    expect(result.description).toBe('Tênis esportivo com amortecimento avançado');
  });

  it('aceita input mínimo (só obrigatórios)', () => {
    const result = CopyDirectorInputSchema.parse(MINIMUM_INPUT);
    expect(result.productName).toBe('Café Gourmet');
    expect(result.commercialFrame).toBe('Leve 2 pague 1');
  });

  it('rejeita productName vazio', () => {
    expect(() =>
      CopyDirectorInputSchema.parse({ ...MINIMUM_INPUT, productName: '' })
    ).toThrow();
  });

  it('rejeita commercialFrame vazio', () => {
    expect(() =>
      CopyDirectorInputSchema.parse({ ...MINIMUM_INPUT, commercialFrame: '' })
    ).toThrow();
  });

  it('não contém campo mandatoryArtworkText', () => {
    const shape = CopyDirectorInputSchema.shape as Record<string, unknown>;
    expect(shape).not.toHaveProperty('mandatoryArtworkText');
  });
});

describe('CopyDirectorResultSchema', () => {
  it('aceita resultado válido com title, caption, hashtags, cta_post', () => {
    const result = CopyDirectorResultSchema.parse({
      title: 'Título Teste',
      caption: 'Caption de teste',
      hashtags: ['#Teste'],
      cta_post: 'Compre agora!',
    });
    expect(result.title).toBe('Título Teste');
  });

  it('rejeita caption ausente', () => {
    expect(() =>
      CopyDirectorResultSchema.parse({
        title: 'Teste',
        hashtags: [],
        cta_post: 'Compre!',
      })
    ).toThrow();
  });

  it('rejeita title ausente', () => {
    expect(() =>
      CopyDirectorResultSchema.parse({
        caption: 'Teste',
        hashtags: [],
        cta_post: 'Compre!',
      })
    ).toThrow();
  });
});

describe('CopyDirectorService', () => {
  let service: CopyDirectorService;
  let mockProvider: TextProvider;

  beforeEach(() => {
    mockProvider = new MockTextProvider();
    service = new CopyDirectorService(mockProvider);
  });

  it('generateCopy com input completo retorna CopyDirectorResult válido', async () => {
    const result = await service.generateCopy(COMPLETE_INPUT);
    expect(result.title).toBeDefined();
    expect(result.caption).toBeDefined();
    expect(result.hashtags).toBeDefined();
    expect(result.cta_post).toBeDefined();
  });

  it('generateCopy com input mínimo funciona', async () => {
    const result = await service.generateCopy(MINIMUM_INPUT);
    expect(result.title).toBeDefined();
    expect(result.caption).toBeDefined();
  });

  it('title não vazio', async () => {
    const result = await service.generateCopy(MINIMUM_INPUT);
    expect(result.title.length).toBeGreaterThan(0);
  });

  it('caption não vazio', async () => {
    const result = await service.generateCopy(MINIMUM_INPUT);
    expect(result.caption.length).toBeGreaterThan(0);
  });

  it('hashtags contém ao menos 3 itens', async () => {
    const result = await service.generateCopy(COMPLETE_INPUT);
    expect(result.hashtags.length).toBeGreaterThanOrEqual(3);
  });

  it('cta_post presente e não vazio', async () => {
    const result = await service.generateCopy(MINIMUM_INPUT);
    expect(result.cta_post.length).toBeGreaterThan(0);
  });

  it('generateCopy com toneOfVoice vazio não quebra', async () => {
    const input: CopyDirectorInput = {
      ...MINIMUM_INPUT,
      toneOfVoice: '',
    };
    const result = await service.generateCopy(input);
    expect(result.title).toBeDefined();
  });
});

describe('CopyDirectorService — parseResult fallback', () => {
  it('saída malformatada cai no fallback regex', async () => {
    const regexProvider: TextProvider = {
      name: 'regex-test',
      async generateText() {
        return {
          content: `{"title": "Título Extraído", "caption": "Caption extraído do texto", "hashtags": ["#Tag1", "#Tag2"], "cta_post": "Compre já!"`,
          usage: { promptTokens: 0, completionTokens: 0 },
          model: 'test',
        };
      },
    };
    const service = new CopyDirectorService(regexProvider);
    const result = await service.generateCopy(MINIMUM_INPUT);
    expect(result.title).toBe('Título Extraído');
    expect(result.caption).toBe('Caption extraído do texto');
    expect(result.cta_post).toBe('Compre já!');
  });

  it('saída JSON inválida sem campos extraíveis lança MalformedResponseError', async () => {
    const brokenProvider: TextProvider = {
      name: 'broken-test',
      async generateText() {
        return {
          content: 'texto completamente inválido sem estrutura JSON nem campos extraíveis',
          usage: { promptTokens: 0, completionTokens: 0 },
          model: 'test',
        };
      },
    };
    const service = new CopyDirectorService(brokenProvider);
    await expect(service.generateCopy(MINIMUM_INPUT)).rejects.toThrow(MalformedResponseError);
  });
});

describe('CopyDirectorService — onCall (D11, furo 1)', () => {
  it('Teste 11: generateCopy com onCall → invocado com provider/model/usage/durationMs do TextProviderResult', async () => {
    const usageProvider: TextProvider = {
      name: 'openai',
      async generateText() {
        return {
          content: '{"title": "Título", "caption": "Legenda", "hashtags": ["#A", "#B", "#C"], "cta_post": "Compre!"}',
          usage: { promptTokens: 120, completionTokens: 40 },
          model: 'gpt-4o-mini',
        };
      },
    };
    const service = new CopyDirectorService(usageProvider);
    const onCall = vi.fn();

    const result = await service.generateCopy(MINIMUM_INPUT, undefined, onCall);

    expect(result.title).toBeDefined();
    expect(onCall).toHaveBeenCalledTimes(1);
    const info = onCall.mock.calls[0][0];
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('gpt-4o-mini');
    expect(info.usage).toEqual({ promptTokens: 120, completionTokens: 40 });
    expect(info.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Teste 12: onCall que lança → generateCopy continua (best-effort) e copy é gerada normalmente', async () => {
    const service = new CopyDirectorService(new MockTextProvider());
    const onCall = vi.fn(() => {
      throw new Error('callback boom');
    });

    const result = await service.generateCopy(MINIMUM_INPUT, undefined, onCall);

    expect(result.title).toBeDefined();
    expect(result.caption).toBeDefined();
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('Teste 13: sem onCall → comportamento inalterado (compat)', async () => {
    const service = new CopyDirectorService(new MockTextProvider());
    const result = await service.generateCopy(MINIMUM_INPUT);
    expect(result.title).toBeDefined();
    expect(result.caption).toBeDefined();
  });
});

describe('mapBriefToCopyDirectorInput — lê do domínio (8.19, D11)', () => {
  it('brief estruturado → CopyDirectorInput com productName/intent do domínio (equivalência flat)', () => {
    const brief = buildCampaignBriefFromFlat(flatPayload(), STORE_ID);
    const result = mapBriefToCopyDirectorInput(brief, mockContext(), {
      discountedPriceCents: brief.commercial.discountedPriceCents,
    });

    expect(result.productName).toBe('Tênis Runner Pro');
    expect(result.campaignIntent).toBe('offer');
    expect(result.description).toBe('Tênis esportivo com amortecimento avançado');
    expect(result.storeName).toBe('Esportes e Cia');
    expect(result.segment).toBe('moda-calcados-acessorios');
    expect(result.commercialFrame).toContain('R$ 249,90');
    expect(CopyDirectorInputSchema.safeParse(result).success).toBe(true);
  });

  it('brief sem description/badge → campos ausentes na saída (mesmo comportamento)', () => {
    const brief = buildCampaignBriefFromFlat(
      flatPayload({ description: undefined, badgeText: undefined }),
      STORE_ID
    );
    const result = mapBriefToCopyDirectorInput(brief, mockContext(), {});

    expect(result.description).toBeUndefined();
    expect(result.commercialFrame).not.toContain('Oferta:');
  });

  it('legalNotice NUNCA entra no CopyDirectorInput (fronteira copy × arte, D9)', () => {
    const brief = buildCampaignBriefFromFlat(
      flatPayload({ mandatoryArtworkText: 'Imagem meramente ilustrativa' }),
      STORE_ID
    );
    const result = mapBriefToCopyDirectorInput(brief, mockContext(), {});

    expect('legalNotice' in result).toBe(false);
    expect('mandatoryArtworkText' in result).toBe(false);
    expect(result.commercialFrame).not.toContain('ilustrativa');
  });

  it('validity não ganha campo novo no CopyDirectorInput (D8/F39-17)', () => {
    const brief = buildCampaignBriefFromFlat(
      flatPayload({ validity: 'válida até 30/09' }),
      STORE_ID
    );
    const result = mapBriefToCopyDirectorInput(brief, mockContext(), {});

    expect('validity' in result).toBe(false);
    expect(result).not.toHaveProperty('validity');
  });
});
