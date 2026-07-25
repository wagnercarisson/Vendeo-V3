import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopyDirectorService } from '../copy-director-service';
import { CopyDirectorInputSchema, CopyDirectorResultSchema } from '../schema';
import type { CopyDirectorInput } from '../schema';
import { MockTextProvider } from '@/lib/text-provider/mock';
import type { TextProvider } from '@/lib/text-provider/types';
import { MalformedResponseError } from '../errors';

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
