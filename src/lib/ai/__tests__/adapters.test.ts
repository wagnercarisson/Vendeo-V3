import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockChatCreate, mockResponsesCreate, mockImagesEdit, mockGenerateContent, mockToFile } =
  vi.hoisted(() => ({
    mockChatCreate: vi.fn(),
    mockResponsesCreate: vi.fn(),
    mockImagesEdit: vi.fn(),
    mockGenerateContent: vi.fn(),
    mockToFile: vi.fn(async (data: unknown, name: string, options: unknown) => ({
      data,
      name,
      options,
    })),
  }));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockChatCreate } };
    responses = { create: mockResponsesCreate };
    images = { edit: mockImagesEdit };
  },
  toFile: mockToFile,
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

import {
  AiInvocationError,
  normalizeAiError,
  sanitizeAiErrorMessage,
} from "../types";
import type { AiModelTarget } from "../model-resolver";
import {
  AuthConfigError,
  MalformedResponseError,
  NetworkError,
  Provider5xxError,
  ProviderRateLimitError,
  SafetyBlockError,
} from "@/lib/copy/errors";
import { ChatCompletionsAdapter } from "../adapters/chat-completions";
import { ResponsesAdapter } from "../adapters/responses";
import { ImagesAdapter } from "../adapters/images";
import { GeminiAdapter } from "../adapters/gemini";

const chatTarget: AiModelTarget = {
  provider: "openai",
  model: "gpt-4o",
  protocol: "chat-completions",
};
const responsesTarget: AiModelTarget = {
  provider: "openai",
  model: "gpt-5.5",
  protocol: "responses",
};
const imagesTarget: AiModelTarget = { provider: "openai", model: "gpt-image-2", protocol: "images" };
const geminiTarget: AiModelTarget = {
  provider: "gemini",
  model: "gemini-3.1-flash-lite",
  protocol: "gemini",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("GEMINI_API_KEY", "gemini-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AiInvocationError — contrato de erro preserva gates de fallback (D4.1)", () => {
  it("rate limit (429) → kind rate_limit e retryable", () => {
    const err = normalizeAiError(Object.assign(new Error("Too many requests"), { status: 429 }));
    expect(err).toBeInstanceOf(AiInvocationError);
    const inv = err as AiInvocationError;
    expect(inv.kind).toBe("rate_limit");
    expect(inv.httpStatus).toBe(429);
    expect(inv.retryable).toBe(true);
  });

  it("ProviderRateLimitError → rate_limit retryable", () => {
    const inv = normalizeAiError(new ProviderRateLimitError()) as AiInvocationError;
    expect(inv.kind).toBe("rate_limit");
    expect(inv.retryable).toBe(true);
  });

  it("timeout (AbortError) → kind timeout e retryable", () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    const inv = normalizeAiError(abort) as AiInvocationError;
    expect(inv.kind).toBe("timeout");
    expect(inv.retryable).toBe(true);
  });

  it("DOMException AbortError → timeout retryable", () => {
    const inv = normalizeAiError(new DOMException("aborted", "AbortError")) as AiInvocationError;
    expect(inv.kind).toBe("timeout");
    expect(inv.retryable).toBe(true);
  });

  it("network (fetch failed / ENOTFOUND) → network retryable", () => {
    const inv = normalizeAiError(
      Object.assign(new Error("fetch failed"), { code: "ENOTFOUND" }),
    ) as AiInvocationError;
    expect(inv.kind).toBe("network");
    expect(inv.retryable).toBe(true);
  });

  it("NetworkError → network retryable", () => {
    const inv = normalizeAiError(new NetworkError()) as AiInvocationError;
    expect(inv.kind).toBe("network");
    expect(inv.retryable).toBe(true);
  });

  it("5xx → provider_error retryable", () => {
    const inv = normalizeAiError(
      Object.assign(new Error("Bad gateway"), { status: 502 }),
    ) as AiInvocationError;
    expect(inv.kind).toBe("provider_error");
    expect(inv.httpStatus).toBe(502);
    expect(inv.retryable).toBe(true);
  });

  it("Provider5xxError → provider_error retryable", () => {
    const inv = normalizeAiError(new Provider5xxError()) as AiInvocationError;
    expect(inv.kind).toBe("provider_error");
    expect(inv.retryable).toBe(true);
  });

  it("auth (401/403) → auth NÃO retryable", () => {
    const unauthorized = normalizeAiError(
      Object.assign(new Error("Unauthorized"), { status: 401 }),
    ) as AiInvocationError;
    expect(unauthorized.kind).toBe("auth");
    expect(unauthorized.retryable).toBe(false);

    const forbidden = normalizeAiError(
      Object.assign(new Error("Forbidden"), { status: 403 }),
    ) as AiInvocationError;
    expect(forbidden.kind).toBe("auth");
    expect(forbidden.retryable).toBe(false);
  });

  it("AuthConfigError → auth NÃO retryable", () => {
    const inv = normalizeAiError(new AuthConfigError()) as AiInvocationError;
    expect(inv.kind).toBe("auth");
    expect(inv.retryable).toBe(false);
  });

  it("safety/content_filter → content_filter NÃO retryable", () => {
    const safety = normalizeAiError(new SafetyBlockError()) as AiInvocationError;
    expect(safety.kind).toBe("content_filter");
    expect(safety.retryable).toBe(false);

    const contentFilter = normalizeAiError(
      Object.assign(new Error("content_policy_violation"), { code: "content_filter" }),
    ) as AiInvocationError;
    expect(contentFilter.kind).toBe("content_filter");
    expect(contentFilter.retryable).toBe(false);
  });

  it("capability de tool (model_not_found) → kind capability (habilita images.edit)", () => {
    const inv = normalizeAiError(
      Object.assign(new Error("model_not_found: image_generation is not supported"), {
        status: 400,
      }),
    ) as AiInvocationError;
    expect(inv.kind).toBe("capability");
    expect(inv.retryable).toBe(false);
  });

  it("capability de response_format/json_schema → kind capability (habilita json_object)", () => {
    const inv = normalizeAiError(
      new Error("response_format json_schema is not supported by this model"),
    ) as AiInvocationError;
    expect(inv.kind).toBe("capability");
    expect(inv.retryable).toBe(false);
  });

  it("MalformedResponseError NÃO é normalizado (propaga o original)", () => {
    const original = new MalformedResponseError();
    const result = normalizeAiError(original);
    expect(result).toBe(original);
    expect(result).not.toBeInstanceOf(AiInvocationError);
  });

  it("erro desconhecido → provider_error NÃO retryable (não habilita fallback)", () => {
    const inv = normalizeAiError(new Error("algo inesperado")) as AiInvocationError;
    expect(inv.kind).toBe("provider_error");
    expect(inv.retryable).toBe(false);
  });

  it("preserva httpStatus/code e sanitiza message (sem chave/URL)", () => {
    const raw = new Error(
      "request to https://api.openai.com/v1 failed with key sk-abcdefghijklmnop (rate_limit)",
    );
    const inv = normalizeAiError(
      Object.assign(raw, { status: 429, code: "rate_limit" }),
    ) as AiInvocationError;
    expect(inv.kind).toBe("rate_limit");
    expect(inv.httpStatus).toBe(429);
    expect(inv.code).toBe("rate_limit");
    expect(inv.message).not.toContain("https://api.openai.com");
    expect(inv.message).not.toContain("sk-abcdefghijklmnop");
    expect(inv.message).toContain("[redacted-url]");
    expect(inv.message).toContain("[redacted-key]");
  });

  it("sanitizeAiErrorMessage remove bearer token", () => {
    const sanitized = sanitizeAiErrorMessage("Authorization: Bearer abc123def456ghi789");
    expect(sanitized).toBe("Authorization: Bearer [redacted]");
  });
});

describe("ChatCompletionsAdapter — contrato único (D2)", () => {
  it("normaliza content/usage e usa o modelo do alvo", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "texto gerado" } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        prompt_tokens_details: { cached_tokens: 2 },
      },
    });

    const result = await new ChatCompletionsAdapter().invoke(
      { prompt: "oi", system: "sys" },
      chatTarget,
    );

    expect(result.model).toBe("gpt-4o");
    expect(result.content).toBe("texto gerado");
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      cachedInputTokens: 2,
    });
    const params = mockChatCreate.mock.calls[0][0];
    expect(params.model).toBe("gpt-4o");
    expect(params.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "oi" },
    ]);
  });

  it("monta mensagem de visão quando há imagens", async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    await new ChatCompletionsAdapter().invoke(
      {
        prompt: "descreva",
        productImagesDataUrls: ["data:image/png;base64,AAA"],
        identityImageUrl: "https://example.com/identity.png",
      },
      chatTarget,
    );

    const messages = mockChatCreate.mock.calls[0][0].messages as Array<{ content: unknown }>;
    const userContent = messages[0].content as Array<{ type: string }>;
    expect(userContent[0]).toEqual({ type: "text", text: "descreva" });
    expect(userContent.filter((part) => part.type === "image_url")).toHaveLength(2);
  });

  it("adapter não decide o modelo — usa exatamente o modelo do alvo", async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "x" } }] });
    await new ChatCompletionsAdapter().invoke(
      { prompt: "p" },
      { provider: "openai", model: "modelo-do-registry", protocol: "chat-completions" },
    );
    expect(mockChatCreate.mock.calls[0][0].model).toBe("modelo-do-registry");
  });
});

describe("ResponsesAdapter — breakdown granular e tool image_generation (D2)", () => {
  it("normaliza output image/text e sinaliza responses.image_generation", async () => {
    mockResponsesCreate.mockResolvedValue({
      output: [{ type: "image_generation_call", result: "BASE64IMG" }],
      output_text: "",
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        input_tokens_details: { cached_tokens: 3, text_tokens: 40, image_tokens: 60 },
        output_tokens_details: { text_tokens: 50, image_tokens: 150 },
      },
    });

    const result = await new ResponsesAdapter().invoke(
      { prompt: "gerar arte", tools: "image_generation", size: "1024x1024", quality: "high" },
      responsesTarget,
    );

    expect(result.imageBase64).toBe("BASE64IMG");
    expect(result.mimeType).toBe("image/png");
    expect(result.model).toBe("gpt-5.5");
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      cachedInputTokens: 3,
      imageTokens: 150,
      inputTextTokens: 40,
      inputImageTokens: 60,
      outputTextTokens: 50,
      outputImageTokens: 150,
    });
    expect(result.usageMeta?.providerUsageSource).toBe("responses.image_generation");
    expect(result.usageMeta?.imageGenerationTool).toBe(true);
    expect(mockResponsesCreate.mock.calls[0][0].tools).toEqual([
      { type: "image_generation", size: "1024x1024", quality: "high" },
    ]);
  });

  it("usage normalizado no mesmo formato TokenUsage do chat-completions", async () => {
    mockResponsesCreate.mockResolvedValue({
      output: [],
      output_text: "texto",
      usage: { input_tokens: 12, output_tokens: 8 },
    });
    const result = await new ResponsesAdapter().invoke({ prompt: "oi" }, responsesTarget);
    expect(result.content).toBe("texto");
    expect(result.usage?.promptTokens).toBe(12);
    expect(result.usage?.completionTokens).toBe(8);
    expect(result.usage?.totalTokens).toBe(20);
  });
});

describe("ImagesAdapter — ausência de usage é explícita (D2/D7)", () => {
  it("images.edit sem usage marca providerUsageSource=images.edit (nunca zeros)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: "IMG" }] });

    const result = await new ImagesAdapter().invoke(
      {
        prompt: "editar",
        productImagesDataUrls: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
        identityImageUrl: "https://example.com/identity.png",
      },
      imagesTarget,
    );

    expect(result.imageBase64).toBe("IMG");
    expect(result.model).toBe("gpt-image-2");
    expect(result.usage).toBeUndefined();
    expect(result.usageMeta?.providerUsageSource).toBe("images.edit");

    const params = mockImagesEdit.mock.calls[0][0];
    expect(params.model).toBe("gpt-image-2");
    expect(params.image).toHaveLength(3);
    const names = (params.image as Array<{ name: string }>).map((file) => file.name);
    expect(names).toEqual(["product.png", "reference-1.png", "identity.png"]);
  });

  it("sem imagem primária → erro de domínio (MalformedResponseError)", async () => {
    await expect(
      new ImagesAdapter().invoke({ prompt: "editar" }, imagesTarget),
    ).rejects.toBeInstanceOf(MalformedResponseError);
  });
});

describe("GeminiAdapter — generateContent e usageMetadata", () => {
  it("normaliza content/usage e usa o modelo do alvo", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "texto gemini",
        usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3, totalTokenCount: 10 },
      },
    });

    const result = await new GeminiAdapter().invoke({ prompt: "oi", system: "sys" }, geminiTarget);

    expect(result.content).toBe("texto gemini");
    expect(result.model).toBe("gemini-3.1-flash-lite");
    expect(result.usage).toEqual({ promptTokens: 7, completionTokens: 3, totalTokens: 10 });
  });

  it("chave ausente → AuthConfigError", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(
      new GeminiAdapter().invoke({ prompt: "x" }, geminiTarget),
    ).rejects.toBeInstanceOf(AuthConfigError);
  });
});

describe("Adapters — AbortSignal propagado ao provider (D4)", () => {
  it("chat-completions propaga o signal", async () => {
    const controller = new AbortController();
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "x" } }] });

    await new ChatCompletionsAdapter().invoke(
      { prompt: "x", signal: controller.signal },
      chatTarget,
    );

    expect(mockChatCreate.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it("responses propaga o signal", async () => {
    const controller = new AbortController();
    mockResponsesCreate.mockResolvedValue({ output: [], output_text: "x" });

    await new ResponsesAdapter().invoke({ prompt: "x", signal: controller.signal }, responsesTarget);

    expect(mockResponsesCreate.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it("images propaga o signal", async () => {
    const controller = new AbortController();
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: "IMG" }] });

    await new ImagesAdapter().invoke(
      { prompt: "x", productImagesDataUrls: ["data:image/png;base64,AAA"], signal: controller.signal },
      imagesTarget,
    );

    expect(mockImagesEdit.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it("gemini propaga o signal", async () => {
    const controller = new AbortController();
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "g", usageMetadata: {} },
    });

    await new GeminiAdapter().invoke({ prompt: "x", signal: controller.signal }, geminiTarget);

    expect(mockGenerateContent.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });
});
