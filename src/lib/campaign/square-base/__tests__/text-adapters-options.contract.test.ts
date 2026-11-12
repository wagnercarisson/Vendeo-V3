// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F60.4 — Task 2: opção ADITIVA `maxRetries` nos adapters de texto.
 *
 * Prova que:
 *  - sem a opção o cliente OpenAI é construído EXATAMENTE como antes
 *    (`Object.keys(config) === ["apiKey"]`);
 *  - com `{ maxRetries: 0 }` o payload é `{ apiKey, maxRetries: 0 }`;
 *  - o registry padrão continua construindo os adapters SEM argumento.
 *
 * `openai` é mockado: nenhuma requisição real acontece.
 */

const harness = vi.hoisted(() => {
  const configs: unknown[] = [];
  const chatCreate = vi.fn(async () => ({
    choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }));
  const responsesCreate = vi.fn(async () => ({ output_text: "ok" }));
  return { configs, chatCreate, responsesCreate };
});

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = { completions: { create: harness.chatCreate } };
    responses = { create: harness.responsesCreate };
    constructor(config: unknown) {
      harness.configs.push(config);
    }
  },
}));

vi.mock("@/lib/ai/api-keys", () => ({ getApiKey: () => "sk-test" }));

import type { AiModelTarget } from "@/lib/ai/model-resolver";
import { ChatCompletionsAdapter } from "@/lib/ai/adapters/chat-completions";
import { ResponsesAdapter } from "@/lib/ai/adapters/responses";
import { createDefaultAdapterRegistry } from "@/lib/ai/adapters/registry";

const CHAT_TARGET: AiModelTarget = {
  provider: "openai",
  model: "gpt-4o",
  protocol: "chat-completions",
};

const RESPONSES_TARGET: AiModelTarget = {
  provider: "openai",
  model: "gpt-4o",
  protocol: "responses",
};

beforeEach(() => {
  harness.configs.length = 0;
  harness.chatCreate.mockClear();
  harness.responsesCreate.mockClear();
});

describe("ChatCompletionsAdapter — maxRetries aditivo", () => {
  it("sem opção constrói o cliente com APENAS apiKey (default byte-idêntico)", async () => {
    await new ChatCompletionsAdapter().invoke({ prompt: "oi" }, CHAT_TARGET);

    expect(harness.configs).toHaveLength(1);
    expect(Object.keys(harness.configs[0] as Record<string, unknown>)).toEqual(["apiKey"]);
    expect(harness.configs[0]).toEqual({ apiKey: "sk-test" });
  });

  it("com { maxRetries: 0 } envia apiKey + maxRetries literal", async () => {
    await new ChatCompletionsAdapter({ maxRetries: 0 }).invoke({ prompt: "oi" }, CHAT_TARGET);

    expect(harness.configs).toHaveLength(1);
    expect(Object.keys(harness.configs[0] as Record<string, unknown>)).toEqual([
      "apiKey",
      "maxRetries",
    ]);
    expect(harness.configs[0]).toEqual({ apiKey: "sk-test", maxRetries: 0 });
  });
});

describe("ResponsesAdapter — maxRetries aditivo", () => {
  it("sem opção constrói o cliente com APENAS apiKey (default byte-idêntico)", async () => {
    await new ResponsesAdapter().invoke({ prompt: "oi" }, RESPONSES_TARGET);

    expect(harness.configs).toHaveLength(1);
    expect(Object.keys(harness.configs[0] as Record<string, unknown>)).toEqual(["apiKey"]);
    expect(harness.configs[0]).toEqual({ apiKey: "sk-test" });
  });

  it("com { maxRetries: 0 } envia apiKey + maxRetries literal", async () => {
    await new ResponsesAdapter({ maxRetries: 0 }).invoke({ prompt: "oi" }, RESPONSES_TARGET);

    expect(harness.configs).toHaveLength(1);
    expect(Object.keys(harness.configs[0] as Record<string, unknown>)).toEqual([
      "apiKey",
      "maxRetries",
    ]);
    expect(harness.configs[0]).toEqual({ apiKey: "sk-test", maxRetries: 0 });
  });
});

describe("registry padrão continua sem opção", () => {
  it("createDefaultAdapterRegistry constrói os adapters de texto sem argumento", async () => {
    const registry = createDefaultAdapterRegistry();
    const chat = registry.get("chat-completions");
    const responses = registry.get("responses");
    expect(chat).toBeInstanceOf(ChatCompletionsAdapter);
    expect(responses).toBeInstanceOf(ResponsesAdapter);

    await chat?.invoke({ prompt: "oi" }, CHAT_TARGET);
    await responses?.invoke({ prompt: "oi" }, RESPONSES_TARGET);

    expect(harness.configs).toHaveLength(2);
    for (const config of harness.configs) {
      expect(Object.keys(config as Record<string, unknown>)).toEqual(["apiKey"]);
    }
  });
});

describe("fonte — leitura condicional sem default numérico embutido", () => {
  const files = ["chat-completions.ts", "responses.ts"].map((file) =>
    readFileSync(
      path.resolve(process.cwd(), "src", "lib", "ai", "adapters", file),
      "utf8",
    ),
  );

  it("cada adapter lê maxRetries condicionalmente", () => {
    for (const source of files) {
      expect(source).toContain("maxRetries?: number");
      expect(source).toMatch(/this\.options\.maxRetries === undefined/);
      expect(source).not.toMatch(/maxRetries\s*(?:\?\?|=)\s*\d/);
    }
  });
});
