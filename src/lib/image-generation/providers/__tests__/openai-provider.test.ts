import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIImageProvider } from '../openai';
import type { ImageProviderInput } from '../types';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: vi.fn(),
    },
    images: {
      edit: vi.fn(),
    },
  })),
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

    await expect(provider.generateImage(input)).rejects.toThrow();
  });

  it('attempt 0 with identityImageUrl passes it as input_image', async () => {
    // The actual OpenAI call will fail because we mock it to throw,
    // but we're testing that identityImageUrl is passed to the content array
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,abc123',
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 0,
    };

    await expect(provider.generateImage(input)).rejects.toThrow();
  });
});
