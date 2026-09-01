import { describe, it, expect } from 'vitest';
import { GenerateImageRequestSchema } from '../schema';

const STORE_ID = '00000000-0000-0000-0000-000000000001';

const VALID_BODY = {
  storeId: STORE_ID,
  productName: 'Produto Teste',
  discountedPriceCents: 1990,
  productImageDataUrl: 'data:image/jpeg;base64,abc',
};

describe('GenerateImageRequestSchema — override productImageCheck (F43 D5)', () => {
  it('Teste 17a (D5): aceita brief_review_confirmed no inputValidationOverride', () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...VALID_BODY,
      inputValidationOverride: { productImageCheck: 'brief_review_confirmed' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inputValidationOverride?.productImageCheck).toBe('brief_review_confirmed');
    }
  });

  it('Teste 17b (D5): aceita user_confirmed_continue (comportamento atual preservado)', () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...VALID_BODY,
      inputValidationOverride: { productImageCheck: 'user_confirmed_continue' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inputValidationOverride?.productImageCheck).toBe('user_confirmed_continue');
    }
  });

  it('Teste 17c (D5): rejeita valor desconhecido (.strict())', () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...VALID_BODY,
      inputValidationOverride: { productImageCheck: 'some_unknown_value' },
    });
    expect(result.success).toBe(false);
  });
});