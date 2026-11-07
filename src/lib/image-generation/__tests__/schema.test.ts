import { describe, it, expect } from 'vitest';
import { GenerateImageRequestSchema, NewFlowGenerateImageRequestSchema } from '../schema';

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
describe("F59/D-03 - campaignFormat no schema do fluxo novo", () => {
  const NEW_FLOW_BODY = {
    ...VALID_BODY,
    backgroundDirection: "studio",
    campaignId: "00000000-0000-4000-8000-000000000002",
    operationId: "00000000-0000-4000-8000-000000000003",
  };

  it("aceita 9:16 e 1:1", () => {
    expect(NewFlowGenerateImageRequestSchema.safeParse({ ...NEW_FLOW_BODY, campaignFormat: "9:16" }).success).toBe(true);
    expect(NewFlowGenerateImageRequestSchema.safeParse({ ...NEW_FLOW_BODY, campaignFormat: "1:1" }).success).toBe(true);
  });

  it("rejeita formato desconhecido/null/numerico", () => {
    for (const campaignFormat of ["16:9", "vertical", null, 123]) {
      expect(NewFlowGenerateImageRequestSchema.safeParse({ ...NEW_FLOW_BODY, campaignFormat }).success).toBe(false);
    }
  });

  it("payload 1:1 sem a chave continua valido e nao ganha a chave", () => {
    const result = NewFlowGenerateImageRequestSchema.safeParse(NEW_FLOW_BODY);
    expect(result.success).toBe(true);
    if (result.success) expect("campaignFormat" in result.data).toBe(false);
  });

  it("schema legado continua rejeitando campaignFormat/backgroundDirection", () => {
    expect(GenerateImageRequestSchema.safeParse({ ...VALID_BODY, campaignFormat: "9:16" }).success).toBe(false);
    expect(GenerateImageRequestSchema.safeParse({ ...VALID_BODY, backgroundDirection: "studio" }).success).toBe(false);
  });
});
