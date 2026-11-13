// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = path.resolve(process.cwd(), "src", "app");
const GUARD_PATH = path.resolve(
  process.cwd(),
  "src",
  "app",
  "api",
  "campaign",
  "__tests__",
  "architecture-guard.test.ts",
);

function runtimeFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      files.push(...runtimeFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    if (path.resolve(full) === GUARD_PATH) continue;
    files.push(full);
  }
  return files;
}

const sources = runtimeFiles(APP_ROOT).map((file) => ({
  file: path.relative(process.cwd(), file).replace(/\\/g, "/"),
  source: readFileSync(file, "utf8"),
}));

// O simbolo e montado em runtime para o proprio guard nao se auto-detectar.
const FORBIDDEN = ["runProductVertical", "9x16Generation"].join("");

describe("architecture guard — runtime de src/app", () => {
  it("nao referencia o gerador vertical direto em nenhum arquivo de runtime", () => {
    const offenders = sources
      .filter(({ source }) => source.includes(FORBIDDEN))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("despacha o orquestrador two-stage apenas por import dinamico no ramo 9:16", () => {
    const route = sources.find(({ file }) =>
      file.endsWith("api/campaign/generate-image/route.ts"),
    );
    expect(route).toBeDefined();
    expect(route?.source).toContain("runNineSixteenTwoStageGeneration");
    expect(route?.source).toMatch(
      /import\(\s*["']@\/lib\/product-9-16-two-stage\/orchestration\/run-nine-sixteen["']\s*\)/,
    );
    expect(route?.source).not.toMatch(
      /from\s+["']@\/lib\/product-9-16-two-stage\/orchestration\/run-nine-sixteen["']/,
    );
  });

  it("mantem makeVerticalProjection permitido no historico", () => {
    const recovery = sources.find(({ file }) =>
      file.endsWith("api/campaign/[id]/image-recovery/route.ts"),
    );
    expect(recovery?.source).toContain("makeVerticalProjection");
  });
});
