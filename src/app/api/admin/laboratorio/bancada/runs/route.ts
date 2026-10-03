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
import { buildBenchExperimentalBriefing } from "@/lib/lab/bench/domain/experimental-briefing";
import {
  BenchPreflightRevalidationError,
  assertPreflightCompositionMatches,
  assertPreflightEvidenceMatches,
  recomposeBenchPrompt,
  resolveServerResolvedEvidence,
  validateBenchTextIntegrityEvidence,
} from "@/lib/lab/bench/domain/preflight-revalidation";
import { resolveBenchDefaultPromptBase } from "@/lib/lab/bench/domain/prompt-base";
import { BenchPresetError, resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import { validateBenchIntentPrice } from "@/lib/lab/bench/domain/intent-price-matrix";
import { BenchRunInputSchema } from "@/lib/lab/bench/domain/schemas";
import { collectBenchTextIntegrityFields } from "@/lib/lab/bench/domain/text-integrity-detector";
import {
  BenchStoreManifestError,
  assertBenchTestStore,
} from "@/lib/lab/bench/domain/store-manifest";
import { executeBenchRun } from "@/lib/lab/bench/execution/bench-execution-service";
import {
  BenchIdentityTransportError,
  resolveBenchIdentityImageDataUrl,
} from "@/lib/lab/bench/execution/bench-identity-transport";
import {
  createBenchAdapterRegistry,
  createBenchGateway,
} from "@/lib/lab/bench/gateway/runtime";
import {
  BenchRunError,
  confirmBenchRun,
  getBenchRunByOperationId,
  listBenchRunLineagesByStore,
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const commercialError = parsed.error.issues.find(
      (issue) =>
        issue.message === "bench_intent_price_incompatible" ||
        issue.message === "bench_validity_only_allowed_for_offer",
    );
    if (commercialError) {
      return NextResponse.json({ error: commercialError.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Defesa da rota além do schema: validar pela mesma autoridade antes de
  // consultar draft/loja, recompor ou executar qualquer efeito operacional.
  const intent = input.offer.campaignIntent ?? "offer";
  const intentPriceValidation = validateBenchIntentPrice(
    input.product.originalPriceCents,
    input.product.priceCents,
    intent,
  );
  if (!intentPriceValidation.valid) {
    return NextResponse.json({ error: intentPriceValidation.error }, { status: 400 });
  }
  if (intent !== "offer" && (input.offer.validUntil !== undefined || input.offer.validity !== undefined)) {
    return NextResponse.json(
      { error: "bench_validity_only_allowed_for_offer" },
      { status: 400 },
    );
  }

  // A revisão textual é o primeiro gate após o parse. Até a ausência completa de
  // preflight/evidência recusa com stale antes de ler ou reservar qualquer run.
  const textIntegrityReview = validateBenchTextIntegrityEvidence({
    fields: collectBenchTextIntegrityFields({
      product: input.product,
      promptBase: input.preflight?.promptBase ?? "",
    }),
    evidence: input.preflight?.textIntegrityEvidence,
    requireEvidence: true,
  });
  if (!textIntegrityReview.ok) {
    return NextResponse.json(
      { error: "text_integrity_review_stale", textIntegrityReview: textIntegrityReview.review },
      { status: 409 },
    );
  }

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

  const branding = await loadBenchBranding({
    client: supabaseAdmin,
    storeId: input.storeId,
  });
  const brandingSnapshot = toBenchBrandingSnapshot(branding);
  const briefing = buildBenchExperimentalBriefing({
    branding,
    snapshot: campaignSnapshot,
    config,
  });

  // Referência canônica da identidade (sem URL assinada — D10/D14).
  const identityReference = branding.identityReference
    ? {
        kind: branding.identityReference.kind,
        variantType: branding.identityReference.variantType,
        storagePath: branding.identityReference.storagePath,
      }
    : null;

  // ── Revalidação server-side do preflight (D11) — ANTES do CAS e do provider ──
  // (a) recompõe o prompt a partir das entradas atuais e exige igualdade byte a
  // byte com o `promptCompiled` aprovado; (b) compara a **evidência textual**
  // aprovada (políticas/prompt-base/compositor/identidade) com os valores
  // RESOLVIDOS NO SERVIDOR — campo a campo, sem hash. QUALQUER divergência ⇒ 409
  // `approval_invalidated`, sem chamada paga.
  //
  // `presetId`/`modelo`/`qualidade` NÃO entram nessa comparação (correção de UAT):
  // são **configuração de execução** — validados por `resolveBenchPreset` abaixo e
  // persistidos no run (`provider`/`protocol`/`model`/`size`/`quality`). Trocar de
  // preset/modelo/qualidade reutiliza o MESMO prompt aprovado byte a byte, exigindo
  // apenas nova estimativa e nova confirmação financeira (no cliente), nunca nova
  // composição/aprovação.
  const recomposition = recomposeBenchPrompt({
    briefing,
    promptBase: input.preflight.promptBase,
    references: input.references,
    config,
    identityReference,
  });

  try {
    assertPreflightCompositionMatches({
      recomposed: recomposition.text,
      promptCompiled: input.preflight.promptCompiled,
    });
  } catch (error) {
    if (error instanceof BenchPreflightRevalidationError) {
      // Composição divergente ⇒ 409 approval_invalidated (evidência obsoleta).
      return NextResponse.json({ error: "approval_invalidated" }, { status: 409 });
    }
    throw error;
  }

  const defaultPromptBase = resolveBenchDefaultPromptBase(config);
  const currentEvidence = resolveServerResolvedEvidence({
    recomposition,
    promptBaseVersion: defaultPromptBase.version,
    identityReference,
  });

  try {
    assertPreflightEvidenceMatches({
      approved: {
        policyVersions: input.preflight.policyVersions ?? null,
        promptBaseVersion: input.preflight.promptBaseVersion ?? null,
        composerVersion: input.preflight.composerVersion,
        identityReference: input.preflight.identityReference ?? null,
      },
      current: currentEvidence,
    });
  } catch (error) {
    if (error instanceof BenchPreflightRevalidationError) {
      // Evidência textual divergente (políticas/prompt-base/compositor/identidade)
      // ⇒ 409 approval_invalidated, sem hash persistido.
      return NextResponse.json({ error: "approval_invalidated" }, { status: 409 });
    }
    throw error;
  }

  // ── Transporte canônico da identidade (D10) — fail-closed ANTES da chamada paga.
  let identityImageUrl: string | null;
  try {
    identityImageUrl = await resolveBenchIdentityImageDataUrl({
      client: supabaseAdmin,
      identityState: branding.identityState,
      identityReference,
    });
  } catch (error) {
    if (error instanceof BenchIdentityTransportError) {
      // `bench_identity_reference_unavailable` (ou `_incompatible`): identidade
      // exigida indisponível — recusa antes de qualquer chamada paga, sem fallback.
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

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
      // Novas evidências SEMPRE com os valores RESOLVIDOS NO SERVIDOR (nunca os do
      // cliente): versões das políticas, versão do prompt-base padrão e referência
      // canônica da identidade (sem URL assinada).
      policyVersions: currentEvidence.policyVersions,
      promptBaseVersion: currentEvidence.promptBaseVersion ?? undefined,
      identityReference: currentEvidence.identityReference,
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
          request: {
            prompt: approvedPrompt,
            productImagesDataUrls,
            // Identidade canônica já resolvida (última referência; ausente em
            // `text_only`). Nunca re-resolvida aqui (D10).
            ...(identityImageUrl ? { identityImageUrl } : {}),
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

// ─── GET /runs?storeId=... (linhagens separadas por loja — D13/D15) ───────────
//
// Ordem obrigatória: admin → guarda de ambiente → `storeId` (400) →
// `assertBenchTestStore` ANTES de qualquer leitura com `storeId`. Devolve
// **múltiplas linhagens separadas** (uma por raiz) via
// `listBenchRunLineagesByStore`: campanhas independentes da mesma loja NUNCA são
// mescladas, e descendentes `draft` aparecem agrupados sob sua raiz pela linhagem
// (`attempt_of_run_id`). Nenhum secret é exposto.
export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

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

  const storeId = new URL(request.url).searchParams.get("storeId") ?? "";
  if (!UUID_REGEX.test(storeId)) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["storeId"] },
      { status: 400 },
    );
  }

  // Manifesto ANTES de qualquer leitura com `storeId`.
  try {
    await assertBenchTestStore({ client: supabaseAdmin, storeId });
  } catch (error) {
    if (error instanceof BenchStoreManifestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const lineages = await listBenchRunLineagesByStore({
    client: supabaseAdmin,
    storeId,
  });

  return NextResponse.json({
    lineages: lineages.map((lineage) => ({
      rootId: lineage.root.id,
      runs: lineage.runs.map((run) => ({
        id: run.id,
        status: run.status,
        attemptOfRunId: run.attemptOfRunId,
        createdAt: run.createdAt,
        finishedAt: run.finishedAt,
        promptBaseVersion: run.promptBaseVersion,
        estimatedCostUsd: run.estimatedCostUsd,
      })),
    })),
  });
});
