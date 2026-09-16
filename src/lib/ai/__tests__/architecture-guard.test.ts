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
 *  4. Fora de `src/lib/ai/adapters/**`: nenhuma leitura de env-var de
 *     modelo/provider (F46-07, D5/D8) — a escolha de modelo é do registry em
 *     código, nunca de env-var.
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

/**
 * Env-vars de modelo/provider eliminadas do runtime (F46-07, D5/D8). Nenhum
 * serviço pode lê-las para escolher modelo/provider — a fonte única é o registry
 * em código. A leitura de chave (`OPENAI_API_KEY`/`GEMINI_API_KEY`) NÃO entra
 * aqui (é resolvida por `src/lib/ai/api-keys.ts`).
 */
const MODEL_ENV_RE =
  /process\.env\.(OPENAI_MODEL|OPENAI_TEXT_MODEL|OPENAI_BRAND_DIRECTOR_MODEL|OPENAI_TEXT_ONLY_INFERENCE_MODEL|IMAGE_GENERATION_RESPONSES_MODEL|GPT_IMAGE_MODEL|IMAGE_EDIT_FALLBACK_MODEL|VISION_REVIEW_MODEL|IMAGE_VALIDATION_MODEL|IMAGE_PROVIDER|TEXT_PROVIDER|TEXT_FALLBACK_PROVIDER|GEMINI_TEXT_MODEL|GEMINI_MODEL)\b/;

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

  it("não há leitura de env-var de modelo/provider fora de src/lib/ai/adapters/**", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file.startsWith("src/lib/ai/adapters/")) continue;
      if (MODEL_ENV_RE.test(readCode(file))) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // F48.1 (D6/D15) — gates adicionais para o bounded context do laboratório.
  // Estritamente aditivos: nenhuma regra acima é afrouxada. Os arquivos de
  // `src/lib/lab/**` continuam sujeitos a TODOS os gates anteriores.
  // ─────────────────────────────────────────────────────────────────────────

  const labFiles = files.filter((file) => file.startsWith("src/lib/lab/"));

  /** Provider de imagem de produção — o lab invoca `campaign_image` direto no gateway. */
  const LAB_IMAGE_PROVIDER_RE = /@\/lib\/image-generation\/providers\/openai|OpenAIImageProvider/;

  /** Leitura de chave de provider — exclusiva de `src/lib/ai/api-keys.ts` (`getApiKey`). */
  const LAB_API_KEY_ENV_RE = /process\.env\.(OPENAI_API_KEY|GEMINI_API_KEY)\b/;

  it("src/lib/lab/ existe e contém ao menos environment-guard.ts", () => {
    // Sanidade: garante que os três gates do laboratório abaixo não passam por
    // varredura vazia (lista de arquivos sem nenhum arquivo do lab).
    expect(labFiles.length).toBeGreaterThan(0);
    expect(files).toContain("src/lib/lab/environment-guard.ts");
  });

  it("o laboratório não grava generation_events nem chama AiCostTracker.record", () => {
    const violations: string[] = [];
    for (const file of labFiles) {
      const code = readCode(file);
      if (/generation_events/.test(code)) violations.push(`${file} → generation_events`);
      if (TRACKER_RECORD_RE.test(code)) violations.push(`${file} → AiCostTracker.record`);
    }
    expect(violations).toEqual([]);
  });

  it("o laboratório não instancia o provider de imagem de produção nem SDK/wire", () => {
    const violations: string[] = [];
    for (const file of labFiles) {
      const code = readCode(file);
      if (LAB_IMAGE_PROVIDER_RE.test(code)) {
        violations.push(`${file} → provider de imagem de produção`);
      }
      for (const { name, re } of SDK_WIRE_PATTERNS) {
        if (re.test(code)) violations.push(`${file} → ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("o laboratório não lê chaves de provider diretamente", () => {
    const violations: string[] = [];
    for (const file of labFiles) {
      if (LAB_API_KEY_ENV_RE.test(readCode(file))) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
