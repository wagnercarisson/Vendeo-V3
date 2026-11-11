// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * F60.3 — opções ADITIVAS do adapter de imagens.
 *
 * Arquivo novo (o `upstream-images-adapter.test.ts` do 1:1 NÃO é editado): aqui
 * provamos que `maxRetries` e `preserveUsageWithoutImage` são opt-in e que o
 * default permanece byte-idêntico (cliente com apenas `apiKey`; resposta sem
 * imagem continua lançando `MalformedResponseError`).
 *
 * Nenhum `openai` real: o loader recebe um importador fake e o adapter recebe um
 * loader fake com cliente `images.edit` controlado.
 */

import { MalformedResponseError } from "@/lib/copy/errors";
import {
  createOpenAiImagesSdkLoader,
  UpstreamImagesAdapter,
  type UpstreamImagesSdkLoader,
  type UpstreamImagesSdkModule,
} from "../adapters/upstream-images";
import { AiInvocationError } from "../types";
import type { AiModelTarget } from "../model-resolver";

const TARGET: AiModelTarget = {
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
};

const DATA_URL = "data:image/png;base64,AAAA";

function makeImportModule(captured: Record<string, unknown>[]): () => Promise<UpstreamImagesSdkModule> {
  return async () => ({
    default: class {
      constructor(config: Record<string, unknown>) {
        captured.push(config);
      }
    },
    toFile: async () => ({ fake: true }),
  });
}

interface FakeLoaderHandle {
  readonly loader: UpstreamImagesSdkLoader;
  readonly edit: ReturnType<typeof vi.fn>;
}

function makeFakeLoader(response: unknown): FakeLoaderHandle {
  const edit = vi.fn(async (_body: unknown, _options?: unknown) => response);
  const loader: UpstreamImagesSdkLoader = async () => ({
    client: { images: { edit } },
    toFile: async (data, name, options) => ({ data, name, options }),
  });
  return { loader, edit };
}

describe("createOpenAiImagesSdkLoader — maxRetries opt-in", () => {
  it("constrói o cliente com { apiKey, maxRetries: 0 } quando informado", async () => {
    const captured: Record<string, unknown>[] = [];
    const loader = createOpenAiImagesSdkLoader({
      maxRetries: 0,
      importModule: makeImportModule(captured),
    });

    await loader("sk-from-adapter");

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ apiKey: "sk-from-adapter", maxRetries: 0 });
  });

  it("sem opções constrói o cliente com APENAS apiKey (default byte-idêntico)", async () => {
    const captured: Record<string, unknown>[] = [];
    const loader = createOpenAiImagesSdkLoader({ importModule: makeImportModule(captured) });

    await loader("sk-from-adapter");

    expect(Object.keys(captured[0])).toEqual(["apiKey"]);
    expect(captured[0]).toEqual({ apiKey: "sk-from-adapter" });
  });
});

describe("UpstreamImagesAdapter — preservação de usage sem imagem (opt-in)", () => {
  const usageResponse = {
    usage: {
      input_tokens: 11,
      output_tokens: 7,
      total_tokens: 18,
      input_tokens_details: { text_tokens: 11, image_tokens: 0 },
      output_tokens_details: { text_tokens: 0, image_tokens: 7 },
    },
  };

  it("com preserveUsageWithoutImage devolve imageBase64 vazio + usage e não lança", async () => {
    const { loader } = makeFakeLoader(usageResponse);
    const adapter = new UpstreamImagesAdapter(loader, {
      preserveUsageWithoutImage: true,
    });

    const result = await adapter.invoke(
      { prompt: "p", productImagesDataUrls: [DATA_URL], quality: "low" },
      TARGET,
    );

    expect(result.imageBase64).toBe("");
    expect(result.usage).toBeDefined();
    expect(result.usage?.totalTokens).toBe(18);
    expect(result.usageMeta?.providerUsageSource).toBe("images.edit");
  });

  it("sem a opção continua lançando MalformedResponseError com a mensagem atual", async () => {
    const { loader } = makeFakeLoader(usageResponse);
    const adapter = new UpstreamImagesAdapter(loader);

    const error = await adapter
      .invoke({ prompt: "p", productImagesDataUrls: [DATA_URL], quality: "low" }, TARGET)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MalformedResponseError);
    expect((error as Error).message).toBe("Image API returned no image data");
  });

  it("mantém o gate de quality e o corpo do images.edit (n: 1, size default)", async () => {
    const { loader, edit } = makeFakeLoader({ data: [{ b64_json: "IMG" }] });
    const adapter = new UpstreamImagesAdapter(loader);

    await adapter.invoke(
      { prompt: "p", productImagesDataUrls: [DATA_URL], quality: "low" },
      TARGET,
    );

    expect(edit).toHaveBeenCalledTimes(1);
    const body = edit.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      model: TARGET.model,
      prompt: "p",
      size: "1024x1024",
      quality: "low",
      n: 1,
    });

    await expect(
      new UpstreamImagesAdapter(loader).invoke(
        { prompt: "p", productImagesDataUrls: [DATA_URL] },
        TARGET,
      ),
    ).rejects.toBeInstanceOf(AiInvocationError);
  });
});
