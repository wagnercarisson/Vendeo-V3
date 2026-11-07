import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import { computeArtifactChecksum, LAB_ARTIFACT_BUCKET } from "@/lib/lab/persistence/artifact-service";
import { computeExpandGeometry } from "@/lib/lab/bench/domain/expand-geometry";
import {
  DEFAULT_EXPAND_9_16_PROMPT,
  EXPAND_9_16_PROMPT_VERSION,
} from "@/lib/lab/bench/domain/expand-prompt";
import { BenchExpandRunInputSchema } from "@/lib/lab/bench/domain/expand-schema";
import { BenchPresetError, resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import {
  BenchStoreManifestError,
  assertBenchTestStore,
} from "@/lib/lab/bench/domain/store-manifest";
import { executeBenchRun } from "@/lib/lab/bench/execution/bench-execution-service";
import {
  createBenchAdapterRegistry,
  createBenchGateway,
} from "@/lib/lab/bench/gateway/runtime";
import {
  BenchRunError,
  confirmBenchRun,
  getBenchRunByOperationId,
  setBenchRunInput,
} from "@/lib/lab/bench/persistence/bench-run-service";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { createLabTelemetryContext } from "@/lib/lab/gateway/runtime";
import { supabaseAdmin } from "@/lib/supabase/server";
import { validateArtifactTechnically } from "@/lib/lab/technical-validation";

/**
 * Expansão de campanha pronta para 9:16 (quick 261107-qvo) — operação
 * **isolada** do fluxo comercial.
 *
 * Não usa produto/oferta, compositor comercial, branding, identidade, máscara
 * ou política de formato. Recebe **uma** imagem já pronta e um prompt aprovado,
 * calcula a geometria solicitada, executa uma única chamada `images.edit` e
 * persiste a evidência no run genérico da bancada.
 */

const INPUT_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

async function readSingleInputData(
  client: SupabaseClient,
  reference: string,
): Promise<{ buffer: Buffer; mimeType: string; dataUrl: string }> {
  const { data, error } = await client.storage
    .from(LAB_ARTIFACT_BUCKET)
    .download(reference);
  if (error || !data) throw new Error("bench_input_download_failed");
  const buffer = Buffer.from(await data.arrayBuffer());
  const extension = reference.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = INPUT_MIME_BY_EXTENSION[extension] ?? "image/png";
  return {
    buffer,
    mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
  };
}

/** Operação persistida no marcador de draft (`config.operation`). */
function operationFromConfig(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const candidate = (config as { operation?: unknown }).operation;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  try {
    assertLabEnvironment();
  } catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), {
        status: 403,
      });
    }
    throw error;
  }

  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }

  if (
    raw === null ||
    typeof raw !== "object" ||
    (raw as Record<string, unknown>).confirmed !== true
  ) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 422 });
  }

  const parsed = BenchExpandRunInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.promptApproved.trim().length === 0) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["promptApproved"] },
      { status: 400 },
    );
  }
  if (
    input.promptVersion !== undefined &&
    input.promptVersion !== EXPAND_9_16_PROMPT_VERSION
  ) {
    return NextResponse.json(
      { error: "bench_expand_prompt_version_mismatch" },
      { status: 400 },
    );
  }

  const existing = await getBenchRunByOperationId({
    client: supabaseAdmin,
    operationId: input.operationId,
  });
  if (!existing) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (existing.id !== input.runId) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (existing.createdBy !== admin.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    existing.status === "succeeded" ||
    existing.status === "failed" ||
    existing.status === "cancelled" ||
    existing.status === "timeout"
  ) {
    return NextResponse.json(
      { idempotent: true, runId: existing.id },
      { status: 200 },
    );
  }
  if (existing.status === "pending" || existing.status === "running") {
    return NextResponse.json(
      { error: "bench_run_already_active" },
      { status: 409 },
    );
  }
  if (operationFromConfig(existing.config) !== "expand") {
    return NextResponse.json(
      { error: "bench_operation_mismatch" },
      { status: 409 },
    );
  }

  let preset;
  try {
    preset = resolveBenchPreset(input.presetId);
  } catch (error) {
    if (error instanceof BenchPresetError) {
      return NextResponse.json(
        { error: "preset_not_enabled", reason: error.reason },
        { status: 400 },
      );
    }
    throw error;
  }

  let store;
  try {
    store = await assertBenchTestStore({
      client: supabaseAdmin,
      storeId: input.storeId,
    });
  } catch (error) {
    if (error instanceof BenchStoreManifestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const reference = input.references[0];
  let sourceData;
  try {
    sourceData = await readSingleInputData(supabaseAdmin, reference);
  } catch {
    return NextResponse.json(
      { error: "bench_expand_source_invalid" },
      { status: 400 },
    );
  }

  const sourceValidation = await validateArtifactTechnically({
    buffer: sourceData.buffer,
    declaredMimeType: sourceData.mimeType,
  });
  if (
    !sourceValidation.decodable ||
    sourceValidation.width === null ||
    sourceValidation.height === null
  ) {
    return NextResponse.json(
      { error: "bench_expand_source_invalid" },
      { status: 400 },
    );
  }

  const geometry = computeExpandGeometry({
    width: sourceValidation.width,
    height: sourceValidation.height,
  });
  if (!geometry.supported) {
    return NextResponse.json(
      {
        error:
          geometry.reason === "no_expansion_needed"
            ? "bench_expand_not_needed"
            : "bench_expand_geometry_unsupported",
        reason: geometry.reason,
        source: geometry.source,
        target: geometry.target,
        proposedSolution: geometry.proposedSolution,
      },
      { status: 400 },
    );
  }

  const source = {
    storagePath: reference,
    mimeType: sourceValidation.mimeType ?? sourceData.mimeType,
    width: sourceValidation.width,
    height: sourceValidation.height,
    bytes: sourceData.buffer.byteLength,
    checksum: computeArtifactChecksum(sourceData.buffer),
  };
  const sourceDataUrl = `data:${source.mimeType};base64,${sourceData.buffer.toString("base64")}`;
  const promptVersion = EXPAND_9_16_PROMPT_VERSION;
  const promptEdited = input.promptApproved !== DEFAULT_EXPAND_9_16_PROMPT;
  const target = {
    width: geometry.target.width,
    height: geometry.target.height,
    format: geometry.target.format,
    size: geometry.target.size,
  };
  const expansionSnapshot = {
    operation: "expand",
    storeId: input.storeId,
    storeName: store.name,
    source,
    target,
    geometry,
    promptVersion,
    promptEdited,
  };
  const config = {
    operation: "expand",
    formato: geometry.target.format,
    promptVersion,
    promptEdited,
    source,
    target,
    geometry,
  };

  try {
    await setBenchRunInput({
      client: supabaseAdmin,
      runId: existing.id,
      campaignSnapshot: expansionSnapshot,
      brandingSnapshot: {
        storeId: input.storeId,
        storeName: store.name,
        operation: "expand",
      },
      config,
      promptSent: input.promptApproved,
      promptApproved: input.promptApproved,
      references: input.references,
      provider: preset.provider,
      protocol: preset.protocol,
      model: preset.model,
      size: geometry.target.size,
      quality: preset.quality,
    });
  } catch (error) {
    if (error instanceof BenchRunError) {
      return NextResponse.json(
        { error: "bench_run_transition_failed" },
        { status: 409 },
      );
    }
    throw error;
  }

  try {
    await confirmBenchRun({ client: supabaseAdmin, runId: existing.id });
  } catch (error) {
    if (error instanceof BenchRunError) {
      if (error.code === "bench_run_already_active") {
        return NextResponse.json(
          { error: "bench_run_already_active" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: error.code },
        { status: 409 },
      );
    }
    throw error;
  }

  const runId = existing.id;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let terminal = false;
      const emit = (event: Record<string, unknown>): void => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Stream fechado pelo cliente: a execução continua dona do run.
        }
      };

      try {
        emit({ type: "phase", phase: "running" });

        const sink = new LabTelemetrySink({
          onEntry: () => emit({ type: "phase", phase: "provider" }),
        });
        const { defaultAiModelResolver } = await import("@/lib/ai");
        const gateway = createBenchGateway({
          preset,
          adapters: createBenchAdapterRegistry(),
          fallbackResolver: defaultAiModelResolver,
        });
        const telemetry = createLabTelemetryContext({
          sink,
          operationRunId: runId,
          traceId: randomUUID(),
          storeId: input.storeId,
          userId: admin.userId,
        });

        const outcome = await executeBenchRun({
          client: supabaseAdmin,
          gateway,
          telemetrySink: sink,
          run: { id: runId },
          preset,
          request: {
            prompt: input.promptApproved,
            productImagesDataUrls: [sourceDataUrl],
            size: geometry.target.size,
            expectedAspectRatio: geometry.target.width / geometry.target.height,
            expectedWidth: geometry.target.width,
            expectedHeight: geometry.target.height,
          },
          telemetry,
        });

        if (outcome.status === "succeeded") {
          terminal = true;
          emit({ type: "done", runId });
        } else {
          terminal = true;
          emit({
            type: "error",
            code: outcome.errorType ?? "run_failed",
            message: outcome.errorMessage ?? "Execução falhou",
          });
        }
      } catch {
        if (!terminal) {
          terminal = true;
          emit({ type: "error", code: "run_failed", message: "Execução falhou" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
});
