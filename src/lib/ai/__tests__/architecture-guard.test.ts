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

/**
 * Arquivos de comando do laboratório em `scripts/lab/**` (gate de fronteira
 * arquitetural F48.2.3). Somente `.mjs` de topo; subdiretórios (ex.: `__tests__`)
 * são ignorados.
 */
function collectScriptLabFiles(): string[] {
  const dir = path.resolve(process.cwd(), "scripts/lab");
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (!/\.mjs$/.test(entry)) continue;
    out.push(normalize(path.relative(process.cwd(), path.join(dir, entry))));
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

  // ─────────────────────────────────────────────────────────────────────────
  // F48.2.1 (D1/D11) — gates adicionais. Estritamente aditivos: nada acima é
  // afrouxado. O laboratório não toca seleção/catálogo produtivos por escrita,
  // não usa o Revisor (`campaign_image_review`) e não escreve em `prompts/`.
  // ─────────────────────────────────────────────────────────────────────────

  /** Escrita em `ai_model_catalog` (a leitura para allowlist é permitida). */
  const CATALOG_WRITE_RE =
    /from\(["'`]ai_model_catalog["'`]\)[\s\S]{0,200}?\.(insert|update|upsert|delete)\s*\(/;

  /** Escrita em arquivo sob `prompts/` (nenhum arquivo do lab escreve o prompt oficial). */
  const PROMPTS_WRITE_RE =
    /(writeFileSync|writeFile|appendFileSync|createWriteStream)\s*\([\s\S]{0,160}?["'`][^"'`]*prompts\//;

  it("o laboratório não referencia ai_model_selection nem campaign_image_review", () => {
    const violations: string[] = [];
    for (const file of labFiles) {
      const code = readCode(file);
      if (/ai_model_selection/.test(code)) violations.push(`${file} → ai_model_selection`);
      if (/campaign_image_review/.test(code)) violations.push(`${file} → campaign_image_review`);
    }
    expect(violations).toEqual([]);
  });

  it("o laboratório não escreve em ai_model_catalog", () => {
    const violations: string[] = [];
    for (const file of labFiles) {
      if (CATALOG_WRITE_RE.test(readCode(file))) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it("o laboratório não escreve em prompts/", () => {
    const violations: string[] = [];
    for (const file of labFiles) {
      if (PROMPTS_WRITE_RE.test(readCode(file))) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it("os três prompts do Diretor (offer/spotlight/exclusive) são aceitos", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/domain/prompt-snapshot.ts"),
      "utf8",
    );
    expect(source).toContain("campaign-image-director-offer");
    expect(source).toContain("campaign-image-director-spotlight");
    expect(source).toContain("campaign-image-director-exclusive");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // F48.2.2 (D2) — gates aditivos do bounded context da bancada
  // (`src/lib/lab/bench/**`). Estritamente aditivos: nenhuma regra acima é
  // afrouxada e o contexto da bancada continua sujeito a TODOS os gates do
  // laboratório (sem `generation_events`/`AiCostTracker.record`, sem provider de
  // imagem de produção, sem SDK/wire, sem chaves de provider, sem
  // `ai_model_selection` e sem escrita em `ai_model_catalog`/`prompts/`).
  // ─────────────────────────────────────────────────────────────────────────

  const benchFiles = files.filter((file) => file.startsWith("src/lib/lab/bench/"));

  it("o bounded context src/lib/lab/bench/ existe e é coberto pelos gates do laboratório", () => {
    // Sanidade: o diretório da bancada contém código (não é varredura vazia).
    expect(benchFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of benchFiles) {
      const code = readCode(file);
      if (/generation_events/.test(code)) violations.push(`${file} → generation_events`);
      if (TRACKER_RECORD_RE.test(code)) violations.push(`${file} → AiCostTracker.record`);
      if (LAB_IMAGE_PROVIDER_RE.test(code)) {
        violations.push(`${file} → provider de imagem de produção`);
      }
      for (const { name, re } of SDK_WIRE_PATTERNS) {
        if (re.test(code)) violations.push(`${file} → ${name}`);
      }
      if (LAB_API_KEY_ENV_RE.test(code)) violations.push(`${file} → chave de provider`);
      if (/ai_model_selection/.test(code)) violations.push(`${file} → ai_model_selection`);
      if (CATALOG_WRITE_RE.test(code)) violations.push(`${file} → escrita em ai_model_catalog`);
      if (PROMPTS_WRITE_RE.test(code)) violations.push(`${file} → escrita em prompts/`);
    }
    expect(violations).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // F48.2.3 (D4/D17) — gate estático de FRONTEIRA ARQUITETURAL da bancada e do
  // comando de importação. Verifica IMPORTS/USO — NÃO congela conteúdo de
  // arquivos produtivos (a prova temporal de produção intocada é do Plano 08, via
  // `base..HEAD`). Estritamente aditivo: nenhuma regra acima é afrouxada.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Módulos puros genuinamente reutilizados da pipeline de campanha (nunca editados aqui).
   * `constants` foi incluído como correção de integração entre os Planos 01 e 04 da F48.2.3:
   * `form-rules.ts` (Plano 04) reutiliza legitimamente `ILLUSTRATIVE_NOTICE_TEXT` de
   * `src/lib/campaign/constants.ts` — um módulo puro de constante única, sem I/O nem efeitos.
   * A allowlist permanece restrita a módulos puros: {brief, brief-schema, types, constants}.
   */
  const BENCH_ALLOWED_CAMPAIGN_MODULES = new Set(["brief", "brief-schema", "types", "constants"]);
  const CAMPAIGN_MODULE_IMPORT_RE = /@\/lib\/campaign\/([a-z0-9-]+)/g;

  /** Alvos produtivos proibidos no código da bancada (case-sensitive). */
  const BENCH_FORBIDDEN_TARGETS: Array<{ name: string; re: RegExp }> = [
    { name: "campaigns", re: /\bcampaigns\b/ },
    { name: "campaign_images", re: /\bcampaign_images\b/ },
    { name: "generation_events", re: /\bgeneration_events\b/ },
    { name: "ai_model_selection", re: /\bai_model_selection\b/ },
    { name: "admin_audit_log", re: /\badmin_audit_log\b/ },
    { name: "credit_*", re: /\bcredit_[a-z_]+/ },
    { name: "campaign-images", re: /campaign-images/ },
    { name: "prompts/", re: /\bprompts\// },
  ];

  const benchCommandFiles = collectScriptLabFiles();
  const benchBoundaryFiles = [...benchFiles, ...benchCommandFiles];

  it("o comando de importação vive em scripts/lab/** (sem efeitos no runtime)", () => {
    // Sanidade: o gate de fronteira abaixo cobre o diretório do comando.
    expect(benchCommandFiles.length).toBeGreaterThan(0);
    expect(benchCommandFiles).toContain("scripts/lab/48-2-2-bench-bootstrap.mjs");
  });

  it("a bancada e o comando não importam o pipeline/rotas produtivas de campanha", () => {
    const violations: string[] = [];
    for (const file of benchBoundaryFiles) {
      const code = readCode(file);
      if (/@\/app\/api\/campaign/.test(code)) {
        violations.push(`${file} → rota produtiva de campanha`);
      }
      for (const match of code.matchAll(CAMPAIGN_MODULE_IMPORT_RE)) {
        if (!BENCH_ALLOWED_CAMPAIGN_MODULES.has(match[1])) {
          violations.push(`${file} → src/lib/campaign/${match[1]}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("a bancada e o comando não referenciam tabelas/buckets proibidos", () => {
    const violations: string[] = [];
    for (const file of benchBoundaryFiles) {
      const code = readCode(file);
      for (const { name, re } of BENCH_FORBIDDEN_TARGETS) {
        if (re.test(code)) violations.push(`${file} → ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("a bancada não registra o ImagesAdapter nem o registry produtivos", () => {
    const violations: string[] = [];
    for (const file of benchFiles) {
      const code = readCode(file);
      if (/@\/lib\/ai\/adapters\/images\b/.test(code)) {
        violations.push(`${file} → ImagesAdapter produtivo`);
      }
      if (/new\s+ImagesAdapter\s*\(/.test(code)) {
        violations.push(`${file} → new ImagesAdapter(`);
      }
    }
    expect(violations).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // F48.2.4 (D10/D17) — gate de fronteira estendido à região do laboratório e
  // aos comandos `scripts/lab/**`. Estritamente aditivo: nenhuma regra acima é
  // afrouxada. Prova que o adapter `Images` produtivo nunca é importado/
  // instanciado pela bancada (que registra apenas o `BenchImagesAdapter`) e que
  // `images` nunca é resolvido pelo registry padrão no runtime da bancada.
  // ─────────────────────────────────────────────────────────────────────────

  it("a bancada e os comandos não importam/instanciam o ImagesAdapter produtivo", () => {
    const violations: string[] = [];
    for (const file of benchBoundaryFiles) {
      const code = readCode(file);
      if (/@\/lib\/ai\/adapters\/images\b/.test(code)) {
        violations.push(`${file} → ImagesAdapter produtivo`);
      }
      if (/new\s+ImagesAdapter\s*\(/.test(code)) {
        violations.push(`${file} → new ImagesAdapter(`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("o runtime da bancada não resolve `images` pelo registry padrão", () => {
    const violations: string[] = [];
    for (const file of benchFiles) {
      const code = readCode(file);
      if (/defaultAdapterRegistry\s*\.\s*get\s*\(\s*["'`]images["'`]\s*\)/.test(code)) {
        violations.push(`${file} → registry padrão resolve images`);
      }
    }
    expect(violations).toEqual([]);
  });
});
