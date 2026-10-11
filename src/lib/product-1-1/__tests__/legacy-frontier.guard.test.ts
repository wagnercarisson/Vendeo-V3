// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = process.cwd();
const BASE_SHA = "335bfb70";
const BASE_SHA_RECORD = path.resolve(
  REPOSITORY_ROOT,
  ".planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-ISOLATED-INSTANCE.md",
);

// Exceção ESTREITA (Plano 56.2.1-03, aprovada): a única alteração de fronteira
// produtiva reconhecida originalmente era o guard de submissão na rota
// generate-image. A quick 261011-lc6 reconciliou a guarda para reconhecer
// TAMBÉM as mudanças de fronteira anteriores já autorizadas (laboratório u3h e
// src/lib/ai da rsp), SEM excluir diretórios nem trocar o BASE_SHA:
//  - o conjunto de caminhos alterados deve ser EXATAMENTE o conjunto autorizado;
//  - cada caminho autorizado carrega autorização + commit de origem;
//  - os 12 caminhos adicionais têm o CONTEÚDO comparado ao commit aprovado, de
//    modo que a autorização do caminho NÃO vira autorização permanente para
//    modificá-lo;
//  - a rota generate-image mantém as verificações específicas (aditiva + guard
//    antes do parse/reserva).
const AUTHORIZED_ROUTE_FILE = "src/app/api/campaign/generate-image/route.ts";

interface AuthorizedFrontierChange {
  readonly path: string;
  readonly authorization: string;
  /** Commit de origem cujo conteúdo é o aprovado para este caminho. */
  readonly commit: string;
}

const AUTHORIZED_FRONTIER_CHANGES: readonly AuthorizedFrontierChange[] = [
  {
    path: AUTHORIZED_ROUTE_FILE,
    authorization: "F56.2.1-03 (exceção estreita aprovada — guard de submissão)",
    commit: "6d341964",
  },
  {
    path: "src/lib/lab/bench/domain/background-direction.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/prompt-composer.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/destaque.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/exclusivo.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/oferta.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts",
    authorization: "quick 261009-u3h (testes/versões do laboratório)",
    commit: "b7ab7b1b",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts",
    authorization: "quick 261009-u3h (testes/versões do laboratório)",
    commit: "b7ab7b1b",
  },
  {
    path: "src/lib/ai/types.ts",
    authorization: "quick 261010-rsp (diagnóstico aditivo de identidade visual)",
    commit: "6c2ebdb7",
  },
  {
    path: "src/lib/ai/adapters/chat-completions.ts",
    authorization: "quick 261010-rsp (diagnóstico aditivo de identidade visual)",
    commit: "6c2ebdb7",
  },
  {
    path: "src/lib/ai/adapters/__tests__/chat-completions.test.ts",
    authorization: "quick 261010-rsp (testes do adapter)",
    commit: "6c2ebdb7",
  },
  {
    path: "src/lib/ai/__tests__/ai-invocation-result-additive.contract.test.ts",
    authorization: "quick 261010-rsp (contrato aditivo)",
    commit: "6c2ebdb7",
  },
];

const ADDITIONAL_AUTHORIZED_FILES = AUTHORIZED_FRONTIER_CHANGES.filter(
  (entry) => entry.path !== AUTHORIZED_ROUTE_FILE,
);

const LEGACY_FRONTIER_PATHS = [
  "src/app/api/campaign/generate-image/route.ts",
  ":(literal)src/app/api/campaign/[id]/download/route.ts",
  "src/lib/ai/adapters/images.ts",
  "src/lib/ai/adapters/registry.ts",
  "src/lib/ai/gateway.ts",
  "src/lib/credit/credit-service.ts",
  "src/lib/ai-cost/**",
  "src/lib/lab/bench/**",
  "src/lib/ai/**",
  ":(exclude)src/lib/ai/image-generation-operations-repository.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-operations-repository.test.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-config-snapshot.reuse.test.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts",
];

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPOSITORY_ROOT, encoding: "utf8" });
}

/** Normaliza CRLF→LF para comparar conteúdo independentemente do checkout. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** Diferenças do conjunto alterado contra o conjunto autorizado. */
function diffAgainstAuthorized(
  changed: readonly string[],
  authorized: readonly string[],
): { extra: string[]; missing: string[] } {
  const changedSet = new Set(changed);
  const authorizedSet = new Set(authorized);
  return {
    extra: changed.filter((file) => !authorizedSet.has(file)),
    missing: authorized.filter((file) => !changedSet.has(file)),
  };
}

/** Caminhos autorizados cujo conteúdo atual difere do conteúdo aprovado. */
function contentMismatches(
  entries: readonly AuthorizedFrontierChange[],
  readCurrent: (file: string) => string,
  readApproved: (commit: string, file: string) => string,
): string[] {
  return entries
    .filter(
      (entry) =>
        normalize(readCurrent(entry.path)) !==
        normalize(readApproved(entry.commit, entry.path)),
    )
    .map((entry) => entry.path);
}

describe("legacy-frontier guard — F56.2a", () => {
  it("usa o BASE_SHA literal registrado e confirma commit/ancestry", () => {
    const evidence = readFileSync(BASE_SHA_RECORD, "utf8");
    expect(evidence.split(/\r?\n/)).toContain(`BASE_SHA: \`${BASE_SHA}\``);

    expect(() =>
      execFileSync("git", ["cat-file", "-e", `${BASE_SHA}^{commit}`], {
        cwd: REPOSITORY_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
    expect(() =>
      execFileSync("git", ["merge-base", "--is-ancestor", BASE_SHA, "HEAD"], {
        cwd: REPOSITORY_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("reconhece EXATAMENTE o conjunto autorizado de mudanças de fronteira", () => {
    const changed = git([
      "diff",
      "--name-only",
      `${BASE_SHA}..HEAD`,
      "--",
      ...LEGACY_FRONTIER_PATHS,
    ])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    const { extra, missing } = diffAgainstAuthorized(
      changed,
      AUTHORIZED_FRONTIER_CHANGES.map((entry) => entry.path),
    );

    // Conjunto exato: nenhum caminho NÃO autorizado e nenhum autorizado ausente.
    expect(extra, "caminhos de fronteira não autorizados").toEqual([]);
    expect(missing, "caminhos autorizados ausentes do diff").toEqual([]);
    expect(changed).toHaveLength(AUTHORIZED_FRONTIER_CHANGES.length);
  });

  it("não autoriza modificação de conteúdo nos caminhos autorizados adicionais", () => {
    const mismatches = contentMismatches(
      ADDITIONAL_AUTHORIZED_FILES,
      (file) => readFileSync(path.resolve(REPOSITORY_ROOT, file), "utf8"),
      (commit, file) => git(["show", `${commit}:${file}`]),
    );

    // O conteúdo ATUAL deve ser idêntico ao conteúdo do commit aprovado; a
    // autorização do caminho não é autorização permanente para modificá-lo.
    expect(mismatches).toEqual([]);
  });

  it("a rota generate-image aceita SOMENTE a mudança aditiva aprovada", () => {
    const diff = git([
      "diff",
      "--unified=0",
      `${BASE_SHA}..HEAD`,
      "--",
      AUTHORIZED_ROUTE_FILE,
    ]);
    const lines = diff.split(/\r?\n/);
    const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---"));
    const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++"));

    // Nenhuma linha existente removida/alterada: o fluxo legado é preservado.
    expect(removed).toEqual([]);

    const addedText = added.join("\n");
    // As adições incluem os imports do guard.
    expect(addedText).toMatch(/\+import \{ detectExclusiveNewFlowFields \}/);
    expect(addedText).toMatch(/\+import \{ assertSubmissionEligible \}/);
    expect(addedText).toMatch(/\+import \{ resolveEligibilityContext \}/);
    expect(addedText).toMatch(/\+import \{ resolveProductFlowAuthorization \}/);

    // As adições NÃO tocam o parse estrito, a resposta de validação legada nem a reserva.
    for (const forbidden of [
      "safeParse(",
      "fieldErrors",
      "reserveCredit(",
      "Dados de entrada inválidos",
    ]) {
      expect(added.some((l) => l.includes(forbidden)), forbidden).toBe(false);
    }
  });

  it("o guard roda ANTES do safeParse e da reserva, preservando o fluxo legado", () => {
    const source = readFileSync(
      path.resolve(REPOSITORY_ROOT, AUTHORIZED_ROUTE_FILE),
      "utf8",
    );

    const guardIdx = source.indexOf("detectExclusiveNewFlowFields(body)");
    const safeParseIdx = source.indexOf("GenerateImageRequestSchema.safeParse(body)");
    const reserveIdx = source.indexOf("creditService.reserveCredit(");

    expect(guardIdx).toBeGreaterThan(-1);
    expect(safeParseIdx).toBeGreaterThan(guardIdx);
    expect(reserveIdx).toBeGreaterThan(safeParseIdx);

    // Sem duplicação dos pontos críticos.
    expect(source.match(/GenerateImageRequestSchema\.safeParse\(body\)/g)?.length).toBe(1);
    expect(source.match(/creditService\.reserveCredit\(/g)?.length).toBe(1);
    // Resposta de validação legada (400 com details/fieldErrors) preservada.
    expect(source).toMatch(/details: parsed\.error\.flatten\(\)\.fieldErrors/);
  });
});

describe("legacy-frontier guard — reconciliação (testes negativos)", () => {
  const AUTHORIZED = AUTHORIZED_FRONTIER_CHANGES.map((entry) => entry.path);

  it("rejeita um caminho de fronteira EXTRA não autorizado", () => {
    const changed = [...AUTHORIZED, "src/lib/ai/gateway.ts"];
    const { extra } = diffAgainstAuthorized(changed, AUTHORIZED);
    expect(extra).toEqual(["src/lib/ai/gateway.ts"]);
  });

  it("rejeita a ausência de um caminho autorizado", () => {
    const changed = AUTHORIZED.filter(
      (file) => file !== "src/lib/ai/types.ts",
    );
    const { missing } = diffAgainstAuthorized(changed, AUTHORIZED);
    expect(missing).toEqual(["src/lib/ai/types.ts"]);
  });

  it("rejeita alteração de CONTEÚDO em um caminho autorizado", () => {
    const entries = ADDITIONAL_AUTHORIZED_FILES.slice(0, 1);
    const file = entries[0].path;
    const mismatches = contentMismatches(
      entries,
      () => "conteúdo indevidamente alterado",
      () => "conteúdo aprovado",
    );
    expect(mismatches).toEqual([file]);
  });

  it("aceita caminhos e conteúdos quando idênticos ao autorizado", () => {
    const entries = ADDITIONAL_AUTHORIZED_FILES;
    const mismatches = contentMismatches(
      entries,
      (file) => readFileSync(path.resolve(REPOSITORY_ROOT, file), "utf8"),
      (commit, file) => git(["show", `${commit}:${file}`]),
    );
    expect(mismatches).toEqual([]);
  });
});
