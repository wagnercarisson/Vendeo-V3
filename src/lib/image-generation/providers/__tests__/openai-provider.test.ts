import { describe, it, expect, vi, beforeEach } from 'vitest';

// O provider importa `@/lib/ai` (gateway default) → sink → tracker →
// supabase/server. Sem env, lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
});

import { OpenAIImageProvider } from '../openai';
import type { ImageProviderInput } from '../types';
import { AiGateway, ModelRegistry, AiInvocationError } from '@/lib/ai';
import type { AiCallEnvelope, AiInvoker, AiTelemetryContext } from '@/lib/ai';

/**
 * F46-05: o provider delega à camada única (gateway). Os testes injetam um
 * `AiInvoker` fake (seam) e assertam a capacidade/alvo/request — o adapter
 * (responses/images) é testado nos testes de adapter da 46-02.
 */

function makeTelemetry(): AiTelemetryContext {
  return {
    operationRunId: 'run-1',
    operationRunType: 'campaign_delivery',
    traceId: 'trace-1',
    storeId: 'store-1',
    attemptNumber: 0,
    sink: { emit: () => {} },
  };
}

function makeInvoker(): AiInvoker & { invoke: ReturnType<typeof vi.fn> } {
  return {
    invoke: vi.fn(),
    hasFallback: vi.fn(async () => false),
  } as unknown as AiInvoker & { invoke: ReturnType<typeof vi.fn> };
}

const CAPABILITY_ERROR = () =>
  new AiInvocationError({
    kind: 'capability',
    retryable: false,
    message: 'image_generation is not supported for this model',
  });

describe('OpenAIImageProvider — caminho primário via gateway (F46-05)', () => {
  let provider: OpenAIImageProvider;
  let invoker: ReturnType<typeof makeInvoker>;

  beforeEach(() => {
    vi.clearAllMocks();
    invoker = makeInvoker();
    provider = new OpenAIImageProvider(invoker);
  });

  it('name is "openai"', () => {
    expect(provider.name).toBe('openai');
  });

  it('attempt 0 → invoke("campaign_image") com tool image_generation, size/quality e N imagens ordenadas', async () => {
    invoker.invoke.mockResolvedValue({
      imageBase64: 'base64-result',
      mimeType: 'image/png',
      model: 'gpt-5.5',
      usage: { promptTokens: 10, completionTokens: 5 },
      usageMeta: { providerUsageSource: 'responses.image_generation', imageGenerationTool: true },
    });

    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/png;base64,aux1',
      ],
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 0,
      size: '1024x1024',
      quality: 'high',
      telemetry: makeTelemetry(),
    };

    const result = await provider.generateImage(input);

    expect(invoker.invoke).toHaveBeenCalledTimes(1);
    const [capability, request, telemetry, target] = invoker.invoke.mock.calls[0];
    expect(capability).toBe('campaign_image');
    expect(target).toBeUndefined();
    expect(request).toMatchObject({
      prompt: 'test prompt',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/png;base64,aux1',
      ],
      identityImageUrl: 'https://example.com/logo.png',
      tools: 'image_generation',
      size: '1024x1024',
      quality: 'high',
    });
    expect(telemetry.attemptNumber).toBe(0);
    expect(telemetry.sink).toBeDefined();

    expect(result.imageBase64).toBe('base64-result');
    expect(result.model).toBe('gpt-5.5');
    expect(result.usageMeta?.imageGenerationTool).toBe(true);
  });

  it('legado (só productImageDataUrl) → 1 imagem no caminho primário', async () => {
    invoker.invoke.mockResolvedValue({
      imageBase64: 'base64-result',
      model: 'gpt-5.5',
    });

    await provider.generateImage({
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,primary',
      attempt: 0,
      telemetry: makeTelemetry(),
    });

    const [, request] = invoker.invoke.mock.calls[0];
    expect(request.productImagesDataUrls).toEqual(['data:image/png;base64,primary']);
  });

  it('sem imagem na resposta → throw "No image generated"', async () => {
    invoker.invoke.mockResolvedValue({ model: 'gpt-5.5' });

    await expect(
      provider.generateImage({ prompt: 'p', attempt: 0, telemetry: makeTelemetry() })
    ).rejects.toThrow('No image generated in Responses API response');
  });

  it('telemetria ausente → erro explícito (sink obrigatório)', async () => {
    await expect(
      provider.generateImage({ prompt: 'p', attempt: 0 })
    ).rejects.toThrow('AiTelemetryContext é obrigatório');
  });
});

describe('OpenAIImageProvider — fallback campaign_image_edit como segunda invoke (F46-05)', () => {
  let provider: OpenAIImageProvider;
  let invoker: ReturnType<typeof makeInvoker>;

  beforeEach(() => {
    vi.clearAllMocks();
    invoker = makeInvoker();
    provider = new OpenAIImageProvider(invoker);
  });

  it('attempt >= 1 com primary → invoke("campaign_image_edit", …, target: "primary") com 1024x1024 e ordem determinística', async () => {
    invoker.invoke.mockResolvedValue({
      imageBase64: 'base64-result',
      mimeType: 'image/png',
      model: 'gpt-image-2',
      usageMeta: { providerUsageSource: 'images.edit' },
    });

    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,primary',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/png;base64,aux1',
      ],
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 1,
      telemetry: makeTelemetry(),
    };

    const result = await provider.generateImage(input);

    expect(invoker.invoke).toHaveBeenCalledTimes(1);
    const [capability, request, , target] = invoker.invoke.mock.calls[0];
    expect(capability).toBe('campaign_image_edit');
    expect(target).toBe('primary');
    expect(request.productImagesDataUrls).toEqual([
      'data:image/png;base64,primary',
      'data:image/png;base64,primary',
      'data:image/png;base64,aux1',
    ]);
    expect(request.size).toBe('1024x1024');
    expect(request.identityImageUrl).toBe('https://example.com/logo.png');
    expect(result.imageBase64).toBe('base64-result');
    expect(result.model).toBe('gpt-image-2');
  });

  it('legado (só primary) + attempt >= 1 → fallback com 1 referência', async () => {
    invoker.invoke.mockResolvedValue({ imageBase64: 'r', model: 'gpt-image-2' });

    await provider.generateImage({
      prompt: 'p',
      productImageDataUrl: 'data:image/png;base64,abc',
      attempt: 1,
      telemetry: makeTelemetry(),
    });

    const [capability, request, , target] = invoker.invoke.mock.calls[0];
    expect(capability).toBe('campaign_image_edit');
    expect(target).toBe('primary');
    expect(request.productImagesDataUrls).toEqual(['data:image/png;base64,abc']);
  });

  it('productImagesDataUrls:[primary] sem productImageDataUrl + attempt >= 1 → fallback resolve a primary da lista', async () => {
    invoker.invoke.mockResolvedValue({ imageBase64: 'r', model: 'gpt-image-2' });

    await provider.generateImage({
      prompt: 'p',
      productImagesDataUrls: ['data:image/png;base64,abc'],
      attempt: 1,
      telemetry: makeTelemetry(),
    });

    const [, request] = invoker.invoke.mock.calls[0];
    expect(request.productImagesDataUrls).toEqual([
      'data:image/png;base64,abc',
      'data:image/png;base64,abc',
    ]);
  });

  it('erro de capability no Responses + primary → segunda invoke campaign_image_edit (dois envelopes)', async () => {
    invoker.invoke
      .mockRejectedValueOnce(CAPABILITY_ERROR())
      .mockResolvedValueOnce({ imageBase64: 'base64-result', model: 'gpt-image-2' });

    const result = await provider.generateImage({
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,primary',
      attempt: 0,
      telemetry: makeTelemetry(),
    });

    expect(invoker.invoke).toHaveBeenCalledTimes(2);
    expect(invoker.invoke.mock.calls[0][0]).toBe('campaign_image');
    expect(invoker.invoke.mock.calls[1][0]).toBe('campaign_image_edit');
    expect(invoker.invoke.mock.calls[1][3]).toBe('primary');
    expect(result.imageBase64).toBe('base64-result');
  });

  it('erro de auth (não-capability) → NÃO aciona o fallback; propaga', async () => {
    const authError = new AiInvocationError({ kind: 'auth', retryable: false, message: 'invalid api key' });
    invoker.invoke.mockRejectedValue(authError);

    await expect(
      provider.generateImage({
        prompt: 'p',
        productImageDataUrl: 'data:image/png;base64,primary',
        attempt: 0,
        telemetry: makeTelemetry(),
      })
    ).rejects.toBe(authError);
    expect(invoker.invoke).toHaveBeenCalledTimes(1);
  });

  it('erro de capability SEM primary → NÃO aciona o fallback; propaga', async () => {
    invoker.invoke.mockRejectedValue(CAPABILITY_ERROR());

    await expect(
      provider.generateImage({ prompt: 'p', attempt: 0, telemetry: makeTelemetry() })
    ).rejects.toThrow('image_generation is not supported');
    expect(invoker.invoke).toHaveBeenCalledTimes(1);
  });

  it('fallback sem imagem → throw "Image API returned no image data"', async () => {
    invoker.invoke.mockResolvedValue({ model: 'gpt-image-2' });

    await expect(
      provider.generateImage({
        prompt: 'p',
        productImageDataUrl: 'data:image/png;base64,primary',
        attempt: 1,
        telemetry: makeTelemetry(),
      })
    ).rejects.toThrow('Image API returned no image data');
  });

  it('falha no Responses + sucesso no Images = DOIS envelopes (gpt-5.5 na falha, gpt-image-2 no fallback)', async () => {
    const envelopes: AiCallEnvelope[] = [];
    const adapters = {
      get: (protocol: string) => {
        if (protocol === 'responses') {
          return {
            protocol: 'responses',
            invoke: async () => {
              throw new AiInvocationError({
                kind: 'capability',
                retryable: false,
                message: 'image_generation is not supported for this model',
              });
            },
          };
        }
        return {
          protocol: 'images',
          invoke: async (_request: unknown, target: { model: string }) => ({
            imageBase64: 'base64-result',
            mimeType: 'image/png',
            model: target.model,
            usageMeta: { providerUsageSource: 'images.edit' },
          }),
        };
      },
    };
    const gateway = new AiGateway(new ModelRegistry(), adapters as never);
    const gatewayProvider = new OpenAIImageProvider(gateway);
    const telemetry = { ...makeTelemetry(), sink: { emit: (e: AiCallEnvelope) => { envelopes.push(e); } } };

    const result = await gatewayProvider.generateImage({
      prompt: 'p',
      productImageDataUrl: 'data:image/png;base64,primary',
      attempt: 0,
      telemetry,
    });

    expect(result.imageBase64).toBe('base64-result');
    expect(envelopes).toHaveLength(2);
    expect(envelopes[0]).toMatchObject({
      capability: 'campaign_image',
      protocol: 'responses',
      status: 'failed',
      model: 'gpt-5.5',
    });
    expect(envelopes[1]).toMatchObject({
      capability: 'campaign_image_edit',
      protocol: 'images',
      status: 'success',
      model: 'gpt-image-2',
    });
  });
});
