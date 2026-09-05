import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Higiene de fetch (MQJ): captura o fetch original no escopo do módulo e
// restaura em afterEach — o mock de global.fetch não pode vazar entre testes.
const originalFetch = global.fetch;

describe('OpenAIImageProvider — identityImageUrl', () => {
  let provider: OpenAIImageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIImageProvider('test-model', 'test-fallback-model');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('name is "openai"', () => {
    expect(provider.name).toBe('openai');
  });

  it('1: attempt >= 1 com productImageDataUrl + identityImageUrl → fallback envia product + identity ao images.edit', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,abc',
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 1,
    };

    // Mock fetch for identity URL — identidade carregada com sucesso (AC2)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    });

    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'base64-result' }] });

    const result = await provider.generateImage(input);

    // Resultado do fallback
    expect(result.imageBase64).toBe('base64-result');
    expect(result.model).toBe('test-fallback-model');

    // Identidade foi buscada e enviada JUNTO com o produto (array de 2)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/logo.png');

    const body = mockImagesEdit.mock.calls[0][0];
    expect(Array.isArray(body.image)).toBe(true);
    expect(body.image).toHaveLength(2);
    expect(body.image[0].filename).toBe('product.png');
    expect(body.image[1].filename).toBe('identity.png');
    expect(body.prompt).toBe(input.prompt);
    expect(body.model).toBe('test-fallback-model');
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

describe('OpenAIImageProvider — F41 D7 (N input_image) / MQJ fallback multi-referência', () => {
  let provider: OpenAIImageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIImageProvider('test-model', 'test-fallback-model');
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

  it('18: productImagesDataUrls com 2+ itens + attempt>=1 → fallback envia TODAS as imagens (primary + auxiliar) ao images.edit', async () => {
    // MQJ (INVERTE o gate F41 D7): o fallback não degrada mais a fidelidade —
    // images.edit recebe um array com primary + auxiliares (gate relaxado para
    // "exige primary"; SDK v6.39 suporta image: Uploadable | Array<Uploadable>).
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/png;base64,aux1',
      ],
      attempt: 1,
    };

    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'base64-result' }] });

    const result = await provider.generateImage(input);

    expect(mockImagesEdit).toHaveBeenCalledTimes(1);
    expect(mockResponsesCreate).not.toHaveBeenCalled();

    const body = mockImagesEdit.mock.calls[0][0];
    expect(Array.isArray(body.image)).toBe(true);
    expect(body.image).toHaveLength(2);
    expect(body.image[0].filename).toBe('product.png');
    expect(body.image[1].filename).toBe('reference-1.png');
    expect(body.prompt).toBe(input.prompt);
    expect(result.imageBase64).toBe('base64-result');
  });

  it('18b: AMBOS os campos + erro isResponsesApiError pós-erro → fallback envia lista deduplicada (primary não duplicada)', async () => {
    // REPLICA o shape real de produção: o service mantém productImageDataUrl
    // (legado, === lista[0]) E productImagesDataUrls (lista N). attempt=0 →
    // passa pelo pre-response gate → responses.create lança erro
    // isResponsesApiError → o CATCH (gate 2) decide pelo fallback. A dedupe
    // (primary === lista[0]) evita enviar a primary 2x — sem terceiro arquivo.
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
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'base64-result' }] });

    const result = await provider.generateImage(input);

    expect(mockImagesEdit).toHaveBeenCalledTimes(1);

    const body = mockImagesEdit.mock.calls[0][0];
    expect(Array.isArray(body.image)).toBe(true);
    expect(body.image).toHaveLength(2);
    expect(body.image[0].filename).toBe('product.png');
    expect(body.image[1].filename).toBe('reference-1.png');
    expect(result.imageBase64).toBe('base64-result');
  });

  it('19: legado (só productImageDataUrl, sem lista) + attempt>=1 → fallback com image ESCALAR (wire format atual preservado — AC1)', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,abc',
      attempt: 1,
    };

    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'base64-result' }] });

    const result = await provider.generateImage(input);

    expect(mockImagesEdit).toHaveBeenCalledTimes(1);

    const body = mockImagesEdit.mock.calls[0][0];
    expect(Array.isArray(body.image)).toBe(false);
    expect(body.image.filename).toBe('product.png');
    expect(body.prompt).toBe(input.prompt);
    expect(result.imageBase64).toBe('base64-result');
  });

  it('19b: productImagesDataUrls:[primary] sem productImageDataUrl + attempt>=1 → fallback resolve a primary da lista (escalar, sem "Invalid productImageDataUrl")', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: ['data:image/png;base64,abc'],
      attempt: 1,
    };

    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'base64-result' }] });

    const result = await provider.generateImage(input);

    expect(mockImagesEdit).toHaveBeenCalledTimes(1);

    const body = mockImagesEdit.mock.calls[0][0];
    expect(Array.isArray(body.image)).toBe(false);
    expect(body.image.filename).toBe('product.png');
    expect(result.imageBase64).toBe('base64-result');
  });

  it('20: multi-referência completa (AC3) — primary + 2 auxiliares + identity → 4 arquivos na ordem determinística [product, reference-1, reference-2, identity]', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/webp;base64,aux1',
        'data:image/png;base64,aux2',
      ],
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 1,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    });

    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'base64-result' }] });

    const result = await provider.generateImage(input);

    expect(result.imageBase64).toBe('base64-result');

    const body = mockImagesEdit.mock.calls[0][0];
    expect(Array.isArray(body.image)).toBe(true);
    expect(body.image).toHaveLength(4);
    expect(body.image.map((f: { filename: string }) => f.filename)).toEqual([
      'product.png',
      'reference-1.webp',
      'reference-2.png',
      'identity.png',
    ]);
    // Tipos preservados por arquivo (png | webp suportados pelo SDK)
    expect(body.image[0].type).toBe('image/png');
    expect(body.image[1].type).toBe('image/webp');
    expect(body.image[2].type).toBe('image/png');
    expect(body.image[3].type).toBe('image/png');
    expect(body.prompt).toBe(input.prompt);
  });

  it('21: fetch da identidade falha → bloqueio explícito PT-BR (AC2) — images.edit NÃO é chamado (nunca gera arte sem a assinatura visual)', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/png;base64,abc',
      identityImageUrl: 'https://example.com/logo.png',
      attempt: 1,
    };

    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    await expect(provider.generateImage(input)).rejects.toThrow(
      'Falha ao carregar imagem de identidade para a geração de fallback'
    );
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it('22: auxiliar malformada → erro explícito sem descarte silencioso — images.edit NÃO é chamado', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImagesDataUrls: [
        'data:image/png;base64,primary',
        'data:image/gif;base64,xxx',
      ],
      attempt: 1,
    };

    await expect(provider.generateImage(input)).rejects.toThrow(
      'Invalid product reference image data URL. Expected data:image/png|jpeg|webp;base64,...'
    );
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it('23: primary inválida (sem lista) → mensagem existente preservada — images.edit NÃO é chamado', async () => {
    const input: ImageProviderInput = {
      prompt: 'test prompt',
      productImageDataUrl: 'data:image/gif;base64,xxx',
      attempt: 1,
    };

    await expect(provider.generateImage(input)).rejects.toThrow(
      'Invalid productImageDataUrl. Expected data:image/png|jpeg|webp;base64,...'
    );
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });
});
