#!/usr/bin/env node
/**
 * F59 — Harness da prova de provider vertical 9:16.
 *
 * Reutiliza INTEGRALMENTE a configuração efetiva do fluxo 1:1:
 *   - par principal/fallback de `image_model_pair_config` (scope `new_flow`);
 *   - tarifas de `ai_model_pricing` por `provider + model + quality`.
 *
 * A matriz é DERIVADA do par vigente (sem catálogo/modelos exclusivos de 9:16):
 * 3 amostras `1152x2048` + 1 controle `1024x1024` por par único.
 *
 * - Dry-run NUNCA chama provider.
 * - Apply exige `--apply` + `--authorized=<token>` + credencial de homolog.
 * - Sem configuração ou pricing real, falha fechado e não inventa matriz/preço.
 * - Nenhum prompt, chave ou byte de imagem é persistido/impresso.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { resolveImageModelPairConfigFromRow } from "../../src/lib/ai/image-model-pair-config-row";
import { UpstreamImagesAdapter } from "../../src/lib/ai/adapters/upstream-images";
import type { AiInvocationRequest } from "../../src/lib/ai/types";
import { calculateProductOneToOneImageUsageCost } from "../../src/lib/ai-cost/image-usage-token-cost";
import type { UsageTokenPricing } from "../../src/lib/ai-cost/types";
import {
  canAfford,
  createProofBudget,
  estimateVerticalCall,
  recordCall,
  recordUnknownOutcome,
  remainingBudgetBlocks,
} from "../../src/lib/product-vertical-9-16/cost/vertical-estimate";
import { evaluateProofCall } from "../../src/lib/product-vertical-9-16/cost/proof-call-outcome";
import { summarizeProofCalibration } from "../../src/lib/product-vertical-9-16/cost/proof-calibration";
import { createProofSdkLoader } from "../../src/lib/product-vertical-9-16/cost/proof-openai-loader";
import { PROVIDER_SIZE } from "../../src/lib/product-vertical-9-16/dimensions";

const PROOF_CAP_USD = 3;
const SAMPLES_PER_PAIR = 3;
const CONTROL_SIZE = "1024x1024";

const FIXED_PROMPT = [
  "Crie uma peça profissional e visualmente coerente.",
  "Formato vertical 9:16, imagem estática, com o fundo ou a cena preenchendo todo o quadro de borda a borda.",
  "Mantenha o essencial dentro da área protegida: topo 14%, base 35%, laterais 6% e canto inferior direito 30% da largura por 40% da altura.",
  "É proibido desenhar guias, marcas de corte, faixas reservadas, letterbox ou bordas visíveis.",
  "A peça deve ser compreensível sozinha, sem depender de legenda externa.",
].join("\n");

type PlannedKind = "sample" | "control";

interface SharedPricing {
  readonly pricing: UsageTokenPricing;
  readonly versionId: string;
  readonly imageUnitUsd: number;
}

interface SharedPair {
  readonly targets: readonly ("primary" | "fallback")[];
  readonly model: string;
  readonly quality: string;
  readonly pricing: SharedPricing;
}

interface SharedSource {
  readonly configVersionId: string;
  readonly origin: string;
  readonly pairs: readonly SharedPair[];
}

interface PlannedCall {
  readonly index: number;
  readonly model: string;
  readonly quality: string;
  readonly requestedSize: string;
  readonly kind: PlannedKind;
  readonly target: string;
  readonly pricingVersionId: string;
  readonly estimatedUsd: number;
}

interface CallEvidence {
  index: number;
  model: string;
  quality: string;
  target: string;
  kind: PlannedKind;
  isRetry: boolean;
  requestedSize: string;
  pricingVersionId: string;
  configVersionId: string;
  status:
    | "succeeded"
    | "unknown"
    | "unsupported_dimension"
    | "dimension_mismatch"
    | "cost_unverified";
  returnedWidth: number | null;
  returnedHeight: number | null;
  expectedSizeMatches: boolean | null;
  mimeType: string | null;
  latencyMs: number;
  providerReportedUsd: number | null;
  calculatedFromUsageUsd: number | null;
  calculatedCoverage: string | null;
  calculatedMissing: readonly string[];
  estimatedUsd: number;
  chargedUsd: number;
  deviationUsd: number;
  providerUsagePresent: boolean;
  errorName?: string;
  errorKind?: string;
  startedAt: string;
  finishedAt: string;
}

class SharedSourceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SharedSourceError";
  }
}

class ProofRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofRefusalError";
  }
}

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return found === undefined ? null : found.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function readEnvFile(filePath: string): Map<string, string> {
  if (!existsSync(filePath)) return new Map();
  const values = new Map<string, string>();
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    values.set(key, raw.replace(/^["']+/, "").replace(/["']+$/, ""));
  }
  return values;
}

function envValue(name: string, dotenv: Map<string, string>): string | null {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined && fromProcess.length > 0) return fromProcess;
  const fromFile = dotenv.get(name);
  return fromFile !== undefined && fromFile.length > 0 ? fromFile : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function toUsageTokenPricing(row: Record<string, unknown>): UsageTokenPricing {
  const pricing: UsageTokenPricing = {};
  const inputCostUsd = numberOrNull(row.input_token_usd_per_1m);
  const outputCostUsd = numberOrNull(row.output_token_usd_per_1m);
  const cachedInputCostUsd = numberOrNull(row.cached_input_token_usd_per_1m);
  const imageTokenUsdPer1M = numberOrNull(row.image_token_usd_per_1m);
  const imageInputTokenUsdPer1M = numberOrNull(row.image_input_token_usd_per_1m);
  const imageCachedInputTokenUsdPer1M = numberOrNull(
    row.image_cached_input_token_usd_per_1m,
  );
  if (inputCostUsd !== null) pricing.inputCostUsd = inputCostUsd;
  if (outputCostUsd !== null) pricing.outputCostUsd = outputCostUsd;
  if (cachedInputCostUsd !== null) {
    pricing.cachedInputCostUsd = cachedInputCostUsd;
  }
  if (imageTokenUsdPer1M !== null) {
    pricing.imageTokenUsdPer1M = imageTokenUsdPer1M;
  }
  if (imageInputTokenUsdPer1M !== null) {
    pricing.imageInputTokenUsdPer1M = imageInputTokenUsdPer1M;
  }
  if (imageCachedInputTokenUsdPer1M !== null) {
    pricing.imageCachedInputTokenUsdPer1M =
      imageCachedInputTokenUsdPer1M;
  }
  return pricing;
}

async function loadSharedSource(envFile: string): Promise<SharedSource> {
  const dotenv = readEnvFile(envFile);
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL", dotenv);
  const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY", dotenv);
  if (url === null || serviceKey === null) {
    throw new SharedSourceError(
      "shared_source_env_missing",
      "fonte compartilhada indisponível: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente ou no arquivo informado",
    );
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const configResponse = await client
    .from("image_model_pair_config")
    .select("*")
    .eq("scope", "new_flow")
    .maybeSingle();
  if (configResponse.error) {
    throw new SharedSourceError(
      "shared_config_read_failed",
      `falha ao ler image_model_pair_config: ${configResponse.error.message}`,
    );
  }

  let resolved;
  try {
    resolved = resolveImageModelPairConfigFromRow(
      configResponse.data as Parameters<
        typeof resolveImageModelPairConfigFromRow
      >[0],
    );
  } catch (error) {
    throw new SharedSourceError(
      "shared_config_missing_or_divergent",
      `configuração 1:1 ausente/divergente: ${error instanceof Error ? error.name : "unknown"}`,
    );
  }

  const configured = [
    { target: "primary" as const, pair: resolved.primary },
    { target: "fallback" as const, pair: resolved.fallback },
  ];

  const unique = new Map<
    string,
    { targets: ("primary" | "fallback")[]; model: string; quality: string }
  >();
  for (const entry of configured) {
    const key = `${entry.pair.model}|${entry.pair.quality}`;
    const existing = unique.get(key);
    if (existing) {
      existing.targets.push(entry.target);
    } else {
      unique.set(key, {
        targets: [entry.target],
        model: entry.pair.model,
        quality: entry.pair.quality,
      });
    }
  }

  const pairs: SharedPair[] = [];
  for (const entry of unique.values()) {
    const pricingResponse = await client
      .from("ai_model_pricing")
      .select(
        "id,provider,model,quality,image_unit_usd,image_token_usd_per_1m,image_input_token_usd_per_1m,image_cached_input_token_usd_per_1m,input_token_usd_per_1m,output_token_usd_per_1m,cached_input_token_usd_per_1m,effective_until",
      )
      .eq("provider", "openai")
      .eq("model", entry.model)
      .eq("quality", entry.quality)
      .is("effective_until", null)
      .maybeSingle();
    if (pricingResponse.error) {
      throw new SharedSourceError(
        "shared_pricing_read_failed",
        `falha ao ler ai_model_pricing para ${entry.model}/${entry.quality}: ${pricingResponse.error.message}`,
      );
    }
    const row = pricingResponse.data as Record<string, unknown> | null;
    if (row === null) {
      throw new SharedSourceError(
        "shared_pricing_missing",
        `sem tarifa vigente para ${entry.model}/${entry.quality}`,
      );
    }
    const imageUnitUsd = numberOrNull(row.image_unit_usd);
    if (imageUnitUsd === null || imageUnitUsd <= 0) {
      throw new SharedSourceError(
        "shared_pricing_missing_image_unit",
        `sem image_unit_usd vigente para ${entry.model}/${entry.quality}`,
      );
    }
    if (typeof row.id !== "string" || row.id.length === 0) {
      throw new SharedSourceError(
        "shared_pricing_missing_version",
        `sem versionId vigente para ${entry.model}/${entry.quality}`,
      );
    }
    pairs.push({
      targets: Object.freeze([...entry.targets]),
      model: entry.model,
      quality: entry.quality,
      pricing: {
        pricing: toUsageTokenPricing(row),
        versionId: row.id,
        imageUnitUsd,
      },
    });
  }

  return {
    configVersionId: resolved.configVersionId,
    origin: resolved.origin,
    pairs: Object.freeze(pairs),
  };
}

function buildMatrix(source: SharedSource): readonly PlannedCall[] {
  const calls: PlannedCall[] = [];
  let index = 1;
  for (const pair of source.pairs) {
    const estimate = estimateVerticalCall({
      model: pair.model,
      quality: pair.quality,
      imageUnitUsd: pair.pricing.imageUnitUsd,
    });
    if (!estimate.available) {
      throw new SharedSourceError(
        "vertical_estimate_missing",
        `estimativa vertical ausente para ${pair.model}/${pair.quality}`,
      );
    }
    const target = pair.targets.join("+");
    for (let sample = 1; sample <= SAMPLES_PER_PAIR; sample++) {
      calls.push({
        index: index++,
        model: pair.model,
        quality: pair.quality,
        requestedSize: PROVIDER_SIZE,
        kind: "sample",
        target,
        pricingVersionId: pair.pricing.versionId,
        estimatedUsd: estimate.estimatedUsd,
      });
    }
    calls.push({
      index: index++,
      model: pair.model,
      quality: pair.quality,
      requestedSize: CONTROL_SIZE,
      kind: "control",
      target,
      pricingVersionId: pair.pricing.versionId,
      estimatedUsd: estimate.estimatedUsd,
    });
  }
  return Object.freeze(calls);
}

async function fileToDataUrl(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`imagem não encontrada: ${path.basename(filePath)}`);
  }
  const bytes = readFileSync(filePath);
  const metadata = await sharp(bytes).metadata();
  const mime =
    metadata.format === "jpeg"
      ? "image/jpeg"
      : metadata.format === "png"
        ? "image/png"
        : metadata.format === "webp"
          ? "image/webp"
          : null;
  if (mime === null) {
    throw new Error(`formato de imagem não suportado: ${path.basename(filePath)}`);
  }
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function writeJsonAtomic(filePath: string, payload: unknown): void {
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function evidenceDirectory(): string {
  const override = arg("evidence-dir");
  return path.resolve(
    process.cwd(),
    override ?? path.join("scripts", "f59", "evidence"),
  );
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function safeErrorKind(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const kind = (error as { kind?: unknown }).kind;
  return typeof kind === "string" ? kind : undefined;
}

function isVerticalDimensionEvidence(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("1152") ||
    message.includes("2048") ||
    message.includes("size") ||
    message.includes("dimension")
  );
}

function printHeader(mode: "DRY-RUN" | "APPLY", matrix: readonly PlannedCall[]): void {
  console.log("[f59-vertical-proof] Prova de provider 9:16");
  console.log(`Mode: ${mode}`);
  console.log(`Planned calls: ${matrix.length}`);
  console.log(`Cap: US$${PROOF_CAP_USD.toFixed(2)}`);
  console.log(`Provider size: ${PROVIDER_SIZE}`);
  console.log(`Control size: ${CONTROL_SIZE}`);
}

function printSource(source: SharedSource): void {
  console.log(`Config version: ${source.configVersionId}`);
  console.log(`Config origin: ${source.origin}`);
  for (const pair of source.pairs) {
    console.log(
      `Pair: ${pair.targets.join("+")} | ${pair.model} | ${pair.quality} | unitUsd=${pair.pricing.imageUnitUsd.toFixed(6)} | pricingVersion=${pair.pricing.versionId}`,
    );
  }
}

function refuse(message: string): never {
  throw new ProofRefusalError(message);
}

async function runDryRun(
  source: SharedSource,
  matrix: readonly PlannedCall[],
): Promise<void> {
  printHeader("DRY-RUN", matrix);
  printSource(source);

  const totalEstimatedUsd = matrix.reduce(
    (sum, call) => sum + call.estimatedUsd,
    0,
  );
  for (const call of matrix) {
    console.log(
      `[${String(call.index).padStart(2, "0")}/${matrix.length}] ${call.model} | ${call.quality} | ${call.requestedSize} | target=${call.target} | estimatedUsd=${call.estimatedUsd.toFixed(6)} | pricingVersion=${call.pricingVersionId}`,
    );
  }
  console.log(`Estimated total: US$${totalEstimatedUsd.toFixed(6)}`);
  console.log(`Cap: US$${PROOF_CAP_USD.toFixed(2)}`);
  if (totalEstimatedUsd > PROOF_CAP_USD) {
    console.log("WARNING: matriz excede o teto; o apply parará antes das chamadas que não couberem.");
  }
  console.log("No provider call was made (dry-run).");
}

async function runApply(
  source: SharedSource,
  matrix: readonly PlannedCall[],
): Promise<void> {
  const authorized = arg("authorized");
  const dotenv = readEnvFile(arg("dotenv") ?? ".env.local");
  const credential = envValue("OPENAI_API_KEY", dotenv);
  if (
    !hasFlag("apply") ||
    authorized === null ||
    authorized.trim().length < 8 ||
    credential === null
  ) {
    refuse("PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA");
  }

  const primaryPath = arg("primary-image");
  if (primaryPath === null) {
    refuse("PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA (imagem primária ausente)");
  }

  printHeader("APPLY", matrix);
  printSource(source);

  const pricingByPair = new Map(
    source.pairs.map((pair) => [
      `${pair.model}|${pair.quality}`,
      pair.pricing,
    ]),
  );

  const primaryDataUrl = await fileToDataUrl(primaryPath);
  const identityPath = arg("identity-image");
  const identityDataUrl =
    identityPath === null ? null : await fileToDataUrl(identityPath);
  console.log(
    `References: primary=present identity=${identityDataUrl === null ? "ausente" : "present"}`,
  );

  const adapter = new UpstreamImagesAdapter(
    createProofSdkLoader(credential),
  );
  let budget = createProofBudget({
    capUsd: PROOF_CAP_USD,
    plannedCalls: matrix.length,
  });
  const calls: CallEvidence[] = [];
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const evidencePath = path.join(
    evidenceDirectory(),
    `vertical-provider-proof-${runId}.json`,
  );
  mkdirSync(path.dirname(evidencePath), { recursive: true });

  const persist = (finishedAt: string | null): void => {
    writeJsonAtomic(evidencePath, {
      runId,
      mode: "apply",
      matrixSize: matrix.length,
      providerSize: PROVIDER_SIZE,
      controlSize: CONTROL_SIZE,
      source: {
        configVersionId: source.configVersionId,
        origin: source.origin,
        pairs: source.pairs.map((pair) => ({
          targets: pair.targets,
          model: pair.model,
          quality: pair.quality,
          imageUnitUsd: pair.pricing.imageUnitUsd,
          pricingVersionId: pair.pricing.versionId,
        })),
      },
      primaryImage: "present",
      identityImage: identityDataUrl === null ? "absent" : "present",
      promptSource: "fixed",
      sdkMaxRetries: 0,
      budget,
      calls,
      finishedAt,
    });
  };
  persist(null);

  let stoppedForUnknown = false;
  let stoppedForUnsupportedDimension = false;
  let stoppedForDimensionMismatch = false;
  let stoppedForUnverifiedCost = false;
  let stoppedForBudget = false;

  for (const call of matrix) {
    if (!canAfford(budget, call.estimatedUsd).ok) {
      stoppedForBudget = true;
      break;
    }
    const gate = remainingBudgetBlocks(budget, call.estimatedUsd);
    if (gate !== null) {
      stoppedForBudget = gate === "proof_budget_exceeded";
      stoppedForUnknown = gate === "cost_unknown";
      break;
    }

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const request: AiInvocationRequest = {
      prompt: FIXED_PROMPT,
      productImagesDataUrls: [primaryDataUrl],
      ...(identityDataUrl === null ? {} : { identityImageUrl: identityDataUrl }),
      quality: call.quality,
      size: call.requestedSize,
    };

    try {
      const result = await adapter.invoke(request, {
        provider: "openai",
        model: call.model,
        protocol: "images",
      });
      const finishedAt = new Date().toISOString();
      const pairPricing = pricingByPair.get(`${call.model}|${call.quality}`);
      if (!pairPricing) {
        throw new SharedSourceError(
          "shared_pricing_missing",
          `tarifa ausente em memória para ${call.model}/${call.quality}`,
        );
      }

      const decoded = await sharp(
        Buffer.from(result.imageBase64 ?? "", "base64"),
      ).metadata();
      const returnedWidth = decoded.width ?? null;
      const returnedHeight = decoded.height ?? null;

      const calculated = calculateProductOneToOneImageUsageCost({
        usage: result.usage,
        pricing: pairPricing.pricing,
        pricingVersion: pairPricing.versionId,
        pricingSource: "pricing_table",
        model: call.model,
        quality: call.quality,
      });
      const calculatedFromUsageUsd = calculated.estimatedCostUsd;
      const providerReportedUsd = result.providerReportedCostUsd ?? null;
      const evaluation = evaluateProofCall({
        requestedSize: call.requestedSize,
        returnedWidth,
        returnedHeight,
        providerReportedUsd,
        calculatedFromUsageUsd,
        estimatedUsd: call.estimatedUsd,
      });

      budget = recordCall(budget, {
        estimatedUsd: call.estimatedUsd,
        providerReportedUsd,
        calculatedFromUsageUsd,
        target: call.target,
        costVerified: evaluation.costVerified,
      });

      calls.push({
        index: call.index,
        model: call.model,
        quality: call.quality,
        target: call.target,
        kind: call.kind,
        isRetry: false,
        requestedSize: call.requestedSize,
        pricingVersionId: pairPricing.versionId,
        configVersionId: source.configVersionId,
        status: evaluation.outcome,
        returnedWidth,
        returnedHeight,
        expectedSizeMatches: evaluation.dimensionMatches,
        mimeType: result.mimeType ?? null,
        latencyMs: Date.now() - startedMs,
        providerReportedUsd,
        calculatedFromUsageUsd,
        calculatedCoverage: calculated.productOneToOneImageUsage.coverage,
        calculatedMissing: calculated.productOneToOneImageUsage.missing,
        estimatedUsd: call.estimatedUsd,
        chargedUsd: evaluation.chargedUsd,
        deviationUsd: Number(
          (evaluation.chargedUsd - call.estimatedUsd).toFixed(6),
        ),
        providerUsagePresent: result.usage !== undefined,
        startedAt,
        finishedAt,
      });
      persist(null);
      console.log(
        `[${String(call.index).padStart(2, "0")}/${matrix.length}] ${evaluation.outcome} ${call.model} | ${call.quality} | ${call.requestedSize} | chargedUsd=${evaluation.chargedUsd.toFixed(6)}`,
      );

      if (evaluation.stop) {
        stoppedForDimensionMismatch =
          evaluation.outcome === "dimension_mismatch";
        stoppedForUnverifiedCost = evaluation.outcome === "cost_unverified";
        break;
      }
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const unsupportedDimension = isVerticalDimensionEvidence(error);
      budget = recordUnknownOutcome(budget, {
        estimatedUsd: call.estimatedUsd,
        target: call.target,
      });
      calls.push({
        index: call.index,
        model: call.model,
        quality: call.quality,
        target: call.target,
        kind: call.kind,
        isRetry: false,
        requestedSize: call.requestedSize,
        pricingVersionId: call.pricingVersionId,
        configVersionId: source.configVersionId,
        status: unsupportedDimension ? "unsupported_dimension" : "unknown",
        returnedWidth: null,
        returnedHeight: null,
        expectedSizeMatches: null,
        mimeType: null,
        latencyMs: Date.now() - startedMs,
        providerReportedUsd: null,
        calculatedFromUsageUsd: null,
        calculatedCoverage: null,
        calculatedMissing: [],
        estimatedUsd: call.estimatedUsd,
        chargedUsd: call.estimatedUsd,
        deviationUsd: 0,
        providerUsagePresent: false,
        errorName: safeErrorName(error),
        ...(safeErrorKind(error) === undefined
          ? {}
          : { errorKind: safeErrorKind(error) }),
        startedAt,
        finishedAt,
      });
      persist(null);
      stoppedForUnsupportedDimension = unsupportedDimension;
      stoppedForUnknown = !unsupportedDimension;
      console.log(
        `[${String(call.index).padStart(2, "0")}/${matrix.length}] ${unsupportedDimension ? "unsupported_dimension" : "unknown"} ${call.model} | ${call.quality} | ${call.requestedSize} | prova parada`,
      );
      break;
    }
  }

  const finishedAt = new Date().toISOString();
  persist(finishedAt);

  const executed = calls.length;
  const unverifiedCostCalls = calls.filter(
    (call) => call.status === "cost_unverified",
  ).length;
  const dimensionMismatchCalls = calls.filter(
    (call) => call.status === "dimension_mismatch",
  ).length;
  const calibration = summarizeProofCalibration(
    calls.map((call) => ({
      status: call.status,
      estimatedUsd: call.estimatedUsd,
      providerReportedUsd: call.providerReportedUsd,
      calculatedFromUsageUsd: call.calculatedFromUsageUsd,
    })),
  );
  const calibrationVerdict =
    stoppedForUnsupportedDimension
      ? "parada por dimensão vertical não suportada; configuração NÃO alterada"
      : stoppedForDimensionMismatch
        ? "reprovado: dimensão devolvida divergente; configuração NÃO alterada"
        : stoppedForUnverifiedCost
          ? "custo real indisponível; reconciliação exigida; multiplicador NÃO confirmado"
          : stoppedForUnknown
            ? "reconciliação pendente; multiplicador NÃO confirmado"
            : calibration.verdict === "not_calibrated"
              ? "não calibrado (nenhuma chamada com custo real apurado)"
              : calibration.verdict === "confirmed_conservative"
                ? `confirmado conservador (custo real abaixo da estimativa; razão máxima ${calibration.maxActualRatio.toFixed(4)})`
                : `ajuste proposto: multiplicador >= ${calibration.proposedMultiplier?.toFixed(2)}`;

  const calibrationPath = path.resolve(
    process.cwd(),
    ".planning",
    "phases",
    "59-f59-campanhas-de-produto-vertical-9-16",
    "59-02-VERTICAL-ESTIMATE-CALIBRATION.md",
  );
  writeFileSync(
    calibrationPath,
    [
      "# 59-02 — Calibração do multiplicador vertical",
      "",
      "**Gerado pelo harness da prova (apply).**",
      "",
      `- Configuração 1:1: **${source.configVersionId}** (${source.origin})`,
      `- Pares: ${source.pairs.map((pair) => `${pair.targets.join("+")}=${pair.model}/${pair.quality} (pricing ${pair.pricing.versionId})`).join("; ")}`,
      `- Multiplicador provisório: **2,5** (2,25 de área + 0,25 de margem)`,
      `- Chamadas executadas: **${executed}/${matrix.length}**`,
      `- Custo total cobrado contra o teto (conservador): **US$${budget.totalChargedUsd.toFixed(6)}** de US$${PROOF_CAP_USD.toFixed(2)}`,
      `- Custo real apurado (reportado/usage): **US$${calibration.totalActualUsd.toFixed(6)}**`,
      `- Estimativa das chamadas com custo real: **US$${calibration.totalEstimatedUsd.toFixed(6)}**`,
      `- Desvio real vs. estimativa: **US$${calibration.actualDeviationUsd.toFixed(6)}**`,
      `- Maior razão custo real/estimado: **${calibration.maxActualRatio.toFixed(4)}**`,
      `- Multiplicador proposto: **${calibration.proposedMultiplier?.toFixed(2) ?? "n/a"}**`,
      `- Unknown: **${budget.unknownCalls}**; reconciliação exigida: **${budget.requiresReconciliation ? "sim" : "não"}**`,
      `- Custo não apurado: **${budget.costUnverifiedCalls}**; dimensão divergente: **${dimensionMismatchCalls}**`,
      `- Retries automáticos do SDK: **0** (loader da prova com maxRetries: 0)`,
      "",
      `## Veredito`,
      "",
      calibrationVerdict,
      "",
      "O multiplicador 2,5 permanece o valor pré-definido antes do gasto; a calibração só confirma ou propõe ajuste com a evidência acima.",
      "",
    ].join("\n"),
    "utf8",
  );

  const pending = matrix.slice(executed).map((call) => ({
    index: call.index,
    model: call.model,
    quality: call.quality,
    requestedSize: call.requestedSize,
    status: "pending",
  }));

  writeJsonAtomic(evidencePath, {
    runId,
    mode: "apply",
    matrixSize: matrix.length,
    providerSize: PROVIDER_SIZE,
    controlSize: CONTROL_SIZE,
    source: {
      configVersionId: source.configVersionId,
      origin: source.origin,
      pairs: source.pairs.map((pair) => ({
        targets: pair.targets,
        model: pair.model,
        quality: pair.quality,
        imageUnitUsd: pair.pricing.imageUnitUsd,
        pricingVersionId: pair.pricing.versionId,
      })),
    },
    primaryImage: "present",
    identityImage: identityDataUrl === null ? "absent" : "present",
    promptSource: "fixed",
    budget,
    calls,
    pending,
    stoppedForUnknown,
    stoppedForUnsupportedDimension,
    stoppedForDimensionMismatch,
    stoppedForUnverifiedCost,
    stoppedForBudget,
    unverifiedCostCalls,
    dimensionMismatchCalls,
    sdkMaxRetries: 0,
    calibration,
    calibrationVerdict,
    evidencePath,
    finishedAt,
  });

  console.log(
    `Summary: executed=${budget.executedCalls}/${matrix.length} chargedUsd=${budget.totalChargedUsd.toFixed(6)} remainingUsd=${budget.remainingUsd.toFixed(6)} pending=${pending.length} unknown=${budget.unknownCalls} costUnverified=${unverifiedCostCalls} dimensionMismatch=${dimensionMismatchCalls} sdkMaxRetries=0`,
  );
  console.log(`Evidence: ${evidencePath}`);
  console.log(`Calibration: ${calibrationPath}`);

  if (stoppedForUnsupportedDimension) process.exitCode = 6;
  else if (stoppedForDimensionMismatch) process.exitCode = 7;
  else if (stoppedForUnverifiedCost) process.exitCode = 8;
  else if (stoppedForUnknown) process.exitCode = 4;
  else if (stoppedForBudget) process.exitCode = 5;
}

async function main(): Promise<void> {
  if (hasFlag("apply") && hasFlag("dry-run")) {
    refuse("Escolha --dry-run ou --apply, nunca os dois.");
  }

  const envFile = arg("dotenv") ?? ".env.local";
  if (hasFlag("apply")) {
    const dotenv = readEnvFile(envFile);
    const authorized = arg("authorized");
    const credential = envValue("OPENAI_API_KEY", dotenv);
    if (
      authorized === null ||
      authorized.trim().length < 8 ||
      credential === null
    ) {
      refuse("PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA");
    }
  }

  const source = await loadSharedSource(envFile);
  const matrix = buildMatrix(source);

  if (hasFlag("apply")) {
    await runApply(source, matrix);
  } else {
    await runDryRun(source, matrix);
  }
}

main().catch((error: unknown) => {
  if (error instanceof ProofRefusalError) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  if (error instanceof SharedSourceError) {
    console.error(`[f59-vertical-proof] ${error.code}: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  console.error(`[f59-vertical-proof] falha: ${safeErrorName(error)}`);
  process.exitCode = 1;
});
