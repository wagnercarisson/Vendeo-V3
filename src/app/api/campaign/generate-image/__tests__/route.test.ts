import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock("server-only", () => ({}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } })),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/store-identity-service', () => ({
  resolveStoreIdentity: vi.fn(),
  validateIdentityReference: vi.fn(),
  buildCampaignBrief: vi.fn(),
}));

vi.mock('@/lib/campaign/persistence', () => ({
  createCampaign: vi.fn(),
  dataUrlToCampaignImage: vi.fn(),
  uploadCampaignImage: vi.fn(),
  updateCampaignReady: vi.fn(),
  updateCampaignError: vi.fn(),
  deleteCampaignImage: vi.fn(),
}));

vi.mock('@/lib/campaign/image-processor', () => ({
  transcodeToJpeg: vi.fn(),
  buildPublicationCopySnapshot: vi.fn(),
}));

vi.mock('@/lib/image-generation/config', () => ({
  IMAGE_GENERATION_GLOBAL_TIMEOUT_MS: 300000,
  MAX_PRODUCT_IMAGE_BASE64_SIZE: 5 * 1024 * 1024,
  IMAGE_GENERATION_RESPONSES_MODEL: 'test-model',
}));

vi.mock('@/lib/image-generation/services/image-generation-service', () => ({
  ImageGenerationService: vi.fn(),
}));

vi.mock('@/lib/image-generation/services/input-validation-service', () => ({
  InputValidationService: vi.fn(() => ({
    validate: vi.fn(),
  })),
}));

vi.mock('@/lib/image-generation/providers/factory', () => ({
  createImageProvider: vi.fn(),
}));

vi.mock('@/lib/auth/csrf', () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

describe('POST /api/campaign/generate-image — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects legacy identity fields with 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/campaign/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        storeName: 'Loja Antiga',
        storeLogoUrl: 'https://example.com/logo.png',
        productName: 'Produto',
        discountedPriceCents: 1990,
        productImageDataUrl: 'data:image/jpeg;base64,abc',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Campos de identidade da loja');
  });

  it('rejects missing productImageDataUrl with 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/campaign/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        storeId: '550e8400-e29b-41d4-a716-446655440000',
        productName: 'Produto',
        discountedPriceCents: 1990,
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Imagem do produto');
  });

  it('rejects missing storeId with 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/campaign/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        productName: 'Produto',
        discountedPriceCents: 1990,
        productImageDataUrl: 'data:image/png;base64,xyz',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('inválidos');
  });
});
