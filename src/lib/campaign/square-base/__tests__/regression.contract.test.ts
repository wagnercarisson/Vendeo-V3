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

/**
 * Quick 261125-i06 — exceção ÚNICA e imutável do guard de regressão.
 *
 * O orquestrador recebeu o wiring `textOnlyIdentity` no commit imutável
 * `346d16d5…`. A exceção só é válida quando o conteúdo do arquivo no worktree
 * continua idêntico a esse commit; o nome do caminho, sozinho, nunca autoriza.
 * Qualquer alteração adicional no arquivo ou em outro caminho protegido falha.
 */
const IMMUTABLE_ORCHESTRATOR = {
  path: "src/lib/product-1-1/orchestration/generation-orchestrator.ts",
  commit: "346d16d5536f9fbae7abba2bf1d99bda9539c5a5",
} as const;

const IMMUTABLE_ORCHESTRATOR_BY_PATH = new Map<string, string>([
  [IMMUTABLE_ORCHESTRATOR.path, IMMUTABLE_ORCHESTRATOR.commit],
]);

interface ProtectedDiffDecision {
  readonly unauthorized: string[];
  readonly contentMismatches: string[];
}

function evaluateProtectedDiff(
  changedPaths: string[],
  contentEqualsApproved: (path: string, commit: string) => boolean,
): ProtectedDiffDecision {
  const unauthorized: string[] = [];
  const contentMismatches: string[] = [];

  for (const file of changedPaths) {
    const approvedCommit = IMMUTABLE_ORCHESTRATOR_BY_PATH.get(file);
    if (!approvedCommit) {
      unauthorized.push(file);
      continue;
    }
    if (!contentEqualsApproved(file, approvedCommit)) {
      contentMismatches.push(file);
    }
  }

  return { unauthorized, contentMismatches };
}

/** Contratos F60/F60.1/F60.3 reutilizados sem alteração. */
const CONTRACT_PATHS = [
  "src/lib/campaign/composition-artifacts",
  "src/lib/campaign/vertical-expansion",
  "src/lib/campaign/square-preparation",
];

/**
 * Quick 261116-vpx (autorizada): separação entre cobertura de usage e
 * estimativa `image_unit_usd` + preflight de leitura estrita na expansão. Estes
 * arquivos de F60.3 mudaram de propósito; qualquer OUTRO arquivo dos contratos
 * protegidos continua bloqueado.
 *
 * F60.6 / plano 60.6-02 (autorizado): o expansor passa a consumir a seleção
 * congelada (`ExpansionSelection`) por dependência server-only obrigatória, com
 * `expansion_selection_required`, `quality`/`configVersionId`/`selectionOrigin`
 * em request/evidência/telemetria. Os arquivos abaixo estão na lista
 * `files_modified` autorizada do plano; qualquer outro continua bloqueado.
 */
const AUTHORIZED_CONTRACT_CHANGES = new Set([
  "src/lib/campaign/vertical-expansion/model.ts",
  "src/lib/campaign/vertical-expansion/telemetry.ts",
  "src/lib/campaign/vertical-expansion/__tests__/expand.core.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/model.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/telemetry.contract.test.ts",
  // F60.6 / 60.6-02 — contrato, execução e suites orientados à seleção.
  "src/lib/campaign/vertical-expansion/policy.ts",
  "src/lib/campaign/vertical-expansion/transport.ts",
  "src/lib/campaign/vertical-expansion/types.ts",
  "src/lib/campaign/vertical-expansion/expand.ts",
  "src/lib/campaign/vertical-expansion/__tests__/policy.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/transport.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/types.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/expand.decision.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/expand.boundaries.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/expand.concurrency.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/expand.failure-output.contract.test.ts",
  "src/lib/campaign/vertical-expansion/__tests__/probe.contract.test.ts",
  // F62 / 62-03 (autorizado): opt-in legado 1024 default-preserving, extensão
  // explícita de ArtifactOrigin e propagação da revalidação interna. Somente os
  // seis caminhos abaixo; o diretório inteiro NÃO é liberado.
  "src/lib/campaign/composition-artifacts/persist.ts",
  "src/lib/campaign/composition-artifacts/resolve-source.ts",
  "src/lib/campaign/composition-artifacts/source-validation.ts",
  "src/lib/campaign/composition-artifacts/types.ts",
  "src/lib/campaign/composition-artifacts/__tests__/persist.contract.test.ts",
  "src/lib/campaign/composition-artifacts/__tests__/resolve-source.contract.test.ts",
  // F62 / 62-08 (autorizado test-only): transporte Node HTTP do detalhe.
  // Somente os cinco caminhos do transporte; o diretório inteiro NÃO é liberado.
  "src/lib/campaign/composition-artifacts/node-http-download.ts",
  "src/lib/campaign/composition-artifacts/retrieve.ts",
  "src/lib/campaign/composition-artifacts/storage.ts",
  "src/lib/campaign/composition-artifacts/__tests__/node-http-download.contract.test.ts",
  "src/lib/campaign/composition-artifacts/__tests__/retrieve.contract.test.ts",
]);

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

  it("1:1/prompts/compositor/políticas/runtime 1:1 sem diff contra a base, exceto o orquestrador congelado da i06", () => {
    const sha = resolveBaseSha();
    expect(PROTECTED_PATHS).toContain(IMMUTABLE_ORCHESTRATOR.path);
    expect(
      git(["cat-file", "-e", `${IMMUTABLE_ORCHESTRATOR.commit}^{commit}`]).status,
    ).toBe(0);

    const changed = git(["diff", "--name-only", `${sha}..HEAD`, "--", ...PROTECTED_PATHS]);
    expect(changed.status, changed.stderr).toBe(0);
    const changedPaths = changed.stdout.trim().split("\n").filter(Boolean);

    const decision = evaluateProtectedDiff(changedPaths, (file, commit) => {
      // Compara o WORKTREE com o commit imutável — não usa HEAD como aprovação.
      const diff = git(["diff", "--quiet", commit, "--", file]);
      return diff.status === 0;
    });

    expect(decision.unauthorized).toEqual([]);
    expect(decision.contentMismatches).toEqual([]);
  });

  it("contratos F60.1/F60.3/F60.2 sem diff não autorizado contra a base", () => {
    const sha = resolveBaseSha();
    const changed = git([
      "diff",
      "--name-only",
      `${sha}..HEAD`,
      "--",
      ...CONTRACT_PATHS,
    ]);
    expect(changed.status, changed.stderr).toBe(0);
    const unauthorized = changed.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((file) => !AUTHORIZED_CONTRACT_CHANGES.has(file));
    expect(unauthorized).toEqual([]);
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

describe("F60.4 regressão — exceção do orquestrador limitada ao commit imutável da i06", () => {
  it("o orquestrador no worktree é idêntico ao commit imutável (não usa HEAD como aprovação)", () => {
    expect(IMMUTABLE_ORCHESTRATOR.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(IMMUTABLE_ORCHESTRATOR.path).toContain("generation-orchestrator.ts");

    const approved = git([
      "cat-file",
      "-e",
      `${IMMUTABLE_ORCHESTRATOR.commit}^{commit}`,
    ]);
    expect(approved.status).toBe(0);

    const current = git([
      "diff",
      "--quiet",
      IMMUTABLE_ORCHESTRATOR.commit,
      "--",
      IMMUTABLE_ORCHESTRATOR.path,
    ]);
    expect(current.status, current.stderr).toBe(0);
  });

  it("aceita o caminho exato somente depois de consultar o conteúdo aprovado", () => {
    const calls: Array<{ path: string; commit: string }> = [];
    const decision = evaluateProtectedDiff([IMMUTABLE_ORCHESTRATOR.path], (path, commit) => {
      calls.push({ path, commit });
      return true;
    });

    expect(calls).toEqual([
      { path: IMMUTABLE_ORCHESTRATOR.path, commit: IMMUTABLE_ORCHESTRATOR.commit },
    ]);
    expect(decision).toEqual({ unauthorized: [], contentMismatches: [] });
  });

  it("rejeita mudança adicional no arquivo autorizado", () => {
    const decision = evaluateProtectedDiff([IMMUTABLE_ORCHESTRATOR.path], () => false);

    expect(decision.unauthorized).toEqual([]);
    expect(decision.contentMismatches).toEqual([IMMUTABLE_ORCHESTRATOR.path]);
  });

  it("rejeita mudança em qualquer outro caminho protegido", () => {
    const otherPath = "src/lib/product-1-1/prompt-base.ts";
    const decision = evaluateProtectedDiff([otherPath], () => true);

    expect(decision.unauthorized).toEqual([otherPath]);
    expect(decision.contentMismatches).toEqual([]);
  });

  it("não aceita caminho apenas parecido com o autorizado", () => {
    const lookalike = `${IMMUTABLE_ORCHESTRATOR.path}.bak`;
    const decision = evaluateProtectedDiff([lookalike], () => true);

    expect(decision.unauthorized).toEqual([lookalike]);
    expect(decision.contentMismatches).toEqual([]);
  });
});
