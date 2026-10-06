import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Testes do adapter de imagem do **novo fluxo** Produto 1:1 (F56.1, D-20).
 *
 * SDK (`openai`) mockado — nenhuma chamada real ao provider, nenhum custo. Os
 * testes provam que o `quality` do par configurado chega ao wire (`images.edit`),
 * que o fallback propaga a própria qualidade (sem reutilizar a do principal) e
 * que o `ImagesAdapter` **legado** continua sem `quality` (isolamento D-07/D-20).
 */

const { mockImagesEdit, mockToFile } = vi.hoisted(() => ({
  mockImagesEdit: vi.fn(),
  mockToFile: vi.fn(async (data: unknown, name: string, options: unknown) => ({
    data,
    name,
    options,
  })),
}));

vi.mock("openai", () => ({
  default: class {
    images = { edit: mockImagesEdit };
  },
  toFile: mockToFile,
}));

import { UpstreamImagesAdapter } from "../adapters/upstream-images";
import { ImagesAdapter } from "../adapters/images";
import { AiInvocationError } from "../types";
import type { AiModelTarget } from "../model-resolver";
import { MalformedResponseError } from "@/lib/copy/errors";

const primaryTarget: AiModelTarget = {
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
};
const fallbackTarget: AiModelTarget = {
  provider: "openai",
  model: "gpt-image-2",
  protocol: "images",
};

const dataUrl = "data:image/png;base64,AAA";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("UpstreamImagesAdapter — qualidade chega ao wire (F56.1 D-20)", () => {
  it("propaga quality=medium exatamente ao images.edit (sem omitir/substituir)", async () => {
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: "IMG" }] });

    const result = await new UpstreamImagesAdapter().invoke(
      { prompt: "gerar", productImagesDataUrls: [dataUrl], quality: "medium" },
      primaryTarget,
    );

    expect(result.imageBase64).toBe("IMG");
    const params = mockImagesEdit.mock.calls[0][0] as { quality?: string; model?: string };
    expect(params.quality).toBe("medium");
    expect(params.model).toBe("gpt-image-2.5-sunburst");
  });

  it("fallback propaga a própria qualidade, sem reutilizar a do principal", async () => {
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: "IMG" }] });
    const adapter = new UpstreamImagesAdapter();

    await adapter.invoke(
      { prompt: "p", productImagesDataUrls: [dataUrl], quality: "medium" },
      primaryTarget,
    );
    await adapter.invoke(
      { prompt: "p", productImagesDataUrls: [dataUrl], quality: "low" },
      fallbackTarget,
    );

    const first = mockImagesEdit.mock.calls[0][0] as { quality?: string; model?: string };
    const second = mockImagesEdit.mock.calls[1][0] as { quality?: string; model?: string };
    expect(first.quality).toBe("medium");
    expect(second.quality).toBe("low");
    expect(second.model).toBe("gpt-image-2");
  });

  it("qualidade ausente é defeito: falha sem chamar o provider", async () => {
    await expect(
      new UpstreamImagesAdapter().invoke(
        { prompt: "p", productImagesDataUrls: [dataUrl] },
        primaryTarget,
      ),
    ).rejects.toBeInstanceOf(AiInvocationError);
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it("qualidade vazia/em branco é defeito (não envia modelo sem quality)", async () => {
    await expect(
      new UpstreamImagesAdapter().invoke(
        { prompt: "p", productImagesDataUrls: [dataUrl], quality: "   " },
        primaryTarget,
      ),
    ).rejects.toMatchObject({ kind: "capability", retryable: false });
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it("sem imagem primária → erro de domínio (MalformedResponseError)", async () => {
    await expect(
      new UpstreamImagesAdapter().invoke({ prompt: "p", quality: "medium" }, primaryTarget),
    ).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it("normaliza usage retornado pelo images.edit (nunca descarta)", async () => {
    mockImagesEdit.mockResolvedValue({
      data: [{ b64_json: "IMG" }],
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    });

    const result = await new UpstreamImagesAdapter().invoke(
      { prompt: "p", productImagesDataUrls: [dataUrl], quality: "medium" },
      primaryTarget,
    );

    expect(result.usage?.totalTokens).toBe(15);
    expect(result.usageMeta?.providerUsageSource).toBe("images.edit");
  });

  it("normaliza erro do provider via normalizeAiError (rate limit → kind rate_limit)", async () => {
    mockImagesEdit.mockRejectedValue(
      Object.assign(new Error("Too many requests"), { status: 429 }),
    );

    await expect(
      new UpstreamImagesAdapter().invoke(
        { prompt: "p", productImagesDataUrls: [dataUrl], quality: "medium" },
        primaryTarget,
      ),
    ).rejects.toMatchObject({ kind: "rate_limit", retryable: true });
  });
});

describe("ImagesAdapter legado — continua sem quality (isolamento D-07/D-20)", () => {
  it("images.edit do adapter legado NÃO recebe quality mesmo com request.quality", async () => {
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: "IMG" }] });

    await new ImagesAdapter().invoke(
      { prompt: "p", productImagesDataUrls: [dataUrl], quality: "medium" },
      fallbackTarget,
    );

    const params = mockImagesEdit.mock.calls[0][0] as { quality?: string };
    expect(params.quality).toBeUndefined();
  });
});
