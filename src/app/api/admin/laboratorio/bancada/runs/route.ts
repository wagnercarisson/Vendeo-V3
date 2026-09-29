import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import { LAB_ARTIFACT_BUCKET } from "@/lib/lab/persistence/artifact-service";
import { buildBenchCampaignSnapshot } from "@/lib/lab/bench/domain/campaign-snapshot";
import {
  DEFAULT_BENCH_CONFIG,
  resolveBenchConfig,
} from "@/lib/lab/bench/domain/config-registry";
import {
  loadBenchBranding,
  toBenchBrandingSnapshot,
} from "@/lib/lab/bench/domain/branding-service";
import { BenchPresetError, resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import { BenchRunInputSchema } from "@/lib/lab/bench/domain/schemas";
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

// F48.2.2 (D10/D12/D13/T-48-2-2-32/33/34/36): confirmação e execução da geração.
//
// Ordem obrigatória: admin → guarda de ambiente → **confirmação explícita** (422,
// antes do parse completo) → parse Zod (400) → resolução do **`draft` existente**
// por `operation_id` (sem criar run; `runId`/autoria/estado validados) → preset
// habilitado (400 `preset_not_enabled`) → `assertBenchTestStore` antes de qualquer
// leitura com `storeId` → fixação da configuração em `draft` (`setBenchRunInput`)
// → **compare-and-set `draft → pending`** (`confirmBenchRun`, adquire o slot;
// violação ⇒ 409 `bench_run_already_active`, sem chamada paga) → stream NDJSON com
// **exatamente um** evento terminal.

/** Tabela de erros da bancada que a rota mapeia em HTTP. */
const CONFLICT_CODES: readonly string[] = ["bench_run_already_active"];

/** Extensão do path de entrada → MIME canônico aceito pelo bucket. */
const INPUT_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Converte as referências de entrada persistidas (`bench/{runId}/inputs/...`) em
 * data URLs para a invocação do modelo. Os paths já foram validados por
 * `parseBenchRunInput` (prefixo do próprio `runId`, sem traversal), então a
 * leitura é restrita ao bucket `lab-artifacts` — nunca ao bucket de campanha.
 */
async function readBenchInputDataUrls(
  client: SupabaseClient,
  references: readonly string[],
): Promise<string[]> {
  const dataUrls: string[] = [];
  for (const reference of references) {
    const { data, error } = await client.storage
      .from(LAB_ARTIFACT_BUCKET)
      .download(reference);
    if (error || !data) throw new Error("bench_input_download_failed");
    const buffer = Buffer.from(await data.arrayBuffer());
    const extension = reference.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = INPUT_MIME_BY_EXTENSION[extension] ?? "image/png";
    dataUrls.push(`data:${mimeType};base64,${buffer.toString("base64")}`);
  }
  return dataUrls;
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

  // Confirmação explícita **antes** do parse completo e de qualquer chamada paga.
  if (
    raw === null ||
    typeof raw !== "object" ||
    (raw as Record<string, unknown>).confirmed !== true
  ) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 422 });
  }

  const parsed = BenchRunInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Preflight aprovado é OBRIGATÓRIO (D17/D20): a geração sem prompt aprovado é
  // recusada. A aprovação é explícita e o `prompt_sent` será **exatamente** o
  // prompt final aprovado — nenhuma transformação após a aprovação.
  const approvedPrompt = input.preflight?.promptApproved;
  if (
    !input.preflight ||
    typeof approvedPrompt !== "string" ||
    approvedPrompt.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "confirmation_required", details: ["preflight"] },
      { status: 422 },
    );
  }
  if (input.prompt !== approvedPrompt) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["prompt"] },
      { status: 400 },
    );
  }

  // Resolve o `draft` existente por `operation_id` — **nenhum run é criado aqui**.
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

  // Preset habilitado — recusa antes de qualquer chamada paga.
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

  // Manifesto ANTES de qualquer leitura com `storeId` (branding/tabela/storage).
  try {
    await assertBenchTestStore({ client: supabaseAdmin, storeId: input.storeId });
  } catch (error) {
    if (error instanceof BenchStoreManifestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  // Derivação explícita: dimensões travadas do primeiro recorte (registry em
  // código) + `modelo`/`qualidade` do preset. O `BenchPreset` não possui campo
  // `config` — a configuração nunca é lida dele.
  const config = resolveBenchConfig({
    ...DEFAULT_BENCH_CONFIG,
    modelo: preset.model,
    qualidade: preset.quality,
  });
  const campaignSnapshot = buildBenchCampaignSnapshot({
    product: input.product,
    offer: input.offer,
    config,
  });
  const brandingSnapshot = toBenchBrandingSnapshot(
    await loadBenchBranding({ client: supabaseAdmin, storeId: input.storeId }),
  );

  try {
    await setBenchRunInput({
      client: supabaseAdmin,
      runId: existing.id,
      campaignSnapshot,
      brandingSnapshot,
      config,
      // `prompt_sent` = prompt final aprovado (D20). A evidência mínima do preflight
      // é persistida no run `draft` (reusa `prompt_sent`/`campaign_snapshot`).
      promptSent: approvedPrompt,
      promptBase: input.preflight.promptBase,
      promptCompiled: input.preflight.promptCompiled,
      promptApproved: approvedPrompt,
      promptBlocks: input.preflight.promptBlocks,
      composerVersion: input.preflight.composerVersion,
      references: input.references,
      provider: preset.provider,
      protocol: preset.protocol,
      model: preset.model,
      size: preset.size,
      quality: preset.quality,
      intent: config.intencao,
      contentType: config.tipoConteudo,
      structure: config.estrutura,
      theme: config.tema,
    });
  } catch (error) {
    if (error instanceof BenchRunError && error.code === "missing_snapshot") {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
    throw error;
  }

  // Compare-and-set `draft → pending`: adquire o slot global atomicamente.
  try {
    await confirmBenchRun({ client: supabaseAdmin, runId: existing.id });
  } catch (error) {
    if (error instanceof BenchRunError && CONFLICT_CODES.includes(error.code)) {
      return NextResponse.json({ error: error.code }, { status: 409 });
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
        const productImagesDataUrls = await readBenchInputDataUrls(
          supabaseAdmin,
          input.references,
        );

        const outcome = await executeBenchRun({
          client: supabaseAdmin,
          gateway,
          telemetrySink: sink,
          run: { id: runId },
          preset,
          request: { prompt: approvedPrompt, productImagesDataUrls },
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
        // Mensagem fixa e sanitizada: o stream nunca vaza token nem URL.
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
