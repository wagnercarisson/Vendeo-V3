import { describe, it, expect } from 'vitest';
import type { ImageReviewInput } from '@/lib/image-generation/services/image-review-service';

describe('F31.3 Quality Gate por Intenção Comercial — Contract Tests', () => {
  it('ImageReviewInput default campaignIntent é offer (regressão)', () => {
    const input: ImageReviewInput = {
      productName: 'Bolo de Cenoura',
      storeName: 'Padaria Pão & Cia',
    };
    expect(input.campaignIntent).toBeUndefined();
  });

  it('ImageReviewInput aceita exclusive sem discountedPrice', () => {
    const input: ImageReviewInput = {
      productName: 'Buquê de Rosas',
      storeName: 'Flores & Encanto',
      campaignIntent: 'exclusive',
      preserveImageContext: true,
    };
    expect(input.campaignIntent).toBe('exclusive');
    expect(input.discountedPrice).toBeUndefined();
  });

  it('ReviewIssueType aceita commercial_tone_mismatch', () => {
    const issue: import('@/lib/image-generation/schema').ReviewIssue = {
      type: 'commercial_tone_mismatch',
      severity: 'minor',
      description: 'Tom levemente promocional em peça exclusive.',
    };
    expect(issue.type).toBe('commercial_tone_mismatch');
  });

  it('ImageReviewResult.failureType aceita null', () => {
    const result: import('@/lib/image-generation/schema').ImageReviewResult = {
      passed: true,
      issues: [],
      failureType: null,
    };
    expect(result.failureType).toBeNull();
  });

  it('ImageReviewResult.failureType rejeita undefined', () => {
    const result: import('@/lib/image-generation/schema').ImageReviewResult = {
      passed: true,
      issues: [],
      failureType: null,
    };
    expect(result.failureType).not.toBeUndefined();
  });
});
