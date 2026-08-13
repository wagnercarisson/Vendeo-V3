/**
 * Model benchmark script — 10 fixed scenarios, cross-model comparison.
 *
 * Usage:
 *   npx tsx scripts/benchmark.ts [--provider openai] [--model gpt-5.5] [--delay 2000] [--max-runs 25]
 *
 * Options:
 *   --provider <name>   Override IMAGE_PROVIDER (default from env). Must be "openai".
 *                       Invalid provider exits with non-zero immediately.
 *   --model <name>      Override the generation model (default: IMAGE_GENERATION_RESPONSES_MODEL).
 *   --delay <ms>        Delay between scenarios in ms (default: 2000).
 *   --max-runs <number> Maximum executions before stopping (default: 25, protects cost).
 *
 * Output:
 *   - Summary table printed to console
 *   - Metrics written to metrics/benchmark-{timestamp}.jsonl
 */

import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { BenchmarkScenario } from "./benchmark-scenarios";


// NOTE: src/ imports are dynamic (inside runBenchmark) so we can set env vars
// before the config module evaluates IMAGE_GENERATION_RESPONSES_MODEL.


// ─── CLI argument parsing ──────────────────────────────────────────────────

interface CliArgs {
  provider: string | null;
  model: string;
  delay: number;
  maxRuns: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let provider: string | null = null;
  let model = "";
  let delay = 2000;
  let maxRuns = 25;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--provider": {
        const val = args[++i];
        if (!val || val.startsWith("--")) {
          console.error("ERRO: --provider requer um nome de provedor.");
          process.exit(1);
        }
        provider = val;
        break;
      }
      case "--model": {
        const val = args[++i];
        if (!val || val.startsWith("--")) {
          console.error("ERRO: --model requer um nome de modelo.");
          process.exit(1);
        }
        model = val;
        break;
      }
      case "--delay": {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 0) {
          console.error("ERRO: --delay deve ser um número em ms >= 0.");
          process.exit(1);
        }
        delay = val;
        break;
      }
      case "--max-runs": {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 1) {
          console.error("ERRO: --max-runs deve ser um número >= 1.");
          process.exit(1);
        }
        maxRuns = val;
        break;
      }
      default:
        console.error(`ERRO: Argumento desconhecido: ${args[i]}`);
        process.exit(1);
    }
  }

  return { provider, model, delay, maxRuns };
}

// ─── Fixture / placeholder image handling ──────────────────────────────────

/**
 * Minimal valid 1x1 transparent PNG as a placeholder data URL.
 * Used when fixture image is not available on disk.
 */
function getPlaceholderBase64(): string {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}

/**
 * Try to read a fixture image file and return it as a data URL.
 * Falls back to a placeholder base64 if the file doesn't exist or can't be read.
 */
async function loadFixtureDataUrl(imagePath?: string): Promise<string> {
  if (!imagePath) return getPlaceholderBase64();

  try {
    const absolutePath = path.resolve(imagePath);
    if (!fs.existsSync(absolutePath)) {
      console.warn(`  ⚠ Fixture não encontrada: ${imagePath} — usando placeholder`);
      return getPlaceholderBase64();
    }

    const buffer = await fs.promises.readFile(absolutePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const mime = mimeMap[ext] ?? "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    console.warn(`  ⚠ Erro ao ler fixture: ${imagePath} — usando placeholder`);
    return getPlaceholderBase64();
  }
}

// ─── Benchmark execution types ─────────────────────────────────────────────

interface BenchmarkResult {
  scenarioId: string;
  scenarioName: string;
  status: "success" | "error" | "skipped";
  durationMs: number;
  estimatedCostUsd?: number;
  retries: number;
  validationResult?: string;
  reviewPassed?: boolean;
  reviewFailureType?: string | null;
  errorMessage?: string;
}

// ─── Summary table ─────────────────────────────────────────────────────────

function printSummaryTable(results: BenchmarkResult[]): void {
  const separator = "─".repeat(120);

  console.log("\n" + separator);
  console.log("  BENCHMARK SUMMARY");
  console.log(separator);

  // Header
  console.log(
    "  Scenario".padEnd(30) +
    "Status".padEnd(12) +
    "Time (s)".padEnd(10) +
    "Cost ($)".padEnd(12) +
    "Retries".padEnd(10) +
    "Validation".padEnd(20) +
    "Review"
  );
  console.log(separator);

  for (const r of results) {
    const scenario = r.scenarioId.padEnd(28);
    const status = r.status === "success"
      ? "OK".padEnd(10)
      : r.status === "error"
        ? "FAIL".padEnd(10)
        : "SKIP".padEnd(10);
    const time = (r.durationMs / 1000).toFixed(1).padEnd(8);
    const cost = r.estimatedCostUsd !== undefined
      ? r.estimatedCostUsd.toFixed(4).padEnd(10)
      : "—".padEnd(10);
    const retries = String(r.retries).padEnd(8);
    const validation = (r.validationResult ?? "—").padEnd(18);
    const review = r.reviewPassed === true
      ? "Pass"
      : r.reviewPassed === false
        ? `${r.reviewFailureType ?? "Fail"}`
        : "—";

    console.log(`  ${scenario} ${status} ${time} ${cost} ${retries} ${validation} ${review}`);
  }

  console.log(separator);

  // Summary stats
  const total = results.length;
  const passed = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const minTime = results.length > 0 ? Math.min(...results.map((r) => r.durationMs)) : 0;
  const maxTime = results.length > 0 ? Math.max(...results.map((r) => r.durationMs)) : 0;
  const avgTime = results.length > 0
    ? results.reduce((sum, r) => sum + r.durationMs, 0) / results.length
    : 0;
  const totalCost = results.reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0);

  console.log(`  Total: ${total} | OK: ${passed} | FAIL: ${failed} | SKIP: ${skipped}`);
  console.log(`  Time: ${(minTime / 1000).toFixed(1)}s min / ${(avgTime / 1000).toFixed(1)}s avg / ${(maxTime / 1000).toFixed(1)}s max`);
  console.log(`  Total cost: \$${totalCost.toFixed(4)}`);
  console.log(separator + "\n");
}

// ─── Benchmark metrics writer ──────────────────────────────────────────────

async function writeBenchmarkMetricsLine(line: string): Promise<void> {
  const metricsDir = "metrics";
  try {
    await fs.promises.mkdir(metricsDir, { recursive: true });
  } catch {
    // directory already exists
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `benchmark-${timestamp}.jsonl`;
  const filePath = path.join(metricsDir, filename);

  try {
    await fs.promises.appendFile(filePath, line + "\n", "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ⚠ Erro ao escrever métricas: ${msg}`);
    console.log(line);
  }
}

// ─── Main benchmark function ───────────────────────────────────────────────

function sanitizeError(message?: string): string | undefined {
  if (!message) return undefined;
  const lower = message.toLowerCase();
  if (lower.includes("incorrect api key") || lower.includes("insufficient_quota") || lower.includes("401") || lower.includes("403")) {
    return "missing_credentials";
  }
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("rate_limit")) {
    return "rate_limited";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("504")) {
    return "timeout";
  }
  return message.slice(0, 120);
}

async function runBenchmark(): Promise<void> {
  const { provider, model, delay, maxRuns } = parseArgs();

  // Load .env.local before any src/ imports so config module picks them up.
  loadEnvConfig(process.cwd());

  // Set env vars before any src/ imports so config module picks them up.
  const effectiveModel = model || process.env.IMAGE_GENERATION_RESPONSES_MODEL || "gpt-5.5";
  process.env.IMAGE_GENERATION_RESPONSES_MODEL = effectiveModel;

  if (provider) {
    process.env.IMAGE_PROVIDER = provider;
  }

  // Validate provider — fail fast on invalid
  const evaluatedProvider = process.env.IMAGE_PROVIDER || "openai";
  const VALID_PROVIDERS = new Set(["openai"]);
  if (!VALID_PROVIDERS.has(evaluatedProvider)) {
    console.error(
      `ERRO: Provedor "${evaluatedProvider}" inválido. Provedores suportados: ${[...VALID_PROVIDERS].join(", ")}.`
    );
    process.exit(1);
  }

  // ── Import src-dependent modules after env vars are set ──────────
  const [
    { BENCHMARK_SCENARIOS },
    { createImageProvider },
    { ImageGenerationService },
    { IMAGE_GENERATION_RESPONSES_MODEL },
  ] = await Promise.all([
    import("./benchmark-scenarios"),
    import("../src/lib/image-generation/providers/factory"),
    import("../src/lib/image-generation/services/image-generation-service"),
    import("../src/lib/image-generation/config"),
  ]);

  // ── Banner ────────────────────────────────────────────────────────
  const separator = "═".repeat(60);
  console.log("\n" + separator);
  console.log("  BENCHMARK — Geração de Imagens");
  console.log(separator);
  console.log(`  Provider:           ${evaluatedProvider}`);
  console.log(`  Model:              ${effectiveModel}${model ? " (via --model)" : ""}`);
  console.log(`  Delay entre runs:   ${delay}ms`);
  console.log(`  Max runs:           ${maxRuns}`);
  console.log(`  Scenarios:          ${BENCHMARK_SCENARIOS.length}`);
  console.log(`  Fixtures dir:       scripts/benchmark-fixtures/`);
  console.log(separator + "\n");

  // ── Initialize ────────────────────────────────────────────────────
  const results: BenchmarkResult[] = [];
  const providerInstance = createImageProvider();
  const service = new ImageGenerationService(providerInstance);

  let runsPerformed = 0;
  const startTime = Date.now();

  // ── Execute scenarios sequentially ────────────────────────────────
  for (let i = 0; i < BENCHMARK_SCENARIOS.length; i++) {
    if (runsPerformed >= maxRuns) {
      console.warn(`\n  ⚠ Limite de ${maxRuns} execuções atingido.`);
      break;
    }

    const scenario = BENCHMARK_SCENARIOS[i];
    const scenarioStart = Date.now();

    console.log(`\n  [${i + 1}/${BENCHMARK_SCENARIOS.length}] ${scenario.name}`);
    console.log(`  ─${"─".repeat(scenario.name.length + 6)}`);
    console.log(`  Loja: ${scenario.store.name} (${scenario.store.segment})`);
    console.log(`  Produto: ${scenario.campaign.productName}`);
    if (scenario.campaign.originalPriceCents) {
      console.log(`  Preço: De R$${(scenario.campaign.originalPriceCents / 100).toFixed(2)} por R$${(scenario.campaign.discountedPriceCents / 100).toFixed(2)}`);
    } else {
      console.log(`  Preço: R$${(scenario.campaign.discountedPriceCents / 100).toFixed(2)}`);
    }

    // ── Load product image ──────────────────────────────────────────
    const imageDataUrl = await loadFixtureDataUrl(scenario.imagePath);
    console.log(`  Imagem: ${imageDataUrl === getPlaceholderBase64() ? "placeholder (sem fixture)" : scenario.imagePath ?? "N/A"}`);

    // ── Build request (wrapped as CampaignBrief) ────────────────────
    const brief = {
      campaignInput: {
        productName: scenario.campaign.productName,
        storeId: 'benchmark',
        originalPriceCents: scenario.campaign.originalPriceCents,
        discountedPriceCents: scenario.campaign.discountedPriceCents,
        badgeText: scenario.campaign.badgeText,
        hook: scenario.campaign.hook,
        cta: scenario.campaign.cta,
        description: scenario.campaign.description,
        objective: scenario.campaign.objective,
        campaignDetails: scenario.campaign.campaignDetails,
        additionalDetails: scenario.campaign.additionalDetails,
        availabilityNotes: scenario.campaign.availabilityNotes,
        validity: scenario.campaign.validity,
        targetChannel: scenario.campaign.targetChannel,
        format: scenario.campaign.format,
        campaignIntent: "offer",
        productImageDataUrl: imageDataUrl,
      },
      store: {
        name: scenario.store.name,
        segment: scenario.store.segment,
        subsegment: null,
        toneOfVoice: scenario.store.tone,
        positioning: null,
        shortDescription: null,
        slogan: null,
        brandColor: scenario.store.brandColor,
      },
      brandProfile: null,
      identity: {
        state: 'logo' as const,
        imageUrl: scenario.store.logoUrl ?? null,
        directive: "Assinar a campanha com o logotipo da loja. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.",
      },
    };

    // ── Execute generation ──────────────────────────────────────────
    let result: BenchmarkResult;

    try {
      const generationResult = await service.generateImage(brief as any, brief as any);
      const duration = Date.now() - scenarioStart;

      if (generationResult.success) {
        result = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          status: "success",
          durationMs: duration,
          retries: 0,
          reviewPassed: true,
        };
        console.log(`  ✅ Gerado com sucesso em ${(duration / 1000).toFixed(1)}s`);
      } else {
        result = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          status: "error",
          durationMs: duration,
          retries: 0,
          errorMessage: generationResult.message,
          reviewPassed: false,
          reviewFailureType: generationResult.code,
        };
        console.log(`  ❌ Falha: ${generationResult.message} [${generationResult.code}]`);
      }
    } catch (err) {
      const duration = Date.now() - scenarioStart;
      const message = err instanceof Error ? err.message : String(err);
      result = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: "error",
        durationMs: duration,
        retries: 0,
        errorMessage: message,
      };
      console.log(`  ❌ Exceção: ${message}`);
    }

    results.push(result);
    runsPerformed++;

    // ── Delay between scenarios (except last) ───────────────────────
    if (i < BENCHMARK_SCENARIOS.length - 1 && runsPerformed < maxRuns) {
      console.log(`  ⏳ Aguardando ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // ── Print summary ──────────────────────────────────────────────────────
  printSummaryTable(results);

  // ── Write metrics ─────────────────────────────────────────────────────
  for (const r of results) {
    const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === r.scenarioId)!;
    const metricsLine = JSON.stringify({
      runId: `benchmark-${scenario.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      environment: "benchmark",
      provider: evaluatedProvider,
      model: effectiveModel,
      totalDurationMs: r.durationMs,
      retryCount: r.retries,
      conflictsDetected: [],
      hadOverride: false,
      reviewPassed: r.reviewPassed,
      reviewFailureType: r.reviewFailureType ?? null,
      technicalError: r.reviewFailureType ?? sanitizeError(r.errorMessage),
      rejectionReason: r.reviewFailureType ? r.errorMessage : undefined,
      sanitizedInputs: {
        productName: scenario.campaign.productName,
        storeName: scenario.store.name,
        storeSegment: scenario.store.segment,
      },
    });
    await writeBenchmarkMetricsLine(metricsLine);
  }

  // ── Done ───────────────────────────────────────────────────────────────
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  ✅ Benchmark concluído em ${totalDuration}s`);
  console.log(`  Métricas: metrics/benchmark-*.jsonl\n`);

  // Exit with non-zero if any scenario failed
  const anyFailed = results.some((r) => r.status === "error");
  if (anyFailed) {
    process.exitCode = 1;
  }
}

runBenchmark().catch((err) => {
  console.error("ERRO FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
