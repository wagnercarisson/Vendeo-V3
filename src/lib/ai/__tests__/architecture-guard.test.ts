// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Gate global de arquitetura (F46-06, F46-30, D9).
 *
 * Garante que a F46 não seja contornada por código novo:
 *  1. Fora de `src/lib/ai/adapters/**`: nenhum init direto de SDK nem chamada de
 *     wire (`new OpenAI(`, `new GoogleGenerativeAI(`, `chat.completions.create(`,
 *     `responses.create(`, `images.edit(`, `generateContent(`).
 *  2. Fora de `src/lib/ai/**` (sink): nenhum `resolveAiCost(` (a definição em
 *     `src/lib/ai-cost/cost-estimator.ts` é a única exceção).
 *  3. Fora de `src/lib/ai/**`: nenhum `AiCostTracker.record(` para chamada de IA —
 *     a allowlist cobre APENAS os writers de **delivery marker** (sem custo/tokens).
 *
 * A leitura de env-var de modelo é adicionada a este gate no 46-07 (após a
 * remoção das envs).
 */

const SELF = "src/lib/ai/__tests__/architecture-guard.test.ts";
const RESOLVE_COST_DEFINITION = "src/lib/ai-cost/cost-estimator.ts";

/** Writers de delivery marker (sem custo/tokens) — única exceção ao gate de `record`. */
const DELIVERY_MARKER_FILES = new Set([
  "src/app/api/campaign/generate-image/route.ts",
  "src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts",
  "src/app/api/store/[id]/brand-profile/infer/route.ts",
  "src/app/api/store/[id]/brand-profile/realign/route.ts",
  "src/lib/visual-signature/generation-events.ts",
]);

function normalize(p: string): string {
  return p.split(path.sep).join("/");
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = normalize(path.relative(process.cwd(), full));
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(rel);
    }
  }
  return out;
}

/** Remove comentários de bloco e de linha antes de casar (evita falso positivo em docs). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readCode(file: string): string {
  return stripComments(readFileSync(path.resolve(process.cwd(), file), "utf8"));
}

const SDK_WIRE_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "new OpenAI(", re: /new\s+OpenAI\s*\(/ },
  { name: "new GoogleGenerativeAI(", re: /new\s+GoogleGenerativeAI\s*\(/ },
  { name: "chat.completions.create(", re: /\.chat\.completions\.create\s*\(/ },
  { name: "responses.create(", re: /\.responses\.create\s*\(/ },
  { name: "images.edit(", re: /\.images\.edit\s*\(/ },
  { name: "generateContent(", re: /\.generateContent\s*\(/ },
];

/** `new AiCostTracker().record(` ou `tracker.record(` (instância local). */
const TRACKER_RECORD_RE = /(?:new\s+AiCostTracker\(\)[\s\S]{0,60}?\.record\s*\(|\btracker\.record\s*\()/;

describe("architecture-guard — camada única de IA (F46-06)", () => {
  const files = collectFiles(path.resolve(process.cwd(), "src")).filter((f) => f !== SELF);

  it("não há init direto de SDK nem chamada de wire fora de src/lib/ai/adapters/**", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file.startsWith("src/lib/ai/adapters/")) continue;
      const code = readCode(file);
      for (const { name, re } of SDK_WIRE_PATTERNS) {
        if (re.test(code)) violations.push(`${file} → ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("resolveAiCost( não é usado fora de src/lib/ai/** (definição excluída)", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file.startsWith("src/lib/ai/")) continue;
      if (file === RESOLVE_COST_DEFINITION) continue;
      if (/resolveAiCost\s*\(/.test(readCode(file))) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it("AiCostTracker.record( não é usado fora de src/lib/ai/** (exceto delivery markers)", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file.startsWith("src/lib/ai/")) continue;
      if (DELIVERY_MARKER_FILES.has(file)) continue;
      if (TRACKER_RECORD_RE.test(readCode(file))) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it("a allowlist de delivery markers não contém arquivos inexistentes", () => {
    for (const file of DELIVERY_MARKER_FILES) {
      expect(files).toContain(file);
    }
  });
});
