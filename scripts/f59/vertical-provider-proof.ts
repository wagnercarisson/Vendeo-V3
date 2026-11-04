#!/usr/bin/env node
/**
 * F59 — Harness da prova de provider vertical 9:16.
 *
 * Executa o caminho REAL (`UpstreamImagesAdapter` + cálculo real por usage),
 * com matriz de 14 chamadas, teto de US$ 3,00 e dry-run como padrão.
 *
 * - Dry-run NUNCA chama provider.
 * - Apply exige `--apply` + `--authorized=<token>` + credencial de homolog.
 * - Sem fonte explícita de `image_unit_usd`, não estima e sai com código 2.
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
import sharp from "sharp";

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
import { PROVIDER_SIZE } from "../../src/lib/product-vertical-9-16/dimensions";

const PROOF_CAP_USD = 3;
const PLANNED_CALLS = 14;
const SAMPLES_PER_COMBINATION = 3;
const CONTROL_SIZE = "1024x1024";
const MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2"] as const;
const QUALITIES = ["low", "medium"] as const;

const FIXED_PROMPT = [
  "Crie uma peça profissional e visualmente coerente.",
  "Formato vertical 9:16, imagem estática, com o fundo ou a cena preenchendo todo o quadro de borda a borda.",
  "Mantenha o essencial dentro da área protegida: topo 14%, base 35%, laterais 6% e canto inferior direito 30% da largura por 40% da altura.",
  "É proibido desenhar guias, marcas de corte, faixas reservadas, letterbox ou bordas visíveis.",
  "A peça deve ser compreensível sozinha, sem depender de legenda externa.",
].join("\n");

type PlannedKind = "sample" | "control";

interface PlannedCall {
  readonly index: number;
  readonly model: (typeof MODELS)[number];
  readonly quality: (typeof QUALITIES)[number];
  readonly requestedSize: string;
  readonly kind: PlannedKind;
  readonly target: string;
}

interface UnitCostFlat {
  readonly kind: "flat";
  readonly label: string;
  readonly value: number;
}

interface UnitCostMap {
  readonly kind: "map";
  readonly label: string;
  readonly values: ReadonlyMap<string, number>;
}

type UnitCostSource = UnitCostFlat | UnitCostMap;

interface PricingFile {
  readonly pricing: UsageTokenPricing;
  readonly versionId: string | null;
}

interface CallEvidence {
  index: number;
  model: string;
  quality: string;
  kind: PlannedKind;
  target: string;
  isRetry: boolean;
  requestedSize: string;
  status: "succeeded" | "unknown";
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

function buildMatrix(): readonly PlannedCall[] {
  const calls: PlannedCall[] = [];
  let index = 1;
  for (const model of MODELS) {
    for (const quality of QUALITIES) {
      for (let sample = 1; sample <= SAMPLES_PER_COMBINATION; sample++) {
        calls.push({
          index: index++,
          model,
          quality,
          requestedSize: PROVIDER_SIZE,
          kind: "sample",
          target: "primary",
        });
      }
    }
    calls.push({
      index: index++,
      model,
      quality: "low",
      requestedSize: CONTROL_SIZE,
      kind: "control",
      target: "primary",
    });
  }
  return Object.freeze(calls);
}

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return found === undefined ? null : found.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function parsePositive(label: string, raw: string | null): number {
  const value = Number(raw);
  if (raw === null || !Number.isFinite(value) || value <= 0) {
    throw new Error(`valor inválido para ${label}`);
  }
  return value;
}

function loadUnitCostSource(): UnitCostSource | null {
  const inline = arg("unit-usd");
  if (inline !== null) {
    return {
      kind: "flat",
      label: "--unit-usd",
      value: parsePositive("--unit-usd", inline),
    };
  }

  const file = arg("unit-usd-file");
  if (file === null) return null;

  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--unit-usd-file deve conter um objeto JSON");
  }

  const values = new Map<string, number>();
  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      throw new Error(`unit cost inválido para ${key}`);
    }
    values.set(key, raw);
  }
  if (values.size === 0) throw new Error("--unit-usd-file vazio");

  return { kind: "map", label: `--unit-usd-file=${file}`, values };
}

function unitFor(source: UnitCostSource, call: PlannedCall): number | undefined {
  if (source.kind === "flat") return source.value;
  return source.values.get(`${call.model}|${call.quality}`);
}

function numberFrom(
  source: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return undefined;
}

function loadPricingFile(): PricingFile | null {
  const file = arg("pricing-file");
  if (file === null) return null;

  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--pricing-file deve conter um objeto JSON");
  }
  const top = parsed as Record<string, unknown>;
  const nested =
    top.pricing !== null &&
    typeof top.pricing === "object" &&
    !Array.isArray(top.pricing)
      ? (top.pricing as Record<string, unknown>)
      : top;

  const pricing: UsageTokenPricing = {};
  const inputCostUsd = numberFrom(nested, [
    "inputCostUsd",
    "input_token_usd_per_1m",
    "imageInputTextUsdPer1M",
  ]);
  const outputCostUsd = numberFrom(nested, [
    "outputCostUsd",
    "output_token_usd_per_1m",
  ]);
  const cachedInputCostUsd = numberFrom(nested, [
    "cachedInputCostUsd",
    "cached_input_token_usd_per_1m",
  ]);
  const imageTokenUsdPer1M = numberFrom(nested, [
    "imageTokenUsdPer1M",
    "image_token_usd_per_1m",
    "imageOutputImageUsdPer1M",
  ]);
  const imageInputTokenUsdPer1M = numberFrom(nested, [
    "imageInputTokenUsdPer1M",
    "image_input_token_usd_per_1m",
    "imageInputImageUsdPer1M",
  ]);
  const imageCachedInputTokenUsdPer1M = numberFrom(nested, [
    "imageCachedInputTokenUsdPer1M",
    "image_cached_input_token_usd_per_1m",
  ]);

  if (inputCostUsd !== undefined) pricing.inputCostUsd = inputCostUsd;
  if (outputCostUsd !== undefined) pricing.outputCostUsd = outputCostUsd;
  if (cachedInputCostUsd !== undefined) {
    pricing.cachedInputCostUsd = cachedInputCostUsd;
  }
  if (imageTokenUsdPer1M !== undefined) {
    pricing.imageTokenUsdPer1M = imageTokenUsdPer1M;
  }
  if (imageInputTokenUsdPer1M !== undefined) {
    pricing.imageInputTokenUsdPer1M = imageInputTokenUsdPer1M;
  }
  if (imageCachedInputTokenUsdPer1M !== undefined) {
    pricing.imageCachedInputTokenUsdPer1M =
      imageCachedInputTokenUsdPer1M;
  }

  if (Object.keys(pricing).length === 0) return null;

  const versionRaw =
    top.versionId ?? top.version_id ?? nested.versionId ?? nested.version_id ?? top.id;
  return {
    pricing,
    versionId: typeof versionRaw === "string" ? versionRaw : null,
  };
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

function maxKnownCost(
  estimatedUsd: number,
  providerReportedUsd: number | null,
  calculatedFromUsageUsd: number | null,
): number {
  const candidates = [estimatedUsd];
  if (
    providerReportedUsd !== null &&
    Number.isFinite(providerReportedUsd) &&
    providerReportedUsd >= 0
  ) {
    candidates.push(providerReportedUsd);
  }
  if (
    calculatedFromUsageUsd !== null &&
    Number.isFinite(calculatedFromUsageUsd) &&
    calculatedFromUsageUsd >= 0
  ) {
    candidates.push(calculatedFromUsageUsd);
  }
  return Number(Math.max(...candidates).toFixed(6));
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

function printHeader(mode: "DRY-RUN" | "APPLY"): void {
  console.log("[f59-vertical-proof] Prova de provider 9:16");
  console.log(`Mode: ${mode}`);
  console.log(`Planned calls: ${PLANNED_CALLS}`);
  console.log(`Cap: US$${PROOF_CAP_USD.toFixed(2)}`);
  console.log(`Provider size: ${PROVIDER_SIZE}`);
  console.log(`Control size: ${CONTROL_SIZE}`);
}

function refuse(message: string): never {
  console.error(message);
  process.exit(2);
}

async function runDryRun(
  matrix: readonly PlannedCall[],
  unitSource: UnitCostSource | null,
): Promise<void> {
  printHeader("DRY-RUN");
  console.log(`Unit cost source: ${unitSource?.label ?? "(missing)"}`);

  if (unitSource === null) {
    for (const call of matrix) {
      console.log(
        `[${String(call.index).padStart(2, "0")}/${PLANNED_CALLS}] ${call.model} | ${call.quality} | ${call.requestedSize} | estimativa indisponível`,
      );
    }
    refuse("estimativa indisponível: informe --unit-usd ou --unit-usd-file");
  }

  let totalEstimatedUsd = 0;
  for (const call of matrix) {
    const unit = unitFor(unitSource, call);
    const estimate = estimateVerticalCall({
      model: call.model,
      quality: call.quality,
      imageUnitUsd: unit ?? null,
    });
    if (!estimate.available) {
      console.log(
        `[${String(call.index).padStart(2, "0")}/${PLANNED_CALLS}] ${call.model} | ${call.quality} | ${call.requestedSize} | estimativa indisponível`,
      );
      refuse(`estimativa indisponível para ${call.model}/${call.quality}`);
    }
    totalEstimatedUsd += estimate.estimatedUsd;
    console.log(
      `[${String(call.index).padStart(2, "0")}/${PLANNED_CALLS}] ${call.model} | ${call.quality} | ${call.requestedSize} | estimatedUsd=${estimate.estimatedUsd.toFixed(6)}`,
    );
  }

  console.log(`Estimated total: US$${totalEstimatedUsd.toFixed(6)}`);
  console.log("No provider call was made (dry-run).");
}

async function runApply(
  matrix: readonly PlannedCall[],
  unitSource: UnitCostSource | null,
): Promise<void> {
  const authorized = arg("authorized");
  const credential = process.env.OPENAI_API_KEY;
  if (
    !hasFlag("apply") ||
    authorized === null ||
    authorized.trim().length < 8 ||
    credential === undefined ||
    credential.trim().length === 0
  ) {
    refuse("PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA");
  }
  if (unitSource === null) {
    refuse("PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA (unit cost ausente)");
  }

  const primaryPath = arg("primary-image");
  if (primaryPath === null) {
    refuse("PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA (imagem primária ausente)");
  }

  const estimates = matrix.map((call) => {
    const unit = unitFor(unitSource, call);
    const estimate = estimateVerticalCall({
      model: call.model,
      quality: call.quality,
      imageUnitUsd: unit ?? null,
    });
    if (!estimate.available) {
      refuse(
        `PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA (estimativa ausente: ${call.model}/${call.quality})`,
      );
    }
    return estimate;
  });

  printHeader("APPLY");
  console.log(`Unit cost source: ${unitSource.label}`);

  const primaryDataUrl = await fileToDataUrl(primaryPath);
  const identityPath = arg("identity-image");
  const identityDataUrl =
    identityPath === null ? null : await fileToDataUrl(identityPath);
  console.log(
    `References: primary=present identity=${identityDataUrl === null ? "ausente" : "present"}`,
  );

  const pricingFile = loadPricingFile();
  console.log(
    `Token pricing: ${pricingFile === null ? "indisponível (calc: null)" : "fornecido"}`,
  );

  const adapter = new UpstreamImagesAdapter();
  let budget = createProofBudget({
    capUsd: PROOF_CAP_USD,
    plannedCalls: PLANNED_CALLS,
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
      matrixSize: PLANNED_CALLS,
      providerSize: PROVIDER_SIZE,
      controlSize: CONTROL_SIZE,
      primaryImage: "present",
      identityImage: identityDataUrl === null ? "absent" : "present",
      promptSource: "fixed",
      budget,
      calls,
      finishedAt,
    });
  };
  persist(null);

  let stoppedForUnknown = false;
  let stoppedForBudget = false;

  for (const call of matrix) {
    const estimate = estimates[call.index - 1];
    if (!canAfford(budget, estimate.estimatedUsd).ok) {
      stoppedForBudget = true;
      break;
    }
    const gate = remainingBudgetBlocks(budget, estimate.estimatedUsd);
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

      const decoded = await sharp(
        Buffer.from(result.imageBase64 ?? "", "base64"),
      ).metadata();
      const returnedWidth = decoded.width ?? null;
      const returnedHeight = decoded.height ?? null;
      const expectedSizeMatches =
        call.requestedSize === PROVIDER_SIZE
          ? returnedWidth === 1152 && returnedHeight === 2048
          : returnedWidth === 1024 && returnedHeight === 1024;

      const calculated =
        pricingFile === null
          ? null
          : calculateProductOneToOneImageUsageCost({
              usage: result.usage,
              pricing: pricingFile.pricing,
              pricingVersion: pricingFile.versionId,
              pricingSource: "pricing_table",
              model: call.model,
              quality: call.quality,
            });
      const calculatedFromUsageUsd = calculated?.estimatedCostUsd ?? null;
      const providerReportedUsd = result.providerReportedCostUsd ?? null;
      const chargedUsd = maxKnownCost(
        estimate.estimatedUsd,
        providerReportedUsd,
        calculatedFromUsageUsd,
      );

      budget = recordCall(budget, {
        estimatedUsd: estimate.estimatedUsd,
        providerReportedUsd,
        calculatedFromUsageUsd,
        target: call.target,
      });

      calls.push({
        index: call.index,
        model: call.model,
        quality: call.quality,
        kind: call.kind,
        target: call.target,
        isRetry: false,
        requestedSize: call.requestedSize,
        status: "succeeded",
        returnedWidth,
        returnedHeight,
        expectedSizeMatches,
        mimeType: result.mimeType ?? null,
        latencyMs: Date.now() - startedMs,
        providerReportedUsd,
        calculatedFromUsageUsd,
        calculatedCoverage: calculated?.productOneToOneImageUsage.coverage ?? null,
        calculatedMissing: calculated?.productOneToOneImageUsage.missing ?? [],
        estimatedUsd: estimate.estimatedUsd,
        chargedUsd,
        deviationUsd: Number((chargedUsd - estimate.estimatedUsd).toFixed(6)),
        providerUsagePresent: result.usage !== undefined,
        startedAt,
        finishedAt,
      });
      persist(null);
      console.log(
        `[${String(call.index).padStart(2, "0")}/${PLANNED_CALLS}] succeeded ${call.model} | ${call.quality} | ${call.requestedSize} | chargedUsd=${chargedUsd.toFixed(6)}`,
      );
    } catch (error) {
      const finishedAt = new Date().toISOString();
      budget = recordUnknownOutcome(budget, {
        estimatedUsd: estimate.estimatedUsd,
        target: call.target,
      });
      calls.push({
        index: call.index,
        model: call.model,
        quality: call.quality,
        kind: call.kind,
        target: call.target,
        isRetry: false,
        requestedSize: call.requestedSize,
        status: "unknown",
        returnedWidth: null,
        returnedHeight: null,
        expectedSizeMatches: null,
        mimeType: null,
        latencyMs: Date.now() - startedMs,
        providerReportedUsd: null,
        calculatedFromUsageUsd: null,
        calculatedCoverage: null,
        calculatedMissing: [],
        estimatedUsd: estimate.estimatedUsd,
        chargedUsd: estimate.estimatedUsd,
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
      stoppedForUnknown = true;
      console.log(
        `[${String(call.index).padStart(2, "0")}/${PLANNED_CALLS}] unknown ${call.model} | ${call.quality} | ${call.requestedSize} | reconciliacao exigida`,
      );
      break;
    }
  }

  const finishedAt = new Date().toISOString();
  persist(finishedAt);

  const executed = calls.length;
  const succeeded = calls.filter((call) => call.status === "succeeded");
  const maxRatio = succeeded.reduce((max, call) => {
    const ratio = call.chargedUsd / call.estimatedUsd;
    return Number.isFinite(ratio) ? Math.max(max, ratio) : max;
  }, 1);
  const calibrationVerdict =
    stoppedForUnknown
      ? "reconciliação pendente; multiplicador NÃO confirmado"
      : executed === 0
        ? "não calibrado (nenhuma chamada executada)"
        : maxRatio <= 1
          ? "confirmado conservador (custo real não superou a estimativa)"
          : `ajuste proposto: multiplicador >= ${(2.5 * maxRatio).toFixed(2)}`;

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
      `- Multiplicador provisório: **2,5** (2,25 de área + 0,25 de margem)`,
      `- Chamadas executadas: **${executed}/${PLANNED_CALLS}**`,
      `- Custo total cobrado: **US$${budget.totalChargedUsd.toFixed(6)}** de US$${PROOF_CAP_USD.toFixed(2)}`,
      `- Desvio acumulado vs. estimativa: **US$${budget.deviationUsd.toFixed(6)}**`,
      `- Maior razão cobrado/estimado: **${maxRatio.toFixed(4)}**`,
      `- Unknown: **${budget.unknownCalls}**; reconciliação exigida: **${budget.requiresReconciliation ? "sim" : "não"}**`,
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
    matrixSize: PLANNED_CALLS,
    providerSize: PROVIDER_SIZE,
    controlSize: CONTROL_SIZE,
    primaryImage: "present",
    identityImage: identityDataUrl === null ? "absent" : "present",
    promptSource: "fixed",
    budget,
    calls,
    pending,
    stoppedForUnknown,
    stoppedForBudget,
    calibrationVerdict,
    evidencePath,
    finishedAt,
  });

  console.log(
    `Summary: executed=${budget.executedCalls}/${PLANNED_CALLS} chargedUsd=${budget.totalChargedUsd.toFixed(6)} remainingUsd=${budget.remainingUsd.toFixed(6)} pending=${pending.length} unknown=${budget.unknownCalls}`,
  );
  console.log(`Evidence: ${evidencePath}`);
  console.log(`Calibration: ${calibrationPath}`);

  if (stoppedForUnknown) process.exit(4);
  if (stoppedForBudget) process.exit(5);
}

async function main(): Promise<void> {
  if (hasFlag("apply") && hasFlag("dry-run")) {
    refuse("Escolha --dry-run ou --apply, nunca os dois.");
  }
  const matrix = buildMatrix();
  const unitSource = loadUnitCostSource();

  if (hasFlag("apply")) {
    await runApply(matrix, unitSource);
  } else {
    await runDryRun(matrix, unitSource);
  }
}

main().catch((error: unknown) => {
  console.error(`[f59-vertical-proof] falha: ${safeErrorName(error)}`);
  process.exit(1);
});
