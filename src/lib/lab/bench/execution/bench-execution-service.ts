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
  /** Proporção esperada do artefato (primeiro recorte: `1`). */
  expectedAspectRatio?: number;
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
}): Promise<void> {
  try {
    await finalizeBenchRun({
      client: params.client,
      runId: params.runId,
      status: "failed",
      errorType: params.errorType,
      errorMessage: params.errorMessage,
      costSource: BENCH_COST_SOURCE,
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
  artifact: { storagePath: string; checksum: string; bytes: number };
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
    size: preset.size,
    quality: preset.quality,
    artifact: params.artifact,
    telemetry_entries: params.telemetrySink.entries.length,
  };
}

export async function executeBenchRun(
  params: ExecuteBenchRunParams,
): Promise<BenchExecutionOutcome> {
  const { client, gateway, telemetrySink, preset, telemetry } = params;
  const runId = params.run.id;
  const startedAt = Date.now();

  await markBenchRunRunning({ client, runId });

  const invocationRequest = buildBenchInvocationRequest({
    preset,
    prompt: params.request.prompt,
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
    await finalizeFailure({ client, runId, errorType, errorMessage });
    return { status: "failed", latencyMs, cost: null, errorType, errorMessage };
  }

  const latencyMs = Date.now() - startedAt;
  const cost = resolveBenchCost({
    preset,
    usage: result.usage,
    providerReportedCostUsd: result.providerReportedCostUsd,
  });

  try {
    if (!result.imageBase64) {
      throw new Error("bench_execution_no_image");
    }
    const buffer = Buffer.from(result.imageBase64, "base64");
    const mimeType = (result.mimeType ?? "image/png") as LabArtifactMimeType;

    const validation = await validateArtifactTechnically({
      buffer,
      declaredMimeType: result.mimeType ?? null,
      expectedAspectRatio: params.request.expectedAspectRatio ?? 1,
    });

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

    const costDetail = buildCostDetail({ preset, cost, artifact, telemetrySink });

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
    await finalizeFailure({ client, runId, errorType, errorMessage });
    return { status: "failed", latencyMs, cost, errorType, errorMessage };
  }
}
