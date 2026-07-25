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
});
