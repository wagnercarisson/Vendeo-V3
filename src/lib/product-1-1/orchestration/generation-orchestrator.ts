import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import { createNewFlowImageGateway } from "@/lib/ai/upstream-images-runtime";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationRequest, AiTelemetryContext } from "@/lib/ai/types";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type {
  CurrentImageGenerationConfig,
  ImageGenerationConfigSnapshot,
} from "@/lib/ai/image-generation-config-snapshot";
import { generateSupportReference } from "@/lib/ai/image-generation-support-reference";
import {
  classifyImageGenerationFailure,
  nextImageGenerationAttempt,
} from "@/lib/ai/image-generation-failure-policy";

import { runNewFlowPreflight, type NewFlowPreflightResult } from "./preflight";
import { ProductOneToOneAttemptStartClient } from "./attempt-start-client";
import type {
  AttemptStartResult,
  AttemptTarget,
  CampaignOperationState,
} from "./attempt-start-types";
import {
  recordAttempt,
  type AttemptOperationState,
  type RecordAttemptInput,
} from "./attempt-history";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import type { CreditOperationState } from "../credit-operation/types";
import { ProductOneToOneArtifactStore } from "../artifact/artifact-store";
import type { ProductOneToOneArtifactRef } from "../artifact/types";
import {
  buildProductOneToOneSnapshot,
  buildProductOneToOneFrozenEvidence,
  persistProductOneToOneSnapshot,
  type PersistProductOneToOneSnapshotResult,
  type ProductOneToOneEvidenceReference,
  type BuildProductOneToOneSnapshotContext,
} from "../snapshot/persist-snapshot";
import { composeProductPrompt } from "../prompt-composition";
import { PRODUCT_1_1_PROMPT_BASE } from "../prompt-base";
import type { ProductOneToOneBackgroundDirection } from "../background-direction";
import type { ProductOneToOneIntent } from "../intent-selection";
import type { ProductPromptCompositionBriefing } from "../policies/types";

/**
 * F56.2b1b (B1B-D2/D4/D5/D12, C1/C5/I1/I2, F1–F8) — orquestrador NDJSON do novo
 * fluxo Produto 1:1 rodando **dentro do ciclo da requisição**.
 *
 * Fluxo (C5 — ordem EXATA): pré-checagens já feitas pela rota → (0) curto-circuito
 * `operação existe ⇒ consulta` (F6/I1) → (1) preflight fail-closed resolvendo a
 * configuração UMA vez + pricing `complete` → (2) compor/congelar o prompt e o
 * snapshot → (3) **persistir snapshot/evidência ANTES de qualquer efeito**
 * (reparo do estado `repairable` incluso) → (4) reserva b1a → (5) início de
 * tentativa atômico → (6) gateway do par COMPLETO do snapshot + política 2+1 →
 * (7) arte 1024×1024 → `art_uploaded` → `delivered`.
 *
 * Exatamente UM evento terminal (`result` | `error` | `unknown`) por resposta,
 * cada evento com o identificador da operação (F8). O fluxo NÃO invoca revisor
 * automático de imagem — a decisão de arte é programática.
 *
 * Tudo é injetável (`deps`) para teste puro: com os deps fornecidos, a função não
 * toca banco/provider/crédito/Storage.
 */

const NEW_FLOW_CAPABILITY = "campaign_product_image" as const;

export interface ProductOneToOneGenerationInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly briefing: ProductPromptCompositionBriefing;
  /** Texto do briefing congelado (evidência). */
  readonly briefingText: string;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly references?: readonly string[];
  readonly referenceSelections?: readonly ProductOneToOneEvidenceReference[];
  readonly productImagesDataUrls?: readonly string[];
  readonly promptBase?: string;
  readonly runId?: string;
  readonly traceId?: string;
}

export interface RecordAttemptCall {
  readonly campaignId: string;
  readonly snapshotOriginalId: string;
  readonly operationId: string;
  readonly attemptNumber: number;
  readonly target: AttemptTarget;
  readonly snapshot: ImageGenerationConfigSnapshot;
  readonly runId?: string;
  readonly traceId?: string;
}

export interface ProductOneToOneCreditOps {
  reserve(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<CreditOperationState>;
  markArtUploaded(campaignId: string, operationId: string): Promise<CreditOperationState>;
  deliver(campaignId: string, operationId: string): Promise<CreditOperationState>;
  refund(campaignId: string, operationId: string, reason?: string): Promise<CreditOperationState>;
}

export interface ProductOneToOneAttemptOps {
  acquire(input: {
    campaignId: string;
    operationId: string;
    target: AttemptTarget;
    attemptNumber: number;
  }): Promise<AttemptStartResult>;
  finish(input: {
    campaignId: string;
    operationId: string;
    attemptNumber: number;
    status: "done" | "failed";
  }): Promise<unknown>;
  recordOperationOutcome(input: {
    campaignId: string;
    operationId: string;
    outcome: "unknown" | "failed";
    supportReference?: string | null;
  }): Promise<unknown>;
  getCampaignOperation(campaignId: string): Promise<CampaignOperationState | null>;
}

export interface ProductOneToOneArtifactOps {
  storeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    imageDataUrl: string;
  }): Promise<ProductOneToOneArtifactRef>;
}

export interface TelemetryContextInput {
  readonly campaignId: string;
  readonly storeId: string;
  readonly attemptNumber: number;
  readonly runId?: string;
  readonly traceId?: string;
}

export interface ProductOneToOneGenerationDeps {
  readonly runPreflight?: (input: { campaignId: string }) => Promise<NewFlowPreflightResult>;
  readonly buildSnapshot?: (
    config: CurrentImageGenerationConfig,
    context: BuildProductOneToOneSnapshotContext,
  ) => ImageGenerationConfigSnapshot;
  readonly persistSnapshot?: (
    snapshot: ImageGenerationConfigSnapshot,
    evidence: ReturnType<typeof buildProductOneToOneFrozenEvidence>,
  ) => Promise<PersistProductOneToOneSnapshotResult>;
  readonly credit?: ProductOneToOneCreditOps;
  readonly attempts?: ProductOneToOneAttemptOps;
  readonly artifact?: ProductOneToOneArtifactOps;
  readonly createGateway?: (pair: ImageModelPairConfig) => AiInvoker;
  readonly createTelemetry?: (input: TelemetryContextInput) => AiTelemetryContext;
  readonly recordAttempt?: (call: RecordAttemptCall) => Promise<unknown>;
  readonly generateSupportReference?: () => string;
  readonly client?: SupabaseClient;
}

type NdjsonEvent = Record<string, unknown>;

function defaultTelemetry(input: TelemetryContextInput): AiTelemetryContext {
  return {
    operationRunId: input.runId ?? input.campaignId,
    operationRunType: "campaign_delivery",
    traceId: input.traceId ?? input.campaignId,
    storeId: input.storeId,
    campaignId: input.campaignId,
    attemptNumber: input.attemptNumber,
    sink: { emit: async () => {} },
  };
}

function operationStateForHistory(state: CampaignOperationState | null): AttemptOperationState | null {
  if (state === null) return null;
  if (state.unknown && !state.terminal) return "unknown";
  return state.status;
}

/** `true` quando a falha é um resultado DESCONHECIDO (timeout/abort/perda de conexão). */
function isUnknownResult(error: unknown, aborted: boolean): boolean {
  if (aborted) return true;
  const name =
    error !== null && typeof error === "object"
      ? (error as { name?: unknown }).name
      : undefined;
  if (name === "AbortError") return true;
  const classification = classifyImageGenerationFailure(
    error as Parameters<typeof classifyImageGenerationFailure>[0],
  );
  return classification.category === "timeout" || classification.category === "network";
}

async function getOperationState(
  attempts: ProductOneToOneAttemptOps,
  campaignId: string,
): Promise<CampaignOperationState | null> {
  try {
    return await attempts.getCampaignOperation(campaignId);
  } catch {
    return null;
  }
}

function providerImageRequest(input: ProductOneToOneGenerationInput): AiInvocationRequest {
  const productImagesDataUrls = input.productImagesDataUrls
    ? [...input.productImagesDataUrls]
    : undefined;
  return {
    prompt: "",
    ...(productImagesDataUrls ? { productImagesDataUrls } : {}),
  };
}

/**
 * Executa a geração do Produto 1:1 no ciclo da requisição e devolve um
 * `Response` NDJSON. Exatamente um evento terminal; cada evento traz
 * `operationId` (e `campaignId`).
 */
export async function runProductOneToOneGeneration(
  input: ProductOneToOneGenerationInput,
  deps: ProductOneToOneGenerationDeps = {},
): Promise<Response> {
  const client = deps.client ?? supabaseAdmin;
  const runPreflight =
    deps.runPreflight ?? (({ campaignId }) => runNewFlowPreflight({ campaignId }));
  const buildSnapshot = deps.buildSnapshot ?? buildProductOneToOneSnapshot;
  const persistSnapshot =
    deps.persistSnapshot ??
    ((snapshot, evidence) => persistProductOneToOneSnapshot(client, snapshot, evidence));
  const credit = deps.credit ?? (new ProductOneToOneCreditOperationClient() as ProductOneToOneCreditOps);
  const attempts = deps.attempts ?? (new ProductOneToOneAttemptStartClient() as ProductOneToOneAttemptOps);
  const artifact =
    deps.artifact ?? (new ProductOneToOneArtifactStore() as ProductOneToOneArtifactOps);
  const createGateway = deps.createGateway ?? createNewFlowImageGateway;
  const createTelemetry = deps.createTelemetry ?? defaultTelemetry;
  const newSupportReference = deps.generateSupportReference ?? generateSupportReference;
  const recordAttemptCall =
    deps.recordAttempt ??
    ((call: RecordAttemptCall) =>
      recordAttempt(client, call as RecordAttemptInput, {
        resolveOperationState: ({ campaignId }) =>
          getOperationState(attempts, campaignId).then(operationStateForHistory),
      }));

  const { campaignId, operationId, storeId } = input;
  const encoder = new TextEncoder();
  const controllerAbort = new AbortController();
  const timeoutId = setTimeout(
    () => controllerAbort.abort(),
    IMAGE_GENERATION_GLOBAL_TIMEOUT_MS,
  );

  const stream = new ReadableStream({
    async start(controller) {
      let terminalSent = false;
      const emit = (event: NdjsonEvent) => {
        try {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ operationId, campaignId, ...event }) + "\n",
            ),
          );
        } catch {
          // stream already closed by client
        }
      };
      const emitTerminal = (event: NdjsonEvent) => {
        if (terminalSent) return;
        terminalSent = true;
        emit(event);
      };

      const emitExistingOperation = (operation: CampaignOperationState) => {
        if (operation.unknown && !operation.terminal) {
          emitTerminal({
            type: "unknown",
            reference: operation.supportReference ?? newSupportReference(),
          });
          return;
        }
        switch (operation.status) {
          case "delivered":
            emitTerminal({ type: "result", campaignUrl: `/campanhas/${campaignId}` });
            return;
          case "refunded":
            emitTerminal({
              type: "error",
              code: "generation_failed",
              message: "A geração falhou. Crédito estornado.",
              httpStatus: 502,
              retryable: false,
            });
            return;
          default:
            // reserved | art_uploaded — operação EM ANDAMENTO.
            emitTerminal({
              type: "error",
              code: "operation_in_progress",
              message: "A operação já está em andamento.",
              httpStatus: 409,
              retryable: false,
            });
            return;
        }
      };

      const refundOnce = async (reason: string): Promise<void> => {
        try {
          await credit.refund(campaignId, operationId, reason);
        } catch {
          // Estorno é best-effort na saída; a operação permanece não reexecutável.
        }
      };

      try {
        emit({ type: "phase", phase: "orchestration", status: "running" });

        // ── (0) F6/I1 — operação existe ⇒ SOMENTE consulta ────────────────
        // Fail-closed: falha de LEITURA da operação NÃO prossegue para efeitos.
        let existing: CampaignOperationState | null;
        try {
          existing = await attempts.getCampaignOperation(campaignId);
        } catch {
          emitTerminal({
            type: "error",
            code: "operation_read_failed",
            message: "Não foi possível verificar o estado da operação.",
            httpStatus: 502,
            retryable: false,
          });
          return;
        }
        if (existing) {
          if (existing.operationId !== operationId) {
            emitTerminal({
              type: "error",
              code: "operation_identity_conflict",
              message: "Identidade da operação divergente para esta campanha.",
              httpStatus: 409,
              retryable: false,
            });
            return;
          }
          emitExistingOperation(existing);
          return;
        }

        // ── (1) preflight fail-closed (config resolvida UMA vez) ──────────
        let preflight: NewFlowPreflightResult;
        try {
          preflight = await runPreflight({ campaignId });
        } catch {
          emitTerminal({
            type: "error",
            code: "preflight_failed",
            message: "Não foi possível iniciar a geração.",
            httpStatus: 502,
            retryable: false,
          });
          return;
        }

        // ── (2) compor/congelar prompt + snapshot (par COMPLETO) ──────────
        const composition = composeProductPrompt({
          briefing: input.briefing,
          promptBase: input.promptBase ?? PRODUCT_1_1_PROMPT_BASE.content,
          references: input.references,
        });
        const snapshot = buildSnapshot(preflight.config, {
          campaignId,
          runId: input.runId,
          traceId: input.traceId,
        });
        const evidence = buildProductOneToOneFrozenEvidence({
          campaignId,
          operationId,
          campaignIntent: input.campaignIntent,
          backgroundDirection: input.backgroundDirection,
          briefing: input.briefingText,
          referenceSelections: input.referenceSelections ?? [],
          baseVersion: composition.promptBaseVersion,
          composerVersion: composition.composerVersion,
          policyVersions: composition.policyVersions,
        });

        // ── (3) persistir snapshot/evidência ANTES de qualquer efeito ────
        // (inclui o REPARO de um estado `repairable`: a evidência é completada
        //  para o MESMO snapshot ANTES de reserva/provider.)
        let persisted: PersistProductOneToOneSnapshotResult;
        try {
          persisted = await persistSnapshot(snapshot, evidence);
        } catch {
          emitTerminal({
            type: "error",
            code: "snapshot_persist_failed",
            message: "Não foi possível congelar a configuração da campanha.",
            httpStatus: 502,
            retryable: false,
          });
          return;
        }

        // ── (4) reserva b1a ──────────────────────────────────────────────
        try {
          await credit.reserve({ storeId, campaignId, operationId });
        } catch {
          emitTerminal({
            type: "error",
            code: "reserve_failed",
            message: "Não foi possível reservar créditos.",
            httpStatus: 402,
            retryable: false,
          });
          return;
        }

        // ── (6) gateway do par COMPLETO do SNAPSHOT congelado (F3) ───────
        const gateway = createGateway({
          primary: { model: snapshot.primaryModel, quality: snapshot.primaryQuality },
          fallback: { model: snapshot.fallbackModel, quality: snapshot.fallbackQuality },
        });

        let target: AttemptTarget = "primary";
        let attemptNumber = 1;

        // ── (5)–(7) política 2+1 por alvo/contadores ─────────────────────
        for (;;) {
          let acquired: AttemptStartResult;
          try {
            acquired = await attempts.acquire({
              campaignId,
              operationId,
              target,
              attemptNumber,
            });
          } catch {
            emitTerminal({
              type: "error",
              code: "attempt_start_failed",
              message: "Não foi possível iniciar a tentativa.",
              httpStatus: 502,
              retryable: false,
            });
            return;
          }

          if (!acquired.acquired) {
            // Corrida perdida — NUNCA chama o provider; consulta e encerra.
            const raced = await getOperationState(attempts, campaignId);
            if (raced && raced.operationId === operationId) {
              emitExistingOperation(raced);
            } else {
              emitTerminal({
                type: "error",
                code: "attempt_not_acquired",
                message: "A tentativa não foi iniciada por esta requisição.",
                httpStatus: 409,
                retryable: false,
              });
            }
            return;
          }

          // Histórico append-only da tentativa (mesma identidade/par do snapshot).
          try {
            await recordAttemptCall({
              campaignId,
              snapshotOriginalId: persisted.snapshotOriginalId,
              operationId,
              attemptNumber,
              target,
              snapshot,
              runId: input.runId,
              traceId: input.traceId,
            });
          } catch {
            try {
              await attempts.finish({ campaignId, operationId, attemptNumber, status: "failed" });
            } catch {
              // ignore
            }
            await refundOnce("attempt_history_failed");
            emitTerminal({
              type: "error",
              code: "generation_failed",
              message: "Falha na geração da campanha. Crédito estornado.",
              httpStatus: 502,
              retryable: false,
            });
            return;
          }

          // Chamada ao provider (uma tentativa por invocação).
          let imageDataUrl: string | undefined;
          let failure: unknown;
          try {
            const telemetry = createTelemetry({
              campaignId,
              storeId,
              attemptNumber,
              runId: input.runId,
              traceId: input.traceId,
            });
            const request: AiInvocationRequest = {
              ...providerImageRequest(input),
              prompt: composition.text,
              quality:
                target === "fallback" ? snapshot.fallbackQuality : snapshot.primaryQuality,
              size: "1024x1024",
              signal: controllerAbort.signal,
            };
            const result = await gateway.invoke(NEW_FLOW_CAPABILITY, request, telemetry, target);
            if (!result.imageBase64) {
              throw new Error("no_image_in_response");
            }
            imageDataUrl = `data:${result.mimeType ?? "image/png"};base64,${result.imageBase64}`;
          } catch (error) {
            failure = error;
          }

          if (imageDataUrl !== undefined) {
            // ── (7) sucesso: finaliza o claim, grava a arte, entrega ─────
            try {
              await attempts.finish({
                campaignId,
                operationId,
                attemptNumber,
                status: "done",
              });
            } catch {
              // ignore
            }
            let ref: ProductOneToOneArtifactRef;
            try {
              ref = await artifact.storeArtifact({
                storeId,
                campaignId,
                operationId,
                imageDataUrl,
              });
            } catch {
              await refundOnce("artifact_upload_failed");
              emitTerminal({
                type: "error",
                code: "generation_failed",
                message: "Falha ao salvar a arte. Crédito estornado.",
                httpStatus: 502,
                retryable: false,
              });
              return;
            }
            void ref;
            try {
              await credit.markArtUploaded(campaignId, operationId);
              await credit.deliver(campaignId, operationId);
            } catch {
              emitTerminal({
                type: "error",
                code: "delivery_failed",
                message: "Falha ao entregar a campanha.",
                httpStatus: 502,
                retryable: false,
              });
              return;
            }
            emit({ type: "phase", phase: "orchestration", status: "complete" });
            emitTerminal({ type: "result", campaignUrl: `/campanhas/${campaignId}` });
            return;
          }

          // ── Resultado DESCONHECIDO (timeout/abort) ──────────────────────
          if (isUnknownResult(failure, controllerAbort.signal.aborted)) {
            const reference = newSupportReference();
            try {
              await attempts.recordOperationOutcome({
                campaignId,
                operationId,
                outcome: "unknown",
                supportReference: reference,
              });
            } catch {
              // I2 — fail-closed: NÃO finaliza o claim, NÃO estorna e NÃO
              // reexecuta. O claim `in_progress` residual permanece bloqueado
              // para resolução exclusiva do Plano 07 (sob a trava C4).
              emitTerminal({ type: "unknown", reference });
              return;
            }
            emitTerminal({ type: "unknown", reference });
            return;
          }

          // ── Falha CONFIRMADA: finaliza o claim e decide a próxima ação ──
          try {
            await attempts.finish({ campaignId, operationId, attemptNumber, status: "failed" });
          } catch {
            // ignore
          }
          if (failure === null || failure === undefined) {
            failure = new Error("generation_failed");
          }
          const next = nextImageGenerationAttempt(
            { target, attemptNumber },
            failure as Parameters<typeof nextImageGenerationAttempt>[1],
          );
          if (
            !next.terminal &&
            next.nextTarget !== undefined &&
            next.nextAttemptNumber !== undefined
          ) {
            target = next.nextTarget as AttemptTarget;
            attemptNumber = next.nextAttemptNumber;
            continue;
          }

          await refundOnce("generation_failed");
          emitTerminal({
            type: "error",
            code: "generation_failed",
            message: "Falha na geração da campanha. Crédito estornado.",
            httpStatus: 502,
            retryable: false,
          });
          return;
        }
      } catch {
        emitTerminal({
          type: "error",
          code: "internal_error",
          message: "Erro interno ao gerar a campanha.",
          httpStatus: 500,
          retryable: false,
        });
      } finally {
        clearTimeout(timeoutId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
