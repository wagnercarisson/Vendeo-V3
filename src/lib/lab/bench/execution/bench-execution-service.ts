import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiInvoker } from "@/lib/ai/gateway";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import {
  AiInvocationError,
  sanitizeAiErrorMessage,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "@/lib/ai/types";
import type { LabArtifactMimeType } from "@/lib/lab/persistence/artifact-service";
import { runLabCampaignImage } from "@/lib/lab/gateway/runtime";
import {
  validateArtifactTechnically,
  type LabTechnicalValidation,
} from "@/lib/lab/technical-validation";
import type { BenchPreset } from "../domain/preset-registry";
import { buildBenchInvocationRequest } from "../gateway/runtime";
import { persistBenchArtifact } from "../persistence/bench-artifact-service";
import { finalizeBenchRun, markBenchRunRunning } from "../persistence/bench-run-service";
import { BENCH_COST_SOURCE, resolveBenchCost, type BenchCostResolution } from "./bench-cost-resolver";

/**
 * Orquestração **single-shot** da geração da bancada (F48.2.2, D8/D11/D13).
 *
 * Executa **exatamente uma** chamada paga por geração (sem fallback, sem retry e
 * sem segunda chamada), persiste a saída no bucket local, valida tecnicamente,
 * acumula a telemetria **read-only** (`LabTelemetrySink`, sem gravar telemetria
 * produtiva de geração)
 * e resolve o custo pelo **resolvedor local da bancada** (`resolveBenchCost`,
 * `cost_source: "bench_local_pricing"` + `cost_rule_version`), mantendo o
 * usage/custo do provider em campo **separado**.
 *
 * Em erro: finaliza como `failed` com erro **sanitizado**
 * (`sanitizeAiErrorMessage`) — nunca persiste chave/URL/segredo — e **não** tenta
 * novamente. O client Supabase entra **por parâmetro** (fakes em testes; nenhuma
 * chamada de rede e nenhuma chamada paga).
 */

export interface BenchExecutionRequest {
  prompt: string;
  productImagesDataUrls?: readonly string[];
  /**
   * Identidade visual canônica (data URL) já resolvida por
   * `resolveBenchIdentityImageDataUrl` (F48.2.4, D10). Repassada ao adapter da
   * bancada como a última referência; ausente em `text_only`.
   */
  identityImageUrl?: string;
  signal?: AbortSignal;
  timeout?: number;
  /** Tamanho efetivo do formato (`1:1`/`9:16`). Default: `preset.size`. */
  size?: string;
  /** Proporção esperada do artefato (`1` ou `9/16`). */
  expectedAspectRatio?: number;
  /** Dimensão exata esperada (quando o formato exige validação fail-closed). */
  expectedWidth?: number;
  expectedHeight?: number;
}

export interface ExecuteBenchRunParams {
  client: SupabaseClient;
  gateway: AiInvoker;
  telemetrySink: LabTelemetrySink;
  run: { id: string };
  preset: BenchPreset;
  request: BenchExecutionRequest;
  telemetry: AiTelemetryContext;
}

export interface BenchExecutionOutcome {
  status: "succeeded" | "failed";
  latencyMs: number;
  cost: BenchCostResolution | null;
  artifact?: { storagePath: string; checksum: string; bytes: number };
  validation?: LabTechnicalValidation;
  errorType?: string;
  errorMessage?: string;
}

/** Finaliza como falha sem sobrescrever um estado terminal já gravado. */
async function finalizeFailure(params: {
  client: SupabaseClient;
  runId: string;
  errorType: string;
  errorMessage: string;
  preset: BenchPreset;
  size: string;
  telemetrySink: LabTelemetrySink;
  latencyMs?: number;
  usage?: AiInvocationResult["usage"];
  cost?: BenchCostResolution | null;
  validation?: LabTechnicalValidation;
}): Promise<void> {
  const { cost } = params;
  try {
    await finalizeBenchRun({
      client: params.client,
      runId: params.runId,
      status: "failed",
      errorType: params.errorType,
      errorMessage: params.errorMessage,
      ...(params.latencyMs !== undefined ? { latencyMs: params.latencyMs } : {}),
      ...(params.usage !== undefined ? { usage: params.usage } : {}),
      ...(params.validation !== undefined
        ? { technicalValidation: params.validation }
        : {}),
      ...(cost
        ? {
            estimatedCostUsd: cost.estimatedCostUsd,
            costDetail: buildCostDetail({
              preset: params.preset,
              cost,
              size: params.size,
              validation: params.validation,
              telemetrySink: params.telemetrySink,
            }),
            costSource: cost.costSource,
            costRuleVersion: cost.costRuleVersion,
          }
        : { costSource: BENCH_COST_SOURCE }),
    });
  } catch {
    // Já finalizado (ex.: rollback do artefato chamou finalizeRun) — terminal é
    // imutável; nada a fazer.
  }
}

/** Evidência de custo/execução persistida em `cost_detail` (sem secrets). */
function buildCostDetail(params: {
  preset: BenchPreset;
  cost: BenchCostResolution;
  size: string;
  artifact?: { storagePath: string; checksum: string; bytes: number };
  validation?: LabTechnicalValidation;
  telemetrySink: LabTelemetrySink;
}): Record<string, unknown> {
  const { cost, preset } = params;
  return {
    cost_source: cost.costSource,
    cost_rule_version: cost.costRuleVersion,
    mode: cost.mode,
    coverage: cost.coverage,
    is_estimate: cost.isEstimate,
    estimated_cost_usd: cost.estimatedCostUsd,
    provider_reported_cost_usd: cost.providerReportedCostUsd ?? null,
    usage_reported: cost.usageReported ?? null,
    provider: preset.provider,
    model: preset.model,
    protocol: preset.protocol,
    size: params.size,
    quality: preset.quality,
    ...(params.artifact ? { artifact: params.artifact } : {}),
    ...(params.validation
      ? {
          returned_width: params.validation.width,
          returned_height: params.validation.height,
          technical_alerts: params.validation.alerts,
        }
      : {}),
    telemetry_entries: params.telemetrySink.entries.length,
  };
}

export async function executeBenchRun(
  params: ExecuteBenchRunParams,
): Promise<BenchExecutionOutcome> {
  const { client, gateway, telemetrySink, preset, telemetry } = params;
  const runId = params.run.id;
  const size = params.request.size ?? preset.size;
  const startedAt = Date.now();

  await markBenchRunRunning({ client, runId });

  const invocationRequest = buildBenchInvocationRequest({
    preset,
    prompt: params.request.prompt,
    size,
    productImagesDataUrls: params.request.productImagesDataUrls,
    identityImageUrl: params.request.identityImageUrl,
    signal: params.request.signal,
    timeout: params.request.timeout,
  });

  let result: AiInvocationResult;
  try {
    // Single-shot: exatamente uma invocação, sem fallback e sem segunda chamada.
    result = await runLabCampaignImage({ gateway, request: invocationRequest, telemetry });
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const errorType = err instanceof AiInvocationError ? err.kind : "provider_error";
    const errorMessage = sanitizeAiErrorMessage(err instanceof Error ? err.message : String(err));
    await finalizeFailure({
      client,
      runId,
      errorType,
      errorMessage,
      preset,
      size,
      telemetrySink,
      latencyMs,
    });
    return { status: "failed", latencyMs, cost: null, errorType, errorMessage };
  }

  const latencyMs = Date.now() - startedAt;
  const cost = resolveBenchCost({
    preset,
    size,
    usage: result.usage,
    providerReportedCostUsd: result.providerReportedCostUsd,
  });

  let validation: LabTechnicalValidation | undefined;

  try {
    if (!result.imageBase64) {
      throw new Error("bench_execution_no_image");
    }
    const buffer = Buffer.from(result.imageBase64, "base64");
    const mimeType = (result.mimeType ?? "image/png") as LabArtifactMimeType;

    validation = await validateArtifactTechnically({
      buffer,
      declaredMimeType: result.mimeType ?? null,
      expectedAspectRatio: params.request.expectedAspectRatio ?? 1,
      ...(params.request.expectedWidth !== undefined
        ? { expectedWidth: params.request.expectedWidth }
        : {}),
      ...(params.request.expectedHeight !== undefined
        ? { expectedHeight: params.request.expectedHeight }
        : {}),
    });

    // Fail-closed: dimensão/proporção divergente não vira sucesso e não é
    // mascarada por resize. Se o provider já respondeu (e cobrou), a evidência
    // de usage/custo/dimensões é persistida na falha.
    if (validation.alerts.includes("dimensions_mismatch")) {
      const errorType = "bench_dimensions_mismatch";
      const errorMessage = "Dimensão do artefato divergente do formato solicitado";
      await finalizeFailure({
        client,
        runId,
        errorType,
        errorMessage,
        preset,
        size,
        telemetrySink,
        latencyMs,
        usage: result.usage,
        cost,
        validation,
      });
      return {
        status: "failed",
        latencyMs,
        cost,
        validation,
        errorType,
        errorMessage,
      };
    }

    const artifact = await persistBenchArtifact({
      client,
      runId,
      kind: "output",
      buffer,
      mimeType,
      width: validation.width,
      height: validation.height,
      finalizeRun: async ({ runId: id, status, errorType }) => {
        await finalizeBenchRun({ client, runId: id, status, errorType });
      },
    });

    const costDetail = buildCostDetail({
      preset,
      cost,
      size,
      artifact,
      validation,
      telemetrySink,
    });

    await finalizeBenchRun({
      client,
      runId,
      status: "succeeded",
      latencyMs,
      usage: result.usage,
      estimatedCostUsd: cost.estimatedCostUsd,
      costDetail,
      costSource: cost.costSource,
      costRuleVersion: cost.costRuleVersion,
      technicalValidation: validation,
    });

    return {
      status: "succeeded",
      latencyMs,
      cost,
      artifact: {
        storagePath: artifact.storagePath,
        checksum: artifact.checksum,
        bytes: artifact.bytes,
      },
      validation,
    };
  } catch (err) {
    const errorMessage = sanitizeAiErrorMessage(err instanceof Error ? err.message : String(err));
    const errorType = "bench_execution_failed";
    await finalizeFailure({
      client,
      runId,
      errorType,
      errorMessage,
      preset,
      size,
      telemetrySink,
      latencyMs,
      usage: result.usage,
      cost,
      ...(validation !== undefined ? { validation } : {}),
    });
    return { status: "failed", latencyMs, cost, ...(validation ? { validation } : {}), errorType, errorMessage };
  }
}
