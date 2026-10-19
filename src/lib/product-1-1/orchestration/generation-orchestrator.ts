import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { createNewFlowImageGateway } from "@/lib/ai/upstream-images-runtime";
import type { AiInvoker } from "@/lib/ai/gateway";
import type {
  AiCallEnvelope,
  AiEnvelopeInternalCost,
  AiInvocationRequest,
  AiTelemetryContext,
} from "@/lib/ai/types";
import { withOnCallTelemetry } from "@/lib/ai/telemetry-sink";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import {
  isUnknownPilotOutcome,
  type PilotPaidCallHandle,
  type PilotPaidCallKind,
  type PilotSpendGate,
} from "@/lib/product-1-1/pilot/spend-control";
import type {
  CurrentImageGenerationConfig,
  ImageGenerationConfigSnapshot,
} from "@/lib/ai/image-generation-config-snapshot";
import {
  generateSupportReference,
  buildPublicGenerationFailure,
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
import {
  buildAttemptTelemetry,
  defaultResolveAttemptCost,
  attemptCostForTarget,
  recordFailureDiagnosis,
  type AttemptCostResolver,
} from "./instrumentation";
import {
  COPY_BUDGET_MS,
  createCopyBudgetSignal,
  drainCopyTask,
  recordCancellation,
  recordCopyState,
  type CopyBudgetSignal,
  type CopyCommit,
  type CopyState,
  type CopyStateStore,
  type CopyStateTransitionResult,
  type CopyCancellationResult,
} from "../copy/copy-state";
import {
  createDefaultProductOneToOneCopyOps,
  type ProductOneToOneCopyContext,
} from "../copy/default-copy-runner";
import {
  ProductOneToOneCopyAcquisitionClient,
  type CopyAcquisitionResult,
} from "../copy/copy-acquisition-client";
import { classifyCopyFailure } from "../copy/copy-recovery";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { projectDeliveredCampaign } from "./project-delivered-campaign";
import { projectClosedCampaign } from "./project-closed-campaign";
import {
  PRODUCT_1_1_GENERATION_DEADLINE_MS,
  canStartDurableWrite,
  createDeadlineRejection,
  deadlineAt,
  remainingBeforeDeadline,
  remainingBudget,
} from "./deadline";

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

/**
 * P1 (Opção A) — origem INTERNA auditável do custo do NOVO FLUXO (`modelo +
 * qualidade` + versão/origem). Vai a `metadata.internal_cost_origin` no evento
 * persistido pelo sink ÚNICO; o `cost_source` permanece `pricing_table`.
 */
const NEW_FLOW_INTERNAL_COST_ORIGIN = "new_flow_pair_pricing" as const;

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
  /**
   * Gap 1 — contexto server-side (loja) para a copy DEFAULT do novo fluxo. Fica
   * ausente em chamadas que não geram copy; quando presente, o orquestrador
   * conecta a corrida produtiva EXISTENTE (`CopyDirectorService`) como default.
   */
  readonly copyContext?: ProductOneToOneCopyContext;
  /**
   * F46-04 (D3) — snapshot econômico resolvido UMA vez pela rota e propagado às
   * chamadas filhas (copy + telemetria por tentativa). Nunca fallback silencioso.
   */
  readonly usdBrlRateAtGeneration?: number | null;
  readonly creditValueBrlAtGeneration?: number | null;
  readonly promptBase?: string;
  readonly runId?: string;
  readonly traceId?: string;
  /**
   * F56.2b2d (Plano 02) — instante (epoch ms) do INÍCIO do POST, capturado pela
   * rota ANTES de qualquer trabalho pesado (parse/preflight/identidade). O clock
   * do deadline começa AQUI: o tempo já consumido antes do orquestrador é
   * descontado do orçamento. Ausente ⇒ `Date.now()` (fallback conservador).
   */
  readonly requestStartedAtMs?: number;
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
  markArtUploaded(campaignId: string, operationId: string, publicationToken: string): Promise<CreditOperationState>;
  deliver(campaignId: string, operationId: string, publicationToken: string): Promise<CreditOperationState>;
  refund(campaignId: string, operationId: string, reason?: string): Promise<CreditOperationState>;
  /**
   * Recorte 1 (Plano 08) — FENCE pré-upload. `beginPublication` recebe a posse
   * (token) da publicação ANTES de escrever no Storage; `abortPublication` SÓ
   * encerra com falha comprovada ANTES do envio; `markResultUnknown` mantém a
   * proteção quando o resultado do upload é desconhecido.
   */
  beginPublication(
    campaignId: string,
    operationId: string,
  ): Promise<{ acquired: boolean; token: string | null; publicationState: string }>;
  abortPublication(
    campaignId: string,
    operationId: string,
    publicationToken: string,
    phase: "before_upload" | "metadata_failed" | "result_unknown",
  ): Promise<{ success: boolean; reason?: string }>;
  markResultUnknown(
    campaignId: string,
    operationId: string,
    publicationToken: string,
  ): Promise<{ success: boolean; reason?: string }>;
  /**
   * C3 (F56.2b2b) — encerramento local por falha FINAL (predicado PF) sob a trava
   * C4. Forma ÚNICA OBJETO com o tipo REAL da sonda (`ArtifactProbe["kind"]`),
   * idêntica no cliente, nos fakes e no call site. Somente o ponto de DECISÃO
   * TERMINAL a utiliza.
   */
  closeFailedOperation(input: {
    campaignId: string;
    operationId: string;
    artKind: ArtifactProbe["kind"];
    observedEpoch: number;
    reason?: string;
  }): Promise<CreditOperationState>;
  /** Recorte 1 — frescor da publicação (capturado ANTES da sonda). */
  getPublicationEpoch(campaignId: string, operationId: string): Promise<number>;
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
  readonly usdBrlRateAtGeneration?: number | null;
  readonly creditValueBrlAtGeneration?: number | null;
  readonly runId?: string;
  readonly traceId?: string;
  /**
   * P1 (Opção A) — custo INTERNO do NOVO FLUXO (modelo+qualidade+versão+origem)
   * resolvido pela pricing do par. Entra no contexto do sink ÚNICO.
   */
  readonly internalCost?: AiEnvelopeInternalCost;
}

/**
 * F8 — operações da copy (não bloqueante) drenadas DENTRO do ciclo da
 * requisição. Injetável para teste puro; o default conecta a corrida produtiva
 * EXISTENTE (`createDefaultProductOneToOneCopyOps`) e persiste em
 * `product_1_1_copy_state` / `product_1_1_copy_cancellations`.
 */
export interface ProductOneToOneCopyOps {
  /**
   * Task da copy; recebe o sinal do orçamento (para cooperar com o cancelamento)
   * e o `commit` (latch) que persiste o TEXTO entregue.
   */
  readonly runCopy: (input: {
    campaignId: string;
    operationId: string;
    signal: AbortSignal;
    commit: CopyCommit;
  }) => Promise<void>;
  readonly budgetMs?: number;
  /**
   * B2A-D4 / Plano 01 — identidade PROVISÓRIA (legado b1b). SUBSTITUÍDA pelo
   * wiring de aquisição do Plano 02 (`acquireAttempt`): a identidade da tentativa
   * inicial agora é SERVER-AUTORITATIVA e NUNCA é lida deste campo. Mantido apenas
   * para compatibilidade estrutural.
   */
  readonly initialAttempt?: { readonly attemptSeq: number; readonly attemptToken: string };
  /**
   * F56.2b2a (Plano 02 / lacuna 1) — aquisição da IDENTIDADE da tentativa INICIAL
   * (server-autoritativa). Default:
   * `new ProductOneToOneCopyAcquisitionClient(client).acquire`. VENCEDOR ⇒ o dreno
   * usa a identidade DEVOLVIDA (`attempt_seq`/`attempt_token`); PERDEDOR ⇒ a copy
   * apenas ACOMPANHA (ZERO chamadas ao provider), preservando o curto-circuito de
   * reenvio/corrida perdida (Gap 2).
   */
  readonly acquireAttempt?: (input: {
    campaignId: string;
    operationId: string;
    mode: "auto" | "manual";
    requestToken?: string;
  }) => Promise<CopyAcquisitionResult>;
  readonly recordCopyState?: (input: {
    campaignId: string;
    operationId: string;
    state: CopyState;
    copyText?: string | null;
    copyPayload?: Record<string, unknown> | null;
  }) => Promise<CopyStateTransitionResult>;
  readonly recordCancellation?: (input: {
    campaignId: string;
    operationId: string;
    reason: string;
  }) => Promise<CopyCancellationResult>;
  /** Orçamento injetável (testes fornecem um AbortSignal determinístico). */
  readonly makeBudgetSignal?: (budgetMs: number) => CopyBudgetSignal;
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
  /**
   * Envelope por tentativa (instrumentação) — observador de TESTE. Recebe o
   * envelope REAL emitido pelo gateway (1 por tentativa real) via
   * `withOnCallTelemetry`; o default é ausente (produção persiste pelo sink
   * ÚNICO). Injetável para teste puro.
   */
  readonly onAttemptEnvelope?: (envelope: AiCallEnvelope) => void | Promise<void>;
  /** F8 — copy não bloqueante drenada no ciclo da requisição (opcional). */
  readonly copy?: ProductOneToOneCopyOps;
  /**
   * Gap 1 — invocador SIMULADO/injetável da copy default (testes). Default de
   * produção = gateway padrão (`defaultAiGateway`).
   */
  readonly copyInvoker?: AiInvoker;
  /** Gap 1 — habilita o `CopyDirectorService` na copy default (default: flag). */
  readonly copyDirectorEnabled?: boolean;
  /**
   * Gap 4 — resolvedor do custo INTERNO por tentativa do novo fluxo
   * (`modelo + qualidade` + versão/origem). Default = pricing do novo fluxo.
   */
  readonly resolveAttemptCost?: AttemptCostResolver;
  readonly client?: SupabaseClient;
  /**
   * F56.2b2c (B2.3) — Gate de gasto do piloto (POR CHAMADA). Quando AUSENTE, o
   * piloto está INATIVO (o gate NÃO é consultado). Quando fornecido, é consultado
   * ANTES de cada chamada paga (imagem principal/retry/fallback e copy inicial):
   * só `acquired` autoriza o provider; `existing_in_flight`/`closed` NÃO; resultado
   * desconhecido (timeout/abort) chama `markUnknown` (bloqueia novas chamadas).
   */
  readonly pilotSpend?: PilotSpendGate;
  /**
   * Quick 261017-cdi — projeção IDEMPOTENTE da campanha após ENTREGA CONFIRMADA
   * (`status='ready'` + caminho real da arte). Default = `projectDeliveredCampaign`.
   * NUNCA lança: uma falha de projeção NÃO provoca nova chamada ao provider,
   * estorno, nem reclassifica a entrega — permite reparo idempotente.
   */
  readonly projectDeliveredCampaign?: typeof projectDeliveredCampaign;
  /**
   * Quick 261018-enc — projeção IDEMPOTENTE da campanha após ENCERRAMENTO
   * CONFIRMADO com estorno (`status='error'` + mensagem por motivo). Default =
   * `projectClosedCampaign`. NUNCA lança; uma falha de projeção NÃO provoca nova
   * chamada ao provider, estorno, nem reclassifica o encerramento. NUNCA
   * sobrescreve uma entrega confirmada (`ready`).
   */
  readonly projectClosedCampaign?: typeof projectClosedCampaign;
  /**
   * F56.2b2c (B2.3) — estimativa aprovada (USD) da CALL DE COPY (decisão humana,
   * Plan 04). Sem valor, a copy é BLOQUEADA quando o gate está armado.
   */
  /**
   * F56.2b2d (Plano 02 / W11) — SEAM DE TESTE: quando presente, substitui
   * `PRODUCT_1_1_GENERATION_DEADLINE_MS` no cálculo do deadline. NÃO é flag de
   * runtime/env — só permite provar o deadline com valores curtos/determinísticos
   * nos testes de contrato.
   */
  readonly deadlineMs?: number;
}

type NdjsonEvent = Record<string, unknown>;

function defaultTelemetry(input: TelemetryContextInput): AiTelemetryContext {
  // P1 (Opção A) — o envelope REAL do gateway é persistido pelo sink ÚNICO
  // (`DefaultAiTelemetrySink`, default do `createDefaultTelemetryContext`), com o
  // custo interno do NOVO FLUXO (`modelo + qualidade` + versão/origem) no
  // contexto — origem `pricing_table`, NUNCA `provider_reported`. Sem reconstrução
  // zero-duration e sem duplicar registros (1 envelope do gateway ⇒ 1 registro).
  return buildAttemptTelemetry({
    operationRunId: input.runId ?? input.campaignId,
    traceId: input.traceId ?? input.campaignId,
    storeId: input.storeId,
    campaignId: input.campaignId,
    attemptNumber: input.attemptNumber,
    usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
    creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
    ...(input.internalCost ? { internalCost: input.internalCost } : {}),
  });
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
 * Quick 261017-cdi — referências de PRODUTO para a composição, EXCLUINDO a
 * imagem de identidade (logo/assinatura). A identidade NÃO deve contar como
 * imagem de produto nem disparar a instrução de múltiplas imagens do produto;
 * referências adicionais legítimas (variações/combo) continuam contando.
 * Quando não há seleções, cai no `references` legado (compatibilidade de testes).
 */
function productReferenceIds(
  input: ProductOneToOneGenerationInput,
): readonly string[] | undefined {
  if (input.referenceSelections && input.referenceSelections.length > 0) {
    return input.referenceSelections
      .filter((selection) => selection.kind !== "identity")
      .map((selection) => selection.id);
  }
  return input.references;
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
  const projectCampaign = deps.projectDeliveredCampaign ?? projectDeliveredCampaign;
  const projectClosed =
    deps.projectClosedCampaign ?? projectClosedCampaign;
  const newSupportReference = deps.generateSupportReference ?? generateSupportReference;
  const recordDiagnosis =
    deps.recordDiagnosis ??
    ((diagnosis: ImageGenerationDiagnosisInput) =>
      new SupabaseImageGenerationDiagnosisRepository(client).recordDiagnosis(diagnosis));
  const onAttemptEnvelope = deps.onAttemptEnvelope;
  // Gap 1 — a copy DEFAULT conecta a corrida produtiva EXISTENTE quando o
  // contexto server-side (loja) e/ou um invocador injetado estão disponíveis; a
  // rota NÃO fornece `deps.copy`, então a execução normal GERA copy.
  const copyDirectorEnabled =
    deps.copyDirectorEnabled ?? getLaunchConfig().copyDirectorEnabled;
  const copyOps: ProductOneToOneCopyOps | undefined =
    deps.copy ??
    (input.copyContext || deps.copyInvoker
      ? createDefaultProductOneToOneCopyOps(
          {
            campaignId: input.campaignId,
            operationId: input.operationId,
            storeId: input.storeId,
            briefing: input.briefing,
            copyContext:
              input.copyContext ?? {
                storeName: input.briefing.product.name,
                segment: "outros",
              },
            copyDirectorEnabled,
            usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
            creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
            runId: input.runId,
            traceId: input.traceId,
          },
          {
            invoker: deps.copyInvoker,
            pilotSpend: deps.pilotSpend,
            callKind: "copy_initial",
            attemptSeq: 1,
          },
        )
      : undefined);
  // Gap 4 / P1 — custo interno por tentativa pela pricing do NOVO FLUXO.
  const resolveAttemptCost = deps.resolveAttemptCost ?? defaultResolveAttemptCost;
  // F56.2b2c (B2.3) — gate de gasto do piloto (INATIVO quando ausente).
  const pilotSpend: PilotSpendGate | undefined = deps.pilotSpend;
  const recordAttemptCall =
    deps.recordAttempt ??
    ((call: RecordAttemptCall) =>
      recordAttempt(client, call as RecordAttemptInput, {
        resolveOperationState: ({ campaignId }) =>
          readOperationState(attempts, campaignId).then(operationStateForHistory),
      }));

  const { campaignId, operationId, storeId } = input;
  const encoder = new TextEncoder();
  // ── Deadline GLOBAL ancorado no INÍCIO DA REQUISIÇÃO (F56.2b2d / D2) ─────
  // O relógio começa em `requestStartedAtMs` (capturado pela rota no topo do
  // POST) — NUNCA reinicia na entrada do orquestrador. O orçamento já consumido
  // antes daqui é descontado automaticamente.
  const startMs = input.requestStartedAtMs ?? Date.now();
  const deadlineAtInMs = deadlineAt(
    startMs,
    deps.deadlineMs ?? PRODUCT_1_1_GENERATION_DEADLINE_MS,
  );
  const controllerAbort = new AbortController();
  // Corrida provider×deadline: a rejeição fecha o `await` pendente mesmo quando o
  // provider ignora o abort do signal (o abort sozinho NÃO encerra um await).
  const deadlineRejection = createDeadlineRejection(deadlineAtInMs);
  // Abort cooperativo no instante-limite (NÃO usa mais o timeout do legado).
  const abortTimerId = setTimeout(
    () => controllerAbort.abort(),
    remainingBudget(Date.now(), deadlineAtInMs),
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
      const flowPhaseStatus = new Map<string, string>();
      // F56.2b2d — guarda de escrita durável NÃO-terminal: `false` quando a
      // reserva de persistência já foi atingida. NÃO promete escrita após kill.
      const canWriteDurable = (): boolean =>
        canStartDurableWrite(Date.now(), deadlineAtInMs);
      let preparationEmitted = false;
      const emitFlowPhase = (phase: string, status: string, message?: string) => {
        flowPhaseStatus.set(phase, status);
        emit({ type: "phase", phase, status, ...(message ? { message } : {}) });
      };
      const emitTerminal = (event: NdjsonEvent) => {
        if (terminalSent) return;
        terminalSent = true;
        // F56.2b2c — em falha/desconhecido NENHUM spinner continua: toda fase
        // ainda `running` é encerrada como `failed` antes do terminal.
        for (const [phase, status] of flowPhaseStatus) {
          if (status !== "running") continue;
          if (event.type === "error") {
            emitFlowPhase(phase, "failed", "Interrompido");
          } else {
            // `result` (concluído) e `unknown` (INCERTEZA) NÃO são falha confirmada:
            // interrompem a animação como NEUTRO, preservando a distinção
            // visual/textual contratada (unknown = âmbar, nunca vermelho).
            emitFlowPhase(
              phase,
              "skipped",
              event.type === "unknown" ? "Aguardando confirmação" : "Não aguardado",
            );
          }
        }
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
        // REUSE do diagnóstico durável centralizado (`instrumentation.ts`):
        // best-effort, nunca bloqueia o terminal público `IMG-001`.
        await recordFailureDiagnosis(recordDiagnosis, {
          reference: publicFailure.reference,
          category: params.internalCategory,
          normalizedError: params.normalizedError,
          model: params.model,
          quality: params.quality,
          target: params.target,
          attemptNumber: params.attemptNumber,
          runId: input.runId,
          traceId: input.traceId,
        });
        emitTerminal({
          type: "error",
          code: publicFailure.code,
          reference: publicFailure.reference,
          message: params.refunded
            ? `${publicFailure.message} Crédito estornado.`
            : publicFailure.message,
          httpStatus: params.httpStatus ?? 502,
          retryable: false,
          // Recorte 2 (Plano 09): SINAL DISCRIMINADO de estorno CONFIRMADO. O
          // consumidor encaminha ao detalhe (RefundedPanel) e NÃO oferece retry
          // da identidade terminal.
          ...(params.refunded ? { refunded: true, campaignId } : {}),
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
        // REUSE do diagnóstico durável centralizado (`instrumentation.ts`).
        await recordFailureDiagnosis(recordDiagnosis, {
          reference,
          category: params.internalCategory,
          normalizedError: params.normalizedError,
          model: params.model,
          quality: params.quality,
          target: params.target,
          attemptNumber: params.attemptNumber,
          runId: input.runId,
          traceId: input.traceId,
        });
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

      // Terminal de pendência AUTORIZADA (sem tentar gravar marcador): preserva um
      // marcador `failed` JÁ persistido (imutável) e roteia à resolução autorizada
      // SEM reescrever `unknown` (evita o caminho que grava `unknown`). Nunca estorna.
      // P3 — usa a REFERÊNCIA CANÔNICA (persistida) quando fornecida; só gera uma
      // nova se não houver (marcador ANTIGO sem referência — sem sobrescrever).
      const emitAuthorizedPending = async (
        params?: {
          internalCategory?: string;
          normalizedError?: string;
          target?: AttemptTarget;
          attemptNumber?: number;
          model?: string;
          quality?: string;
        },
        reference?: string,
      ): Promise<void> => {
        const resolvedReference = reference ?? newSupportReference();
        await recordPendingDiagnosis(resolvedReference, {
          internalCategory: params?.internalCategory ?? "generation_unknown",
          normalizedError: params?.normalizedError ?? "unknown_provider_error",
          target: params?.target,
          attemptNumber: params?.attemptNumber,
          model: params?.model,
          quality: params?.quality,
        });
        emitTerminal({ type: "unknown", reference: resolvedReference });
      };

      // Falha confirmada (sem arte entregue): só ENCERRA (PF) pela RPC do Plano 01
      // quando a AUSÊNCIA está COMPROVADA, o marcador `failed` JÁ foi persistido e o
      // caminho é a DECISÃO TERMINAL. `integral`/`invalid`/`indeterminate`/leitura
      // falha ⇒ pendência (NUNCA estorna). `invalid` (objeto PRESENTE mas não
      // íntegro) NUNCA é tratado como ausência.
      const settleConfirmedFailure = async (params: {
        internalCategory: string;
        normalizedError: string;
        target: AttemptTarget;
        attemptNumber: number;
        model: string;
        quality: string;
        reason: string;
        /** `true` SOMENTE no ponto de decisão terminal (~1245, `generation_failed`). */
        allowPfClosure: boolean;
        /** `true` quando `outcome='failed'` foi persistido COM SUCESSO (item 4a). */
        failedMarkerPersisted: boolean;
        /** P3 — referência de suporte CANÔNICA (persistida) para a pendência. */
        reference?: string;
      }): Promise<void> => {
        // FRESCOR: capturado ANTES da sonda. Falha de leitura ⇒ NÃO CONFIRMADO ⇒ o
        // encerramento PF NÃO é apresentado (pendência) — nunca valor presumido.
        let observedEpoch: number | null = null;
        try {
          observedEpoch = await credit.getPublicationEpoch(campaignId, operationId);
        } catch {
          observedEpoch = null;
        }
        const kind = await probeArtifactKind();
        // Quando o marcador `failed` JÁ foi persistido, NÃO reescrever `unknown`
        // (roteia à resolução autorizada sem o caminho que grava `unknown`) e usa a
        // REFERÊNCIA CANÔNICA persistida (P3 — preserva a correlação do diagnóstico).
        const emitPending = (): Promise<void> =>
          params.failedMarkerPersisted
            ? emitAuthorizedPending(
                {
                  internalCategory: params.internalCategory,
                  normalizedError: params.normalizedError,
                  target: params.target,
                  attemptNumber: params.attemptNumber,
                  model: params.model,
                  quality: params.quality,
                },
                params.reference,
              )
            : emitUnknownPending({
                internalCategory: params.internalCategory,
                normalizedError: params.normalizedError,
                target: params.target,
                attemptNumber: params.attemptNumber,
                model: params.model,
                quality: params.quality,
              });

        if (kind !== "absent") {
          // `integral`/`invalid`/`indeterminate`/`null` ⇒ ausência NÃO comprovada.
          await emitPending();
          return;
        }

        // Ausência CONFIRMADA — o encerramento PF só é apresentado no caminho
        // terminal E com `failed` persistido. Os chamadores não-terminais
        // (`attempt_history_failed`/`artifact_store_failed`) NUNCA fecham: o
        // automático não abandona claim e a RPC exige `failed` gravado.
        if (!params.allowPfClosure || !params.failedMarkerPersisted) {
          await emitPending();
          return;
        }

        let closed = false;
        if (observedEpoch !== null) {
          try {
            const state = await credit.closeFailedOperation({
              campaignId,
              operationId,
              artKind: kind,
              observedEpoch,
              reason: params.reason,
            });
            // Só confirma o encerramento com `refunded` CONFIRMADO.
            closed = state.status === "refunded";
          } catch {
            // Recusa do PF (`operation_terminal`/`operation_in_progress`/
            // `finality_not_recorded`/`absent_not_confirmed`) ⇒ SEM estorno.
            closed = false;
          }
        }
        if (closed) {
          await emitOperationalFailure({
            internalCategory: params.internalCategory,
            normalizedError: params.normalizedError,
            target: params.target,
            attemptNumber: params.attemptNumber,
            model: params.model,
            quality: params.quality,
            refunded: true,
          });
          // Quick 261018-enc — ENCERRAMENTO CONFIRMADO com estorno: projeta a
          // campanha na listagem (`status='error'` + motivo). Idempotente e
          // best-effort: uma falha aqui NÃO altera o desfecho, NÃO provoca nova
          // chamada ao provider/estorno e NUNCA sobrescreve uma entrega `ready`.
          try {
            await projectClosed({
              storeId,
              campaignId,
              operationId,
              reason: "confirmed_failure",
            });
          } catch (projectionError) {
            console.warn(
              "[generation-orchestrator] campaign closure projection failed",
              projectionError instanceof Error
                ? projectionError.message
                : String(projectionError),
            );
          }
          return;
        }
        await emitPending();
      };

      // ── F8 — copy NÃO bloqueante drenada no ciclo da requisição ────────
      // GAP 2 — a copy SÓ inicia APÓS as condições de execução valerem e a
      // tentativa ser ADQUIRIDA como VENCEDORA (depois do curto-circuito
      // `operação existe`, do preflight e de um `acquire` vencedor). Reenvio e
      // corrida PERDIDA ⇒ ZERO chamadas à copy. O estado é persistido e a copy é
      // DRENADA com orçamento (CANCELADA se exceder) ANTES de encerrar o stream —
      // nunca deixa task órfã. A falha da copy NÃO bloqueia `delivered` nem
      // reverte a reserva de crédito, e NÃO existe retry nesta fase.
      let copyDrain: Promise<void> | null = null;
      // F56.2b2a (Plano 02 / lacuna 1) — a TENTATIVA INICIAL nasce IDENTIFICADA:
      // `startCopy` ADQUIRE a identidade (server-autoritativa) ANTES do dreno e
      // propaga `attempt_seq`/`attempt_token` a TODA escrita (`recordCopyState`/
      // `recordCancellation`). O VENCEDOR drena; o PERDEDOR (reenvio, corrida
      // perdida, reentrância) apenas ACOMPANHA — ZERO chamadas ao provider e
      // nenhum estado novo (Gap 2 preservado). Uma tentativa malsucedida é
      // SEMPRE encerrada num terminal identificado (`failed`/`stale_attempt`);
      // NUNCA sobra tentativa `pending` órfã e o drenador NÃO faz retry interno.
      const startCopy = async (): Promise<void> => {
        if (copyDrain !== null || !copyOps) return;
        const ops = copyOps;
        const acquireAttempt =
          ops.acquireAttempt ??
          ((acquireInput) =>
            new ProductOneToOneCopyAcquisitionClient(client).acquire(acquireInput));
        // O token do ACIONAMENTO inicial é gerado SERVER-SIDE (o cliente não o
        // escolhe); o serviço de recuperação NÃO sintetiza este token.
        const requestToken = crypto.randomUUID();
        let acquired: CopyAcquisitionResult;
        try {
          acquired = await acquireAttempt({
            campaignId,
            operationId,
            mode: "auto",
            requestToken,
          });
        } catch {
          // Aquisição fail-closed ⇒ a copy apenas NÃO inicia (best-effort); a
          // arte/entrega NUNCA é bloqueada pela copy.
          return;
        }
        if (!acquired.acquired) return; // PERDEDOR: ZERO chamadas, nenhum estado.
        emitFlowPhase("campaign_copy", "running", "Gerando texto da campanha...");
        const copyStore: CopyStateStore = {
          recordCopyState: ops.recordCopyState ?? ((i) => recordCopyState(client, i)),
          recordCancellation:
            ops.recordCancellation ?? ((i) => recordCancellation(client, i)),
        };
        // F56.2b2d — o orçamento da copy é limitado pelo tempo RESTANTE até o
        // deadline (não pelo teto da plataforma/legado).
        const budgetMs = Math.max(
          0,
          Math.min(
            ops.budgetMs ?? COPY_BUDGET_MS,
            remainingBeforeDeadline(Date.now(), deadlineAtInMs),
          ),
        );
        const budget = (ops.makeBudgetSignal ?? createCopyBudgetSignal)(budgetMs);
        copyDrain = drainCopyTask(
          {
            campaignId,
            operationId,
            attemptSeq: acquired.attemptSeq,
            attemptToken: acquired.attemptToken,
            recoveryKind: "auto",
            signal: budget.signal,
            // Correção pós-revisão (2026-10-14) — a tentativa INICIAL classifica
            // a falha NORMALIZADA do gateway (`AiInvocationError.retryable`) do
            // mesmo modo que o serviço de recuperação: uma falha transitória do
            // gateway não é lida como definitiva.
            classifyFailure: classifyCopyFailure,
            run: ({ signal, commit }) =>
              ops.runCopy({ campaignId, operationId, signal, commit }),
          },
          copyStore,
        ).then(
          () => {
            budget.dispose();
            emitFlowPhase("campaign_copy", "complete");
          },
          () => {
            budget.dispose();
            emitFlowPhase("campaign_copy", "failed", "Falha ao gerar o texto.");
          },
        );
      };

      try {
        emitFlowPhase("campaign_validation", "running", "Validando dados...");

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
          references: productReferenceIds(input),
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
        if (!canWriteDurable()) {
          // Reserva de persistência atingida: NÃO iniciar a escrita durável.
          // Encerra honestamente (pendência `unknown` best-effort).
          await emitUnknownPending({ internalCategory: "persistence_reserve_reached" });
          return;
        }
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
        if (!canWriteDurable()) {
          await emitUnknownPending({ internalCategory: "persistence_reserve_reached" });
          return;
        }
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

          // GAP 2 — a tentativa foi ADQUIRIDA como vencedora: só AGORA a copy é
          // iniciada (nunca no reenvio `operação existe`, nem na corrida perdida).
          // A tentativa inicial da copy é ADQUIRIDA (identidade server-side) ANTES
          // do dreno; perdedora ⇒ acompanha com ZERO chamadas.
          await startCopy();

          if (!preparationEmitted) {
            preparationEmitted = true;
            emitFlowPhase("campaign_validation", "complete");
            emitFlowPhase("campaign_preparation", "running", "Preparando briefing...");
            emitFlowPhase("campaign_preparation", "complete");
            emitFlowPhase("campaign_copy", "running", "Gerando texto da campanha...");
          }
          emitFlowPhase(
            "campaign_image",
            "running",
            target === "fallback"
              ? "Tentando provedor alternativo..."
              : attemptNumber > 1
                ? "Tentando novamente a imagem..."
                : "Gerando imagem...",
          );
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
              // C2 — chamador NÃO-terminal: inconclusivo, NUNCA fecha/estorna.
              allowPfClosure: false,
              failedMarkerPersisted: false,
            });
            return;
          }

          // ── Instrumentação por tentativa (REQ-12 / P1 — Opção A): o gateway
          // emite UM envelope REAL por tentativa (usage/durationMs/status/model/
          // quality reais). O custo INTERNO do par (`modelo + qualidade` +
          // versão/origem — a MESMA pricing validada no preflight) acompanha o
          // contexto de telemetria como `internalCost`; o sink ÚNICO o grava com
          // origem `pricing_table` (NUNCA `provider_reported`), persistindo o
          // envelope REAL — SEM reconstrução zero-duration e SEM duplicar registros.
          const attemptPair = snapshotPairForTarget(snapshot, target);
          let internalCost: AiEnvelopeInternalCost = {
            estimatedCostUsd: null,
            pricingVersion: null,
            origin: NEW_FLOW_INTERNAL_COST_ORIGIN,
            source: null,
            model: attemptPair.model,
            quality: attemptPair.quality,
          };
          try {
            const resolution = await resolveAttemptCost({
              primary: { model: snapshot.primaryModel, quality: snapshot.primaryQuality },
              fallback: { model: snapshot.fallbackModel, quality: snapshot.fallbackQuality },
            });
            const attemptCost = attemptCostForTarget(resolution, target);
            internalCost = {
              estimatedCostUsd: attemptCost.costUsd,
              pricingVersion: attemptCost.versionId,
              origin: NEW_FLOW_INTERNAL_COST_ORIGIN,
              source: attemptCost.costSource,
              model: attemptPair.model,
              quality: attemptPair.quality,
            };
          } catch {
            // Fail-open da PRICING nunca vira fallback legado: mantém
            // `internalCost` PRESENTE (com valor ausente) ⇒ o sink o sinaliza
            // explicitamente (`not_available` + metadata), sem mislabel e sem a
            // cadeia legada.
          }

          // Chamada ao provider (uma tentativa por invocação).
          let imageDataUrl: string | undefined;
          let failure: unknown;
          try {
            const telemetryInput: TelemetryContextInput = {
              campaignId,
              storeId,
              attemptNumber,
              usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
              creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
              runId: input.runId,
              traceId: input.traceId,
              internalCost,
            };
            const baseTelemetry = deps.createTelemetry
              ? deps.createTelemetry(telemetryInput)
              : defaultTelemetry(telemetryInput);
            // Observador de TESTE: recebe o envelope REAL do gateway (1/tentativa).
            const telemetry = onAttemptEnvelope
              ? withOnCallTelemetry(baseTelemetry, onAttemptEnvelope)
              : baseTelemetry;
            const request: AiInvocationRequest = {
              ...providerImageRequest(input),
              prompt: composition.text,
              quality:
                target === "fallback" ? snapshot.fallbackQuality : snapshot.primaryQuality,
              size: "1024x1024",
              signal: controllerAbort.signal,
            };
            // F56.2b2c (B2.3) — gate de gasto do piloto POR CHAMADA (INATIVO se ausente).
            const pilotKind: PilotPaidCallKind =
              target === "fallback"
                ? "image_fallback"
                : attemptNumber === 1
                  ? "image_primary"
                  : "image_retry";
            const pilotEstimatedUsd = internalCost.estimatedCostUsd;
            let pilotHandle: PilotPaidCallHandle | undefined;
            if (pilotSpend) {
              // Estimativa OBRIGATÓRIA e ESTRITAMENTE POSITIVA quando armado (M1).
              if (typeof pilotEstimatedUsd !== "number" || !Number.isFinite(pilotEstimatedUsd) || pilotEstimatedUsd <= 0) {
                throw new Error("pilot_spend_blocked:estimate_required");
              }
              const decision = await pilotSpend.beginPaidCall({
                campaignId,
                operationId,
                kind: pilotKind,
                attemptSeq: attemptNumber,
                estimatedUsd: pilotEstimatedUsd,
              });
              // Só `acquired` autoriza invocar o provider; replay/closed/fechado NÃO.
              if (!decision.acquired) {
                throw new Error(`pilot_spend_blocked:${decision.reason}`);
              }
              pilotHandle = decision.handle;
            }
            try {
              // T-56.2.6-47 — a invocação ÚNICA do provider é CORRIDA contra o
              // deadline. O promise PERDEDOR é QUARENTENADO: um resultado TARDIO
              // nunca entrega, marca arte, estorna nem emite segundo terminal.
              // Abortar o signal sozinho NÃO encerra o `await` pendente.
              const providerCall = gateway.invoke(
                NEW_FLOW_CAPABILITY,
                request,
                telemetry,
                target,
              );
              providerCall.then(
                () => {
                  if (deadlineRejection.didHit()) {
                    console.warn(
                      "[generation-orchestrator] late provider result discarded after deadline",
                    );
                  }
                },
                () => {
                  if (deadlineRejection.didHit()) {
                    console.warn(
                      "[generation-orchestrator] late provider failure discarded after deadline",
                    );
                  }
                },
              );
              const result = await Promise.race([
                providerCall,
                deadlineRejection.promise,
              ]);
              if (!result.imageBase64) {
                throw new Error("no_image_in_response");
              }
              imageDataUrl = `data:${result.mimeType ?? "image/png"};base64,${result.imageBase64}`;
              if (pilotSpend && pilotHandle) {
                await pilotSpend.endPaidCall({ handle: pilotHandle, actualEstimatedUsd: pilotEstimatedUsd });
              }
            } catch (invokeError) {
              if (pilotSpend && pilotHandle) {
                // M3 — a falha do gate é REGISTRADA SEPARADAMENTE; relançamos o ERRO
                // ORIGINAL (natureza desconhecida preservada). Nunca converte a falha
                // secundária em autorização para retry/marcador `failed`/estorno PF.
                try {
                  if (controllerAbort.signal.aborted || isUnknownPilotOutcome(invokeError)) {
                    await pilotSpend.markUnknown({ handle: pilotHandle, reason: "timeout_or_unknown" });
                  } else {
                    await pilotSpend.endPaidCall({ handle: pilotHandle, actualEstimatedUsd: pilotEstimatedUsd });
                  }
                } catch (gateError) {
                  console.error(
                    "[pilot-spend] falha ao encerrar/marcar a chamada de imagem:",
                    String(gateError instanceof Error ? gateError.message : gateError),
                  );
                }
              }
              throw invokeError;
            }
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
            // Recorte 1 (Plano 08) — FENCE PRÉ-UPLOAD: anunciar a publicação ANTES
            // de escrever no Storage. `acquired:false` ⇒ reenvio ACOMPANHA a
            // publicação existente e NÃO inicia outra (emite pendência).
            let publicationToken: string | null = null;
            if (!canWriteDurable()) {
              await emitUnknownPending({
                internalCategory: "persistence_reserve_reached",
                target,
                attemptNumber,
                model: snapshotPairForTarget(snapshot, target).model,
                quality: snapshotPairForTarget(snapshot, target).quality,
              });
              return;
            }
            try {
              const begun = await credit.beginPublication(campaignId, operationId);
              publicationToken = begun.acquired ? begun.token : null;
            } catch {
              publicationToken = null;
            }
            if (publicationToken === null) {
              await emitUnknownPending({ internalCategory: "publication_not_acquired" });
              return;
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
              // NÃO comprovadamente antes do envio ⇒ MANTER proteção (`result_unknown`);
              // reexaminar a arte (`settleConfirmedFailure` sonda) e NUNCA estornar cego.
              try {
                await credit.markResultUnknown(campaignId, operationId, publicationToken);
              } catch {
                // permanece `in_flight` (protegido)
              }
              await settleConfirmedFailure({
                internalCategory: "artifact_store_failed",
                normalizedError: "unknown_provider_error",
                target,
                attemptNumber,
                model: snapshotPairForTarget(snapshot, target).model,
                quality: snapshotPairForTarget(snapshot, target).quality,
                reason: "artifact_upload_failed",
                // C2 — chamador NÃO-terminal: inconclusivo, NUNCA fecha/estorna.
                allowPfClosure: false,
                failedMarkerPersisted: false,
              });
              return;
            }
            void ref;
            const deliveryPendingParams = {
              internalCategory: "persistence_reserve_reached",
              target,
              attemptNumber,
              model: snapshotPairForTarget(snapshot, target).model,
              quality: snapshotPairForTarget(snapshot, target).quality,
            };
            if (!canWriteDurable()) {
              // Não iniciar a confirmação de arte dentro da reserva.
              await emitUnknownPending(deliveryPendingParams);
              return;
            }
            try {
              await credit.markArtUploaded(campaignId, operationId, publicationToken);
              if (!canWriteDurable()) {
                // Arte confirmada mas entrega fora da reserva: NÃO iniciar a
                // entrega; permanece recuperável como pendência honesta.
                await emitUnknownPending(deliveryPendingParams);
                return;
              }
              await credit.deliver(campaignId, operationId, publicationToken);
            } catch {
              // Upload concluído mas confirmação/metadados falharam ⇒ `result_unknown`
              // (a recuperação conclui a entrega a partir da arte íntegra).
              try {
                await credit.markResultUnknown(campaignId, operationId, publicationToken);
              } catch {
                // permanece `in_flight` (protegido)
              }
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
            // Quick 261017-cdi — ENTREGA CONFIRMADA: projeta a campanha na listagem
            // (`status='ready'` + caminho real da arte). Idempotente e best-effort:
            // uma falha aqui NÃO altera o desfecho da entrega (sem regeneração/
            // estorno) e permite reparo repetindo a chamada.
            try {
              await projectCampaign({ storeId, campaignId, operationId });
            } catch (projectionError) {
              console.warn(
                "[generation-orchestrator] campaign projection failed",
                projectionError instanceof Error
                  ? projectionError.message
                  : String(projectionError),
              );
            }
            emitFlowPhase("campaign_image", "complete");
            emitFlowPhase("campaign_delivery", "running", "Entregando a campanha...");
            emitFlowPhase("campaign_delivery", "complete");
            emitTerminal({ type: "result", campaignUrl: `/campanhas/${campaignId}` });
            return;
          }

          // ── Resultado DESCONHECIDO (timeout/abort/deadline) ─────────────
          // A corrida provider×deadline pode rejeitar ANTES do abort cooperativo
          // propagar — `didHit()` cobre o disparo do deadline mesmo quando o
          // `signal` ainda não está `aborted`.
          if (
            isUnknownResult(
              failure,
              controllerAbort.signal.aborted || deadlineRejection.didHit(),
            )
          ) {
            // P1 (Opção A): o envelope REAL (timeout/abort) já foi persistido
            // pelo sink ÚNICO durante `gateway.invoke`.
            const reference = newSupportReference();
            // WR-02: renomeado para NÃO sombrear o `persisted` externo (resultado da
            // persistência do snapshot, `:863`) — significados distintos.
            const markerPersisted = await markUnknownOutcome(reference);
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
            if (markerPersisted) {
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
          // P1 (Opção A): o envelope REAL de falha já foi persistido pelo sink
          // ÚNICO durante `gateway.invoke`.
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

          // ── PONTO DE DECISÃO TERMINAL (~1245): ÚNICA gravação de `failed` ──
          // C2 — a janela principal→fallback acima (`continue`) NÃO grava o
          // marcador: retry/fallback pendente NÃO satisfaz o PF. SÓ aqui (quando a
          // política NÃO produz próxima tentativa) o marcador `outcome='failed'` é
          // gravado (item 4a). Falha de gravação OU `unknown` imutável
          // pré-existente ⇒ permanece INCONCLUSIVO: NÃO fecha (a RPC exige
          // `failed` persistido) e roteia à resolução autorizada, SEM sobrescrever
          // o marcador.
          let failedMarkerPersisted = false;
          // P3 — referência de suporte CANÔNICA: gerada ANTES da gravação e
          // persistida no marcador `failed`; em replay IDEMPOTENTE prevalece a
          // referência JÁ persistida (o RPC devolve a linha existente).
          const supportReference = newSupportReference();
          let canonicalReference: string | null = supportReference;
          try {
            const recorded = (await attempts.recordOperationOutcome({
              campaignId,
              operationId,
              outcome: "failed",
              supportReference,
            })) as { supportReference?: string | null } | null | undefined;
            failedMarkerPersisted = true;
            canonicalReference = recorded?.supportReference ?? supportReference;
          } catch {
            failedMarkerPersisted = false;
          }

          await settleConfirmedFailure({
            internalCategory: "generation_failed",
            normalizedError: DIAGNOSIS_ERROR_BY_FAILURE_CLASS[classification.category],
            target,
            attemptNumber,
            model: snapshotPairForTarget(snapshot, target).model,
            quality: snapshotPairForTarget(snapshot, target).quality,
            reason: "generation_failed",
            allowPfClosure: true,
            failedMarkerPersisted,
            reference: canonicalReference ?? undefined,
          });
          return;
        }
      } catch {
        await emitOperationalFailure({
          internalCategory: "internal_error",
          normalizedError: "unknown_provider_error",
        });
      } finally {
        clearTimeout(abortTimerId);
        deadlineRejection.cancel();
        // F8 — drena a copy DENTRO do ciclo: aguarda/cancela ANTES de encerrar
        // (nunca deixa task órfã após a resposta). Best-effort: nunca bloqueia.
        if (copyDrain) {
          try {
            await copyDrain;
          } catch {
            // ignore — o estado da copy é best-effort e nunca bloqueia a entrega.
          }
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // Cliente cancelou o stream: limpa o timer de abort e a promessa de deadline.
      clearTimeout(abortTimerId);
      deadlineRejection.cancel();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
