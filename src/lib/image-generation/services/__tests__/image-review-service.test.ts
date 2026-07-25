import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageReviewService } from '../image-review-service';
import type { ImageReviewInput } from '../image-review-service';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';

describe('ImageReviewService', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: ImageReviewService;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockReturnValue('review prompt with {{expectedBadgeBehavior}}'),
      clearCache: vi.fn(),
    };
    service = new ImageReviewService(mockLoader as unknown as PromptLoader);

    vi.spyOn(service as any, 'callVisionModel').mockResolvedValue(
      JSON.stringify({ passed: true, issues: [] })
    );
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
});
