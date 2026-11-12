// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F60.4 — Task 2: invoker de copy SEM retry oculto.
 *
 * Prova que o invoker do módulo compõe `ChatCompletionsAdapter`/`ResponsesAdapter`
 * com `maxRetries: 0`, usa Gemini com uma única `generateContent`, NÃO registra o
 * protocolo de imagem e não altera o gateway/registry padrão.
 */

const openaiHarness = vi.hoisted(() => {
  const configs: unknown[] = [];
  const chatCreate = vi.fn(async () => ({
    choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }));
  const responsesCreate = vi.fn(async () => ({ output_text: "ok" }));
  return { configs, chatCreate, responsesCreate };
});

const geminiHarness = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/ai/api-keys", () => ({
  getApiKey: (provider: string) => (provider === "gemini" ? "g-test" : "sk-test"),
}));

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = { completions: { create: openaiHarness.chatCreate } };
    responses = { create: openaiHarness.responsesCreate };
    constructor(config: unknown) {
      openaiHarness.configs.push(config);
    }
  },
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class FakeGoogleGenerativeAI {
    constructor(_apiKey: string) {}
    getGenerativeModel(_config: unknown) {
      return { generateContent: geminiHarness.generateContent };
    }
  },
}));

import type { AiModelResolver, AiProtocol } from "@/lib/ai/model-resolver";
import { defaultAdapterRegistry } from "@/lib/ai/adapters/registry";
import { AiInvocationError, type AiTelemetryContext } from "@/lib/ai/types";

import { createSquareBaseCopyInvoker, squareBaseCopyInvoker } from "../copy-transport";

const TELEMETRY: AiTelemetryContext = {
  operationRunId: "22222222-2222-4222-8222-222222222222",
  operationRunType: "campaign_delivery",
  traceId: "trace-1",
  storeId: "33333333-3333-4333-8333-333333333333",
  sink: { emit: async () => {} },
};

function resolverFor(protocol: AiProtocol): AiModelResolver {
  return {
    resolve: async (capability) => ({
      capability,
      segment: "text",
      primary: {
        provider: protocol === "gemini" ? "gemini" : "openai",
        model: "copy-model",
        protocol,
      },
    }),
    listCapabilities: () => ["campaign_copy"],
  };
}

beforeEach(() => {
  openaiHarness.configs.length = 0;
  openaiHarness.chatCreate.mockClear();
  openaiHarness.responsesCreate.mockClear();
  openaiHarness.chatCreate.mockImplementation(async () => ({
    choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }));
  geminiHarness.generateContent.mockReset();
  geminiHarness.generateContent.mockResolvedValue({
    response: {
      text: () => "ok",
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    },
  });
});

describe("createSquareBaseCopyInvoker — registry no-retry", () => {
  it("chat-completions é construído com maxRetries: 0 e faz UMA requisição", async () => {
    const invoker = createSquareBaseCopyInvoker({ resolver: resolverFor("chat-completions") });

    await invoker.invoke("campaign_copy", { prompt: "oi" }, TELEMETRY);

    expect(openaiHarness.configs).toHaveLength(1);
    expect(openaiHarness.configs[0]).toEqual({ apiKey: "sk-test", maxRetries: 0 });
    expect(openaiHarness.chatCreate).toHaveBeenCalledTimes(1);
  });

  it("responses é construído com maxRetries: 0 e faz UMA requisição", async () => {
    const invoker = createSquareBaseCopyInvoker({ resolver: resolverFor("responses") });

    await invoker.invoke("campaign_copy", { prompt: "oi" }, TELEMETRY);

    expect(openaiHarness.configs).toHaveLength(1);
    expect(openaiHarness.configs[0]).toEqual({ apiKey: "sk-test", maxRetries: 0 });
    expect(openaiHarness.responsesCreate).toHaveBeenCalledTimes(1);
  });

  it("Gemini executa uma única generateContent", async () => {
    const invoker = createSquareBaseCopyInvoker({ resolver: resolverFor("gemini") });

    await invoker.invoke("campaign_copy", { prompt: "oi" }, TELEMETRY);

    expect(geminiHarness.generateContent).toHaveBeenCalledTimes(1);
    // Nenhum cliente OpenAI é construído no caminho Gemini.
    expect(openaiHarness.configs).toHaveLength(0);
  });

  it("falha transitória do provider NÃO produz segunda requisição", async () => {
    openaiHarness.chatCreate.mockRejectedValueOnce(
      Object.assign(new Error("network"), { retryable: true }),
    );
    const invoker = createSquareBaseCopyInvoker({ resolver: resolverFor("chat-completions") });

    await expect(
      invoker.invoke("campaign_copy", { prompt: "oi" }, TELEMETRY),
    ).rejects.toBeTruthy();

    expect(openaiHarness.configs).toHaveLength(1);
    expect(openaiHarness.chatCreate).toHaveBeenCalledTimes(1);
  });

  it("não registra o protocolo de imagem (adapter ausente)", async () => {
    const invoker = createSquareBaseCopyInvoker({ resolver: resolverFor("images") });

    const error = await invoker
      .invoke("campaign_copy", { prompt: "oi" }, TELEMETRY)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AiInvocationError);
    expect((error as AiInvocationError).kind).toBe("capability");
    expect(openaiHarness.configs).toHaveLength(0);
    expect(openaiHarness.chatCreate).not.toHaveBeenCalled();
  });

  it("a instância de produção existe e expõe invoke/hasFallback", () => {
    expect(typeof squareBaseCopyInvoker.invoke).toBe("function");
    expect(typeof squareBaseCopyInvoker.hasFallback).toBe("function");
  });
});

describe("gateway/registry padrão permanecem intactos", () => {
  it("o registry padrão continua com os adapters legados de texto", () => {
    expect(defaultAdapterRegistry.get("chat-completions")?.protocol).toBe("chat-completions");
    expect(defaultAdapterRegistry.get("responses")?.protocol).toBe("responses");
    expect(defaultAdapterRegistry.get("gemini")?.protocol).toBe("gemini");
    expect(defaultAdapterRegistry.get("images")?.protocol).toBe("images");
  });

  const source = readFileSync(
    path.resolve(process.cwd(), "src", "lib", "campaign", "square-base", "copy-transport.ts"),
    "utf8",
  );

  it("não atribui nem referencia o gateway/registry padrão", () => {
    expect(source).not.toMatch(/defaultAiGateway/);
    expect(source).not.toMatch(/defaultAdapterRegistry/);
  });

  it("registra apenas texto e passa maxRetries: 0 somente nos adapters OpenAI de texto", () => {
    expect(source).not.toMatch(/images/);
    expect(source).toMatch(/new ChatCompletionsAdapter\(\{ maxRetries: 0 \}\)/);
    expect(source).toMatch(/new ResponsesAdapter\(\{ maxRetries: 0 \}\)/);
    expect(source).toMatch(/new GeminiAdapter\(\)/);
  });
});
