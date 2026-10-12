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
import {
  generateSupportReference,
  buildPublicGenerationFailure,
  toInternalDiagnosis,
  type ImageGenerationDiagnosisInput,
} from "@/lib/ai/image-generation-support-reference";
import { SupabaseImageGenerationDiagnosisRepository } from "@/lib/ai/image-generation-diagnosis-repository";
import {
  classifyImageGenerationFailure,
  nextImageGenerationAttempt,
  type ImageGenerationFailureClass,
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
import type { ProductOneToOneArtifactRef, ArtifactProbe } from "../artifact/types";
import {
  buildProductOneToOneSnapshot,
  buildProductOneToOneFrozenEvidence,
  persistProductOneToOneSnapshot,
  type PersistProductOneToOneSnapshotResult,
  type ProductOneToOneEvidenceReference,
  type BuildProductOneToOneSnapshotContext,
} from "../snapshot/persist-snapshot";
import { composeProductPrompt, PROMPT_BLOCK_LABELS } from "../prompt-composition";
import { PRODUCT_1_1_PROMPT_BASE } from "../prompt-base";
import type { ProductOneToOneBackgroundDirection } from "../background-direction";
import type { ProductOneToOneIntent } from "../intent-selection";
import type {
  ProductPromptCompositionBriefing,
  PromptPolicyContribution,
} from "../policies/types";

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
  /**
   * Identidade visual resolvida SERVER-SIDE pela rota (nunca do cliente): imagem
   * canônica de identidade em `data URL` (`data:image/png|jpeg|webp;base64,...`)
   * — o único formato aceito por `UpstreamImagesAdapter.dataUrlToFile` — enviada
   * ao gateway como `identityImageUrl`. A rota converte a URL assinada rotativa
   * (B1) e congela o id de CONTEÚDO (SHA-256 dos bytes) + a direção textual na
   * evidência (B2). Correção de integração do Plano 04, gap 4.
   */
  readonly identityImageUrl?: string;
  /**
   * Direção de identidade (derivada de `buildCampaignBrief`) materializada como
   * contribuição de prompt no bloco `PROMPT_BLOCK_LABELS.identity`.
   */
  readonly identityDirective?: string;
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
    status: "done" | "failed" | "abandoned";
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
  /**
   * C2/I3 — sonda TIPADA da arte (nunca `null` ambíguo, nunca assina URL). Usada
   * para decidir se um estorno é autorizado: só ausência CONFIRMADA (`absent`/
   * `invalid`) autoriza estorno; `integral`/`indeterminate` NUNCA (achado 4).
   */
  probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe>;
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
  /**
   * Persistência do diagnóstico durável correlacionado à referência (achado 6).
   * Injetável para teste puro; o default usa
   * `SupabaseImageGenerationDiagnosisRepository`.
   */
  readonly recordDiagnosis?: (
    input: ImageGenerationDiagnosisInput,
  ) => Promise<{ reference: string }>;
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

/**
 * Achado 5(a) — a leitura do estado da operação PROPAGA falhas: uma falha de
 * leitura NUNCA é convertida em "operação ausente" (`null`). Os chamadores devem
 * bloquear fail-closed (a leitura obrigatória do histórico BLOQUEIA; o caminho de
 * corrida emite um terminal fail-closed) — jamais tratar falha como ausência.
 */
async function readOperationState(
  attempts: ProductOneToOneAttemptOps,
  campaignId: string,
): Promise<CampaignOperationState | null> {
  return attempts.getCampaignOperation(campaignId);
}

/**
 * Leitura (query-only) do estado persistido da operação para uma campanha.
 * Usado pela rota de aceitação para reconhecer uma operação JÁ EXISTENTE antes
 * de qualquer efeito (achado 3). PROPAGA falhas de leitura (achado 5a) — o
 * chamador decide o bloqueio fail-closed. `null` = operação inexistente (nova).
 */
export async function readProductOneToOneOperation(
  campaignId: string,
  attempts: ProductOneToOneAttemptOps = new ProductOneToOneAttemptStartClient() as ProductOneToOneAttemptOps,
): Promise<CampaignOperationState | null> {
  return attempts.getCampaignOperation(campaignId);
}

/** Mapeia a classe de falha da política para o código normalizado FECHADO (D-19). */
const DIAGNOSIS_ERROR_BY_FAILURE_CLASS: Readonly<
  Record<ImageGenerationFailureClass, string>
> = Object.freeze({
  rate_limit: "rate_limit",
  timeout: "timeout",
  network: "network",
  provider_error: "provider_error",
  availability: "unknown_provider_error",
  quota: "quota",
  billing: "billing",
  auth: "auth",
  content: "content_filter",
  input: "unknown_provider_error",
});

/** Par modelo/qualidade do alvo a partir do snapshot congelado (diagnóstico/telemetria). */
function snapshotPairForTarget(
  snapshot: ImageGenerationConfigSnapshot,
  target: AttemptTarget,
): { model: string; quality: string } {
  return target === "fallback"
    ? { model: snapshot.fallbackModel, quality: snapshot.fallbackQuality }
    : { model: snapshot.primaryModel, quality: snapshot.primaryQuality };
}

function providerImageRequest(input: ProductOneToOneGenerationInput): AiInvocationRequest {
  const productImagesDataUrls = input.productImagesDataUrls
    ? [...input.productImagesDataUrls]
    : undefined;
  return {
    prompt: "",
    ...(productImagesDataUrls ? { productImagesDataUrls } : {}),
    // F56.2.2-04 (gap 4): a identidade visual resolvida server-side acompanha a
    // requisição como `identityImageUrl` (mesmo campo consumido pelos adapters).
    ...(input.identityImageUrl ? { identityImageUrl: input.identityImageUrl } : {}),
  };
}

/** Contribuições de identidade para o bloco `PROMPT_BLOCK_LABELS.identity`. */
function identityContributions(
  input: ProductOneToOneGenerationInput,
): readonly PromptPolicyContribution[] {
  const directive = input.identityDirective?.trim();
  if (!directive) return [];
  return [{ block: PROMPT_BLOCK_LABELS.identity, lines: [directive] }];
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
  const recordDiagnosis =
    deps.recordDiagnosis ??
    ((diagnosis: ImageGenerationDiagnosisInput) =>
      new SupabaseImageGenerationDiagnosisRepository(client).recordDiagnosis(diagnosis));
  const recordAttemptCall =
    deps.recordAttempt ??
    ((call: RecordAttemptCall) =>
      recordAttempt(client, call as RecordAttemptInput, {
        resolveOperationState: ({ campaignId }) =>
          readOperationState(attempts, campaignId).then(operationStateForHistory),
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

      // ── Diagnóstico durável + terminal público `IMG-001` (achado 6) ──────
      // Falha OPERACIONAL ⇒ código público `IMG-001` + referência opaca +
      // diagnóstico durável persistido (best-effort; nunca impede o terminal).
      // Os contratos de CAMPO (400) e AUTORIZAÇÃO (403) vivem na ROTA e NÃO são
      // `IMG-001` — o orquestrador só emite falhas operacionais.
      const emitOperationalFailure = async (params: {
        internalCategory: string;
        normalizedError: string;
        httpStatus?: number;
        target?: AttemptTarget;
        attemptNumber?: number;
        model?: string;
        quality?: string;
        refunded?: boolean;
      }): Promise<void> => {
        const diagnosis: ImageGenerationDiagnosisInput = {
          internalCategory: params.internalCategory,
          model: params.model ?? "",
          quality: params.quality ?? "",
          target: params.target ?? "primary",
          attemptNumber: params.attemptNumber ?? 1,
          normalizedError: params.normalizedError,
          runId: input.runId,
          traceId: input.traceId,
        };
        const publicFailure = buildPublicGenerationFailure(diagnosis);
        try {
          await recordDiagnosis(toInternalDiagnosis(diagnosis, publicFailure.reference));
        } catch {
          // Best-effort durável: a falha do diagnóstico nunca bloqueia o terminal.
        }
        emitTerminal({
          type: "error",
          code: publicFailure.code,
          reference: publicFailure.reference,
          message: params.refunded
            ? `${publicFailure.message} Crédito estornado.`
            : publicFailure.message,
          httpStatus: params.httpStatus ?? 502,
          retryable: false,
        });
      };

      // ── Estorno SÓ com ausência de arte COMPROVADA (achado 4) ───────────
      const probeArtifactKind = async (): Promise<ArtifactProbe["kind"] | null> => {
        try {
          const probe = await artifact.probeArtifact({
            storeId,
            campaignId,
            operationId,
          });
          return probe.kind;
        } catch {
          // Leitura indeterminada ⇒ ausência NÃO comprovada.
          return null;
        }
      };

      // `refundOnce` NÃO engole o resultado: devolve `true` SOMENTE quando o
      // cliente confirma `refunded` (nunca afirmar "estornado" sem confirmação).
      const refundOnce = async (reason: string): Promise<boolean> => {
        try {
          const state = await credit.refund(campaignId, operationId, reason);
          return state.status === "refunded";
        } catch {
          return false;
        }
      };

      // Persiste o marcador `unknown` (durável). `true` quando persistiu.
      const markUnknownOutcome = async (reference: string): Promise<boolean> => {
        try {
          await attempts.recordOperationOutcome({
            campaignId,
            operationId,
            outcome: "unknown",
            supportReference: reference,
          });
          return true;
        } catch {
          return false;
        }
      };

      // Terminal de pendência (resultado desconhecido): persiste o marcador,
      // persiste o diagnóstico durável correlacionado à MESMA referência emitida
      // (achado 6 / gap 3) e emite `unknown`. NUNCA estorna e NUNCA repete.
      const recordPendingDiagnosis = async (
        reference: string,
        params: {
          internalCategory: string;
          normalizedError: string;
          target?: AttemptTarget;
          attemptNumber?: number;
          model?: string;
          quality?: string;
        },
      ): Promise<void> => {
        const diagnosis: ImageGenerationDiagnosisInput = {
          internalCategory: params.internalCategory,
          model: params.model ?? "",
          quality: params.quality ?? "",
          target: params.target ?? "primary",
          attemptNumber: params.attemptNumber ?? 1,
          normalizedError: params.normalizedError,
          runId: input.runId,
          traceId: input.traceId,
        };
        try {
          await recordDiagnosis(toInternalDiagnosis(diagnosis, reference));
        } catch {
          // Best-effort durável: a falha do diagnóstico nunca bloqueia o terminal.
        }
      };

      // Terminal de pendência (resultado desconhecido): persiste o marcador,
      // persiste o diagnóstico durável (gap 3) e emite `unknown`. NUNCA estorna e
      // NUNCA repete.
      const emitUnknownPending = async (params?: {
        internalCategory?: string;
        normalizedError?: string;
        target?: AttemptTarget;
        attemptNumber?: number;
        model?: string;
        quality?: string;
      }): Promise<void> => {
        const reference = newSupportReference();
        await markUnknownOutcome(reference);
        await recordPendingDiagnosis(reference, {
          internalCategory: params?.internalCategory ?? "generation_unknown",
          normalizedError: params?.normalizedError ?? "unknown_provider_error",
          target: params?.target,
          attemptNumber: params?.attemptNumber,
          model: params?.model,
          quality: params?.quality,
        });
        emitTerminal({ type: "unknown", reference });
      };

      // Falha confirmada (sem arte entregue): só estorna com AUSÊNCIA COMPROVADA
      // (`absent`/`invalid`); objeto presente (`integral`) ou ausência NÃO
      // comprovada (`indeterminate`/leitura falha) ⇒ pendente, sem estorno.
      const settleConfirmedFailure = async (params: {
        internalCategory: string;
        normalizedError: string;
        target: AttemptTarget;
        attemptNumber: number;
        model: string;
        quality: string;
        reason: string;
      }): Promise<void> => {
        const kind = await probeArtifactKind();
        if (kind === "integral" || kind === "indeterminate" || kind === null) {
          await emitUnknownPending({
            internalCategory: params.internalCategory,
            normalizedError: params.normalizedError,
            target: params.target,
            attemptNumber: params.attemptNumber,
            model: params.model,
            quality: params.quality,
          });
          return;
        }
        // Ausência CONFIRMADA (absent/invalid) + falha confirmada ⇒ estorno ÚNICO.
        const refunded = await refundOnce(params.reason);
        if (refunded) {
          await emitOperationalFailure({
            internalCategory: params.internalCategory,
            normalizedError: params.normalizedError,
            target: params.target,
            attemptNumber: params.attemptNumber,
            model: params.model,
            quality: params.quality,
            refunded: true,
          });
          return;
        }
        await emitUnknownPending({
          internalCategory: params.internalCategory,
          normalizedError: params.normalizedError,
          target: params.target,
          attemptNumber: params.attemptNumber,
          model: params.model,
          quality: params.quality,
        });
      };

      try {
        emit({ type: "phase", phase: "orchestration", status: "running" });

        // ── (0) F6/I1 — operação existe ⇒ SOMENTE consulta ────────────────
        // Fail-closed: falha de LEITURA da operação NÃO prossegue para efeitos.
        let existing: CampaignOperationState | null;
        try {
          existing = await attempts.getCampaignOperation(campaignId);
        } catch {
          await emitOperationalFailure({
            internalCategory: "operation_read_failed",
            normalizedError: "unknown_provider_error",
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
          await emitOperationalFailure({
            internalCategory: "preflight_failed",
            normalizedError: "unknown_provider_error",
          });
          return;
        }

        // ── (2) compor/congelar prompt + snapshot (par COMPLETO) ──────────
        const composition = composeProductPrompt({
          briefing: input.briefing,
          promptBase: input.promptBase ?? PRODUCT_1_1_PROMPT_BASE.content,
          references: input.references,
          contributions: identityContributions(input),
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
          await emitOperationalFailure({
            internalCategory: "snapshot_persist_failed",
            normalizedError: "unknown_provider_error",
          });
          return;
        }

        // ── (4) reserva b1a ──────────────────────────────────────────────
        try {
          await credit.reserve({ storeId, campaignId, operationId });
        } catch {
          await emitOperationalFailure({
            internalCategory: "reserve_failed",
            normalizedError: "unknown_provider_error",
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
            await emitOperationalFailure({
              internalCategory: "attempt_start_failed",
              normalizedError: "unknown_provider_error",
              target,
              attemptNumber,
              model: snapshotPairForTarget(snapshot, target).model,
              quality: snapshotPairForTarget(snapshot, target).quality,
            });
            return;
          }

          if (!acquired.acquired) {
            // Corrida perdida — NUNCA chama o provider; consulta e encerra.
            // Achado 5(a) — falha de LEITURA ⇒ terminal fail-closed, JAMAIS
            // tratada como "operação ausente".
            let raced: CampaignOperationState | null;
            try {
              raced = await readOperationState(attempts, campaignId);
            } catch {
              await emitOperationalFailure({
                internalCategory: "operation_read_failed",
                normalizedError: "unknown_provider_error",
              });
              return;
            }
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
            await settleConfirmedFailure({
              internalCategory: "attempt_history_failed",
              normalizedError: "unknown_provider_error",
              target,
              attemptNumber,
              model: snapshotPairForTarget(snapshot, target).model,
              quality: snapshotPairForTarget(snapshot, target).quality,
              reason: "attempt_history_failed",
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
              // Achado 4 — NÃO estornar cegamente: reexaminar a arte. Objeto
              // presente (`integral`) ou ausência não comprovada
              // (`indeterminate`/leitura falha) ⇒ pendente, SEM estorno; só
              // ausência COMPROVADA autoriza o estorno único.
              await settleConfirmedFailure({
                internalCategory: "artifact_store_failed",
                normalizedError: "unknown_provider_error",
                target,
                attemptNumber,
                model: snapshotPairForTarget(snapshot, target).model,
                quality: snapshotPairForTarget(snapshot, target).quality,
                reason: "artifact_upload_failed",
              });
              return;
            }
            void ref;
            try {
              await credit.markArtUploaded(campaignId, operationId);
              await credit.deliver(campaignId, operationId);
            } catch {
              await emitOperationalFailure({
                internalCategory: "delivery_failed",
                normalizedError: "unknown_provider_error",
                target,
                attemptNumber,
                model: snapshotPairForTarget(snapshot, target).model,
                quality: snapshotPairForTarget(snapshot, target).quality,
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
            const persisted = await markUnknownOutcome(reference);
            // Gap 3 — diagnóstico durável correlacionado à MESMA referência
            // emitida (recuperável por `findByReference`), em AMBOS os caminhos
            // de pendência (unknown persistido OU residual).
            await recordPendingDiagnosis(reference, {
              internalCategory: "generation_unknown",
              normalizedError: "timeout",
              target,
              attemptNumber,
              model: snapshotPairForTarget(snapshot, target).model,
              quality: snapshotPairForTarget(snapshot, target).quality,
            });
            if (persisted) {
              // Achado 5(b) — o `unknown` persistiu: FINALIZA o claim com um
              // status TERMINAL dedicado (`abandoned`) para que NÃO permaneça
              // `in_progress` (o contrato exige residual apenas quando a
              // persistência do `unknown` FALHA). Mantém o marcador `unknown`
              // persistido, então novas tentativas continuam RECUSADAS.
              try {
                await attempts.finish({
                  campaignId,
                  operationId,
                  attemptNumber,
                  status: "abandoned",
                });
              } catch {
                // Fail-closed: se a finalização FALHA, o claim permanece
                // `in_progress` residual (pendente) e SOMENTE o Plano 07 o
                // resolve; NÃO estorna e NÃO repete.
              }
            }
            // I2 — quando a persistência do `unknown` FALHA, o claim `in_progress`
            // residual permanece bloqueado para resolução exclusiva do Plano 07.
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
          const classification = classifyImageGenerationFailure(
            failure as Parameters<typeof classifyImageGenerationFailure>[0],
          );
          const next = nextImageGenerationAttempt({ target, attemptNumber }, classification);
          if (
            !next.terminal &&
            next.nextTarget !== undefined &&
            next.nextAttemptNumber !== undefined
          ) {
            target = next.nextTarget as AttemptTarget;
            attemptNumber = next.nextAttemptNumber;
            continue;
          }

          await settleConfirmedFailure({
            internalCategory: "generation_failed",
            normalizedError: DIAGNOSIS_ERROR_BY_FAILURE_CLASS[classification.category],
            target,
            attemptNumber,
            model: snapshotPairForTarget(snapshot, target).model,
            quality: snapshotPairForTarget(snapshot, target).quality,
            reason: "generation_failed",
          });
          return;
        }
      } catch {
        await emitOperationalFailure({
          internalCategory: "internal_error",
          normalizedError: "unknown_provider_error",
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
