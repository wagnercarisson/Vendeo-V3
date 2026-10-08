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
// produtiva reconhecida é o guard de submissão na rota generate-image. Nenhum
// diretório é excluído; os demais caminhos permanecem estritamente inalterados.
const AUTHORIZED_FRONTIER_FILE = "src/app/api/campaign/generate-image/route.ts";

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

  it("reconhece SOMENTE a rota generate-image como alteração aprovada da fronteira", () => {
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

    expect(changed).toEqual([AUTHORIZED_FRONTIER_FILE]);
  });

  it("a mudança da rota é puramente aditiva (imports + guard)", () => {
    const diff = git([
      "diff",
      "--unified=0",
      `${BASE_SHA}..HEAD`,
      "--",
      AUTHORIZED_FRONTIER_FILE,
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
      path.resolve(REPOSITORY_ROOT, AUTHORIZED_FRONTIER_FILE),
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
