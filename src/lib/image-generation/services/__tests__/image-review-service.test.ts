import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageReviewService } from '../image-review-service';
import type { ImageReviewInput } from '../image-review-service';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';

describe('ImageReviewService', () => {
  let mockLoader: { load: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> };
  let service: ImageReviewService;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockReturnValue('review prompt with {{badgeText}}'),
      clearCache: vi.fn(),
    };
    service = new ImageReviewService(mockLoader as unknown as PromptLoader);

    // Prevent actual OpenAI calls — callVisionModel is private but accessible via any cast
    vi.spyOn(service as any, 'callVisionModel').mockResolvedValue(
      JSON.stringify({ passed: true, issues: [] })
    );
  });

  it('review() interpola badgeText no prompt', async () => {
    const input: ImageReviewInput = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      discountedPrice: 'R$ 19,90',
      badgeText: 'Oferta Imperdível',
    };

    await service.review('data:image/jpeg;base64,abc', input);

    expect(mockLoader.load).toHaveBeenCalledWith(
      'campaign-image-reviewer',
      expect.objectContaining({ badgeText: 'Oferta Imperdível' })
    );
  });

  it('review() usa fallback string vazia quando badgeText é undefined', async () => {
    const input = {
      productName: 'Produto Teste',
      storeName: 'Loja Teste',
      discountedPrice: 'R$ 19,90',
    } as ImageReviewInput;

    await service.review('data:image/jpeg;base64,abc', input);

    expect(mockLoader.load).toHaveBeenCalledWith(
      'campaign-image-reviewer',
      expect.objectContaining({ badgeText: '' })
    );
  });
});
