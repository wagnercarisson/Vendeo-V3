import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIImageProvider } from '../openai';
import type { ImageProviderInput } from '../types';

const { mockResponsesCreate, mockImagesEdit } = vi.hoisted(() => ({
  mockResponsesCreate: vi.fn(),
  mockImagesEdit: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    responses = { create: mockResponsesCreate };
    images = { edit: mockImagesEdit };
  },
  toFile: vi.fn((buffer: Buffer, filename: string, options?: any) => ({
    buffer,
    filename,
    ...options,
  })),
}));

describe('OpenAIImageProvider — identityImageUrl', () => {
  let provider: OpenAIImageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIImageProvider('test-model', 'test-fallback-model');
  });

  it('name is "openai"', () => {
    expect(provider.name).toBe('openai');
  });

  it('attempt >= 1 with productImageDataUrl calls fallbackToImageApi', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,abc',
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 1,
    };

    // Mock fetch for identity URL
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    });

    mockImagesEdit.mockRejectedValue(new Error('edit failed'));
    await expect(provider.generateImage(input)).rejects.toThrow('edit failed');
    expect(mockImagesEdit).toHaveBeenCalledTimes(1);
  });

  it('attempt 0 with identityImageUrl passes it as input_image', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,abc123',
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 0,
    };

    mockResponsesCreate.mockRejectedValue(new Error('responses failed'));
    await expect(provider.generateImage(input)).rejects.toThrow('image provider error');
  });
});

describe('OpenAIImageProvider — F41 D7 (N input_image + fallback gated)', () => {
  let provider: OpenAIImageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIImageProvider('test-model', 'test-fallback-model');
  });

  it('17: productImagesDataUrls → N blocos input_image no Responses (primary + auxiliares)', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/png;base64,aux1',
      ],
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 0,
    };

    mockResponsesCreate.mockResolvedValue({
      output: [
        { type: 'image_generation_call', result: 'base64-result' },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await provider.generateImage(input);
    expect(result.imageBase64).toBe('base64-result');

    const callInput = mockResponsesCreate.mock.calls[0][0].input;
    const userContent = callInput[0].content;
    const imageBlocks = userContent.filter((b: { type: string }) => b.type === 'input_image');
    expect(imageBlocks).toHaveLength(3);
    expect(imageBlocks[0]).toMatchObject({ type: 'input_image', image_url: 'data:image/png;base64,primary' });
    expect(imageBlocks[1]).toMatchObject({ type: 'input_image', image_url: 'data:image/png;base64,aux1' });
    expect(imageBlocks[2]).toMatchObject({ type: 'input_image', image_url: 'https://example.com/logo.png', detail: 'low' });
  });

  it('18: productImagesDataUrls com 2+ itens + attempt>=1 → images.edit NÃO chamado (pre-response gate)', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/png;base64,aux1',
      ],
      attempt: 1,
    };

    mockResponsesCreate.mockRejectedValue(new Error('responses failed'));
    mockImagesEdit.mockRejectedValue(new Error('edit should not be called'));

    await expect(provider.generateImage(input)).rejects.toThrow('image provider error');
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it('18b: AMBOS os campos + erro isResponsesApiError pós-erro → images.edit NÃO chamado, erro propaga (gate 2 D7)', async () => {
    // REPLICA o shape de produção: o service mantém productImageDataUrl (legado)
    // E productImagesDataUrls (lista N) — sem o gate pós-erro (:177-184), um erro
    // "Responses indisponível" descartaria as auxiliares no images.edit.
    // attempt=0 → passa pelo pre-response gate → responses.create lança erro
    // isResponsesApiError → o CATCH (gate 2) decide pelo fallback.
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,primary',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/png;base64,aux1',
      ],
      attempt: 0,
    };

    mockResponsesCreate.mockRejectedValue(new Error('model_not_found: gpt-image is not supported for this tool'));
    mockImagesEdit.mockRejectedValue(new Error('edit should not be called'));

    await expect(provider.generateImage(input)).rejects.toThrow();
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it('19: legado (só productImageDataUrl, sem lista) + attempt>=1 → fallback images.edit permitido', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,abc',
      attempt: 1,
    };

    mockImagesEdit.mockRejectedValue(new Error('edit failed'));
    await expect(provider.generateImage(input)).rejects.toThrow('edit failed');
    expect(mockImagesEdit).toHaveBeenCalledTimes(1);
  });

  it('19b: productImagesDataUrls:[primary] sem productImageDataUrl + attempt>=1 → fallback permitido e resolve a primary (sem "Invalid productImageDataUrl")', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: ['data:image/png;base64,abc'],
      attempt: 1,
    };

    mockImagesEdit.mockRejectedValue(new Error('edit failed'));
    await expect(provider.generateImage(input)).rejects.toThrow('edit failed');
    expect(mockImagesEdit).toHaveBeenCalledTimes(1);
  });
});
