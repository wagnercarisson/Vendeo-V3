// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F60.4 — Regressão: o fluxo 1:1, prompts/compositor/políticas, o runtime de
 * imagem 1:1 (`createNewFlowImageGateway`) e os registries padrão permanecem
 * INALTERADOS. A prova é (a) temporal, comparando os caminhos protegidos contra
 * a base da fase (`PHASE_BASE_SHA..HEAD`) com controle POSITIVO no mesmo range,
 * e (b) comportamental, provando que os adapters de texto constroem o cliente
 * EXATAMENTE como antes quando nenhuma opção é passada.
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
    images = { edit: vi.fn(), generate: vi.fn() };
    constructor(config: unknown) {
      harness.configs.push(config);
    }
  },
}));

vi.mock("@/lib/ai/api-keys", () => ({ getApiKey: () => "sk-test" }));
vi.mock("server-only", () => ({}));

import type { AiModelTarget } from "@/lib/ai/model-resolver";
import { ChatCompletionsAdapter } from "@/lib/ai/adapters/chat-completions";
import { ResponsesAdapter } from "@/lib/ai/adapters/responses";
import { createDefaultAdapterRegistry } from "@/lib/ai/adapters/registry";

const PHASE_BASE_SHA = "55276323648797b79a121f3075b83b9469e25a69";

/** Caminhos protegidos do 1:1/F60 que NÃO podem mudar nesta fatia. */
const PROTECTED_PATHS = [
  "src/lib/product-1-1/prompt-composition.ts",
  "src/lib/product-1-1/prompt-base.ts",
  "src/lib/product-1-1/policies",
  "src/lib/product-1-1/intent-selection.ts",
  "src/lib/product-1-1/background-direction.ts",
  "src/lib/product-1-1/orchestration/generation-orchestrator.ts",
  "src/lib/ai/upstream-images-runtime.ts",
  "src/lib/ai/index.ts",
  "src/lib/ai/adapters/registry.ts",
];

/** Contratos F60/F60.1/F60.3 reutilizados sem alteração. */
const CONTRACT_PATHS = [
  "src/lib/campaign/composition-artifacts",
  "src/lib/campaign/vertical-expansion",
  "src/lib/campaign/square-preparation",
];

interface GitResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function git(args: string[]): GitResult {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function resolveBaseSha(): string {
  const candidate = process.env.PHASE_BASE_SHA ?? PHASE_BASE_SHA;
  const check = git(["cat-file", "-e", `${candidate}^{commit}`]);
  if (check.status === 0) return candidate;
  const mergeBase = git(["merge-base", "HEAD", "main"]);
  return mergeBase.stdout.trim();
}

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

describe("F60.4 regressão — default dos adapters textuais byte-idêntico", () => {
  it("ChatCompletionsAdapter sem opção constrói o cliente só com apiKey", async () => {
    await new ChatCompletionsAdapter().invoke({ prompt: "oi" }, CHAT_TARGET);
    expect(harness.configs).toHaveLength(1);
    expect(Object.keys(harness.configs[0] as Record<string, unknown>)).toEqual(["apiKey"]);
    expect(harness.configs[0]).toEqual({ apiKey: "sk-test" });
  });

  it("ResponsesAdapter sem opção constrói o cliente só com apiKey", async () => {
    await new ResponsesAdapter().invoke({ prompt: "oi" }, RESPONSES_TARGET);
    expect(harness.configs).toHaveLength(1);
    expect(Object.keys(harness.configs[0] as Record<string, unknown>)).toEqual(["apiKey"]);
    expect(harness.configs[0]).toEqual({ apiKey: "sk-test" });
  });
});

describe("F60.4 regressão — registry padrão constrói adapters sem argumento", () => {
  it("registry.ts usa `new ChatCompletionsAdapter()`/`new ResponsesAdapter()` sem opções", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/ai/adapters/registry.ts"),
      "utf8",
    );
    expect(source).toMatch(/new ChatCompletionsAdapter\(\)/);
    expect(source).toMatch(/new ResponsesAdapter\(\)/);
    expect(source).not.toMatch(/new ChatCompletionsAdapter\(\s*\{/);
    expect(source).not.toMatch(/new ResponsesAdapter\(\s*\{/);
  });

  it("createDefaultAdapterRegistry mantém o comportamento default", async () => {
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

describe("F60.4 regressão — caminhos protegidos sem diff contra PHASE_BASE_SHA", () => {
  it("o pathspec casa arquivos rastreados (não é um gate sempre-verde)", () => {
    const sha = resolveBaseSha();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);

    const listed = git(["ls-files", "--", ...PROTECTED_PATHS]);
    expect(listed.status).toBe(0);
    const tracked = listed.stdout.trim().split("\n").filter(Boolean);
    expect(tracked.length).toBeGreaterThan(0);

    // Cada arquivo individual protegido precisa existir e estar rastreado.
    for (const file of [
      "src/lib/product-1-1/prompt-composition.ts",
      "src/lib/product-1-1/prompt-base.ts",
      "src/lib/product-1-1/intent-selection.ts",
      "src/lib/product-1-1/background-direction.ts",
      "src/lib/product-1-1/orchestration/generation-orchestrator.ts",
      "src/lib/ai/upstream-images-runtime.ts",
      "src/lib/ai/index.ts",
      "src/lib/ai/adapters/registry.ts",
    ]) {
      expect(tracked, file).toContain(file);
    }
  });

  it("1:1/prompts/compositor/políticas/runtime 1:1 sem diff contra a base", () => {
    const sha = resolveBaseSha();
    const diff = git(["diff", "--quiet", `${sha}..HEAD`, "--", ...PROTECTED_PATHS]);
    expect(diff.status, diff.stderr).toBe(0);
  });

  it("contratos F60.1/F60.3/F60.2 sem diff contra a base", () => {
    const sha = resolveBaseSha();
    const diff = git(["diff", "--quiet", `${sha}..HEAD`, "--", ...CONTRACT_PATHS]);
    expect(diff.status, diff.stderr).toBe(0);
  });

  it("controle POSITIVO: o mesmo range detecta mudança real em square-base", () => {
    const sha = resolveBaseSha();
    const changed = git([
      "diff",
      "--name-only",
      `${sha}..HEAD`,
      "--",
      "src/lib/campaign/square-base",
    ]);
    expect(changed.status).toBe(0);
    expect(changed.stdout.trim().split("\n").filter(Boolean).length).toBeGreaterThan(0);
  });
});
