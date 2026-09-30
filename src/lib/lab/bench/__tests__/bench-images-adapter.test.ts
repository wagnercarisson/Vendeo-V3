// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { BenchImagesAdapter } from "@/lib/ai/adapters/bench-images";
import { ImagesAdapter } from "@/lib/ai/adapters/images";
import { defaultAdapterRegistry } from "@/lib/ai/adapters/registry";
import {
  buildBenchInvocationRequest,
  createBenchAdapterRegistry,
} from "@/lib/lab/bench/gateway/runtime";
import { resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";

/**
 * Adapter `Images` dedicado da bancada (F48.2.2, D8 / T-48-2-2-25).
 *
 * Prova que: (a) o adapter dedicado é usado no protocolo `images`; (b) o
 * `quality` do preset chega ao `images.edit` (a lacuna do adapter produtivo);
 * (c) as referências são enviadas na ordem recebida; (d) o `signal` é propagado;
 * (e) o branding não vira referência; e (f) o registry padrão continua
 * instanciando o `ImagesAdapter` produtivo (regressão).
 *
 * O SDK `openai` é **mockado** — nenhuma chamada de rede e nenhuma chamada paga.
 */

const { editCalls } = vi.hoisted(() => ({
  editCalls: [] as Array<{ params: Record<string, unknown>; options: Record<string, unknown> }>,
}));

vi.mock("openai", () => {
  class FakeOpenAI {
    readonly images = {
      edit: async (params: Record<string, unknown>, options: Record<string, unknown>) => {
        editCalls.push({ params, options });
        return {
          data: [{ b64_json: "ZmFrZS1pbWFnZQ==" }],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        };
      },
    };
    constructor(_options: unknown) {}
  }
  const toFile = async (data: Buffer, name: string, options: { type: string }) => ({
    data,
    name,
    options,
  });
  return { default: FakeOpenAI, toFile };
});

const PNG_A = "data:image/png;base64,QUFB";
const PNG_B = "data:image/png;base64,QkJC";

const TARGET = { provider: "openai", model: "gpt-image-2", protocol: "images" } as const;

beforeEach(() => {
  editCalls.length = 0;
});

describe("BenchImagesAdapter — quality propagado e referências explícitas", () => {
  it("propaga quality/model/size/n e as referências na ordem recebida", async () => {
    const adapter = new BenchImagesAdapter();
    const controller = new AbortController();

    const result = await adapter.invoke(
      {
        prompt: "prompt manual da bancada",
        productImagesDataUrls: [PNG_A, PNG_B],
        size: "1024x1024",
        quality: "medium",
        signal: controller.signal,
      },
      TARGET,
    );

    expect(editCalls).toHaveLength(1);
    const { params, options } = editCalls[0];
    expect(params.quality).toBe("medium");
    expect(params.model).toBe("gpt-image-2");
    expect(params.size).toBe("1024x1024");
    expect(params.prompt).toBe("prompt manual da bancada");
    expect(params.n).toBe(1);
    expect(options.signal).toBe(controller.signal);

    // Duas referências ⇒ array, na ordem [primary, referência].
    const files = params.image as Array<{ name: string }>;
    expect(Array.isArray(files)).toBe(true);
    expect(files.map((file) => file.name)).toEqual(["product.png", "reference-1.png"]);

    // Usage normalizado (nunca inventado).
    expect(result.usage?.promptTokens).toBe(10);
    expect(result.usage?.completionTokens).toBe(20);
    expect(result.usageMeta?.providerUsageSource).toBe("images.edit");
  });

  it("envia uma única referência como objeto (não array)", async () => {
    const adapter = new BenchImagesAdapter();
    await adapter.invoke(
      { prompt: "p", productImagesDataUrls: [PNG_A], size: "1024x1024", quality: "low" },
      TARGET,
    );
    const image = editCalls[0].params.image as { name: string };
    expect(Array.isArray(image)).toBe(false);
    expect(image.name).toBe("product.png");
    expect(editCalls[0].params.quality).toBe("low");
  });

  it("recusa sem imagem primária antes de qualquer chamada", async () => {
    const adapter = new BenchImagesAdapter();
    await expect(adapter.invoke({ prompt: "p" }, TARGET)).rejects.toThrow(
      "bench images.edit requer a imagem primária",
    );
    expect(editCalls).toHaveLength(0);
  });

  it("anexa a identidade canônica como ÚLTIMA referência (após o produto)", async () => {
    const adapter = new BenchImagesAdapter();
    await adapter.invoke(
      {
        prompt: "p",
        productImagesDataUrls: [PNG_A],
        identityImageUrl: "data:image/png;base64,TE9HTw==",
        quality: "low",
      },
      TARGET,
    );
    const files = editCalls[0].params.image as Array<{ name: string }>;
    // Ordem documentada: principal → adicionais → identidade (a identidade é a última).
    expect(Array.isArray(files)).toBe(true);
    expect(files.map((file) => file.name)).toEqual(["product.png", "identity.png"]);
  });

  it("sem identidade (text_only) envia apenas as imagens do produto", async () => {
    const adapter = new BenchImagesAdapter();
    await adapter.invoke(
      { prompt: "p", productImagesDataUrls: [PNG_A], quality: "low" },
      TARGET,
    );
    const image = editCalls[0].params.image as { name: string };
    expect(Array.isArray(image)).toBe(false);
    expect(image.name).toBe("product.png");
  });

  it("ordem principal → adicionais → identidade (identidade é a última)", async () => {
    const adapter = new BenchImagesAdapter();
    await adapter.invoke(
      {
        prompt: "p",
        productImagesDataUrls: [PNG_A, PNG_B],
        identityImageUrl: "data:image/png;base64,TE9HTw==",
        quality: "low",
      },
      TARGET,
    );
    const files = editCalls[0].params.image as Array<{ name: string }>;
    expect(files.map((file) => file.name)).toEqual([
      "product.png",
      "reference-1.png",
      "identity.png",
    ]);
  });
});

describe("createBenchAdapterRegistry — adapter dedicado apenas no runtime da bancada", () => {
  it("resolve images para o BenchImagesAdapter", () => {
    const registry = createBenchAdapterRegistry();
    expect(registry.get("images")).toBeInstanceOf(BenchImagesAdapter);
  });

  it("delega os demais protocolos ao registry padrão (read-only)", () => {
    const registry = createBenchAdapterRegistry();
    expect(registry.get("responses")).toBe(defaultAdapterRegistry.get("responses"));
    expect(registry.get("chat-completions")).toBe(defaultAdapterRegistry.get("chat-completions"));
  });
});

describe("registry padrão permanece intocado (regressão T-48-2-2-25)", () => {
  it("defaultAdapterRegistry.get('images') é o ImagesAdapter produtivo, não o da bancada", () => {
    const production = defaultAdapterRegistry.get("images");
    expect(production).toBeInstanceOf(ImagesAdapter);
    expect(production).not.toBeInstanceOf(BenchImagesAdapter);
  });
});

describe("buildBenchInvocationRequest — parâmetros explícitos e identidade", () => {
  it("usa size/quality do preset e omite identityImageUrl quando ausente", () => {
    const preset = resolveBenchPreset("gpt-image-2-medium");
    const request = buildBenchInvocationRequest({
      preset,
      prompt: "p",
      productImagesDataUrls: [PNG_A, PNG_B],
    });

    expect(request.size).toBe(preset.size);
    expect(request.quality).toBe("medium");
    expect(request.productImagesDataUrls).toEqual([PNG_A, PNG_B]);
    expect(request).not.toHaveProperty("identityImageUrl");
  });

  it("inclui identityImageUrl quando fornecido (data URL da identidade)", () => {
    const preset = resolveBenchPreset("gpt-image-2-medium");
    const identity = "data:image/png;base64,TE9HTw==";
    const request = buildBenchInvocationRequest({
      preset,
      prompt: "p",
      productImagesDataUrls: [PNG_A],
      identityImageUrl: identity,
    });

    expect(request.identityImageUrl).toBe(identity);
  });
});
