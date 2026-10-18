import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ArtifactProbe } from "../artifact/types";
import {
  SupabasePendingOperationsRepository,
  type PendingOperationsRepository,
} from "./pending-operations-repository";
import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import {
  projectClosedCampaign,
  type ProjectClosedReason,
} from "@/lib/product-1-1/orchestration/project-closed-campaign";

/**
 * F56.2b1b (Plano 07, B1B-D5 / REQ-56.2.2-08) — serviço server-only de resolução
 * administrativa de pendências.
 *
 * F5 — a evidência que governa a ação é DERIVADA SERVER-SIDE (a partir da sonda
 * TIPADA `probeArtifact` = Storage/DB + o estado persistido da operação/claims);
 * o servidor NUNCA confia em booleanos do cliente. Quando a evidência é
 * insuficiente (`invalid`/`indeterminate`) ou o estado não permite a ação, o
 * serviço RECUSA ANTES de chamar a RPC — sem refund/deliver e sem "warn but
 * allow". Esta é a autoridade; o gate do cliente é apenas UX.
 *
 * C4 — a resolução invoca SOMENTE a RPC auditada
 * `admin_resolve_product_1_1_pending` (a trava `FOR UPDATE` e a atomicidade vivem
 * no Postgres, na MESMA linha que a aquisição de tentativa do Plano 03 trava).
 *
 * E1/D13 — sem FONTE OPERACIONAL comprovada de encerramento da execução, um claim
 * `in_progress` (inclusive o RESIDUAL do fail-closed I2) BLOQUEIA a resolução:
 * sem estorno, sem nova geração, sem retomada. A idade/timeout NÃO é evidência de
 * encerramento. A b1b NÃO declara recuperabilidade completa; evidência simulada
 * (harness/fake) NÃO é prova operacional; o GATE obrigatório (bloqueante) da b2
 * precede o piloto/habilitação (fechamento no Plano 10).
 */

export type PendingResolutionAction = "deliver_existing_art" | "refund_once";

export type PendingResolutionErrorCode =
  | "missing_reason"
  | "missing_actor_id"
  | "missing_campaign_id"
  | "missing_operation_id"
  | "missing_resolution_operation_id"
  | "invalid_action"
  | "invalid_evidence"
  | "insufficient_evidence"
  | "operation_not_found"
  | "operation_terminal"
  | "operation_in_progress"
  | "execution_not_ended"
  | "delivered_not_refundable"
  | "operation_identity_conflict"
  | "invalid_response"
  | "unknown";

/** Erro tipado da resolução de pendência (fail-closed). */
export class PendingOperationResolutionError extends Error {
  constructor(
    public readonly code: PendingResolutionErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PendingOperationResolutionError";
  }
}

const KNOWN_CODES: readonly PendingResolutionErrorCode[] = [
  "missing_reason",
  "missing_actor_id",
  "missing_campaign_id",
  "missing_operation_id",
  "missing_resolution_operation_id",
  "invalid_action",
  "invalid_evidence",
  "insufficient_evidence",
  "operation_not_found",
  "operation_terminal",
  "operation_in_progress",
  "execution_not_ended",
  "delivered_not_refundable",
  "operation_identity_conflict",
  // Envelope inválido/incompleto/contraditório devolvido pela RPC (F3): NUNCA é
  // sucesso; mapeia para 500 (fail-closed), sem expor detalhe interno.
  "invalid_response",
];

/** Códigos que mapeiam para 400 Bad Request. */
const BAD_REQUEST_CODES: readonly PendingResolutionErrorCode[] = [
  "missing_reason",
  "missing_actor_id",
  "missing_campaign_id",
  "missing_operation_id",
  "missing_resolution_operation_id",
  "invalid_action",
  "invalid_evidence",
  "insufficient_evidence",
];

/** Códigos que mapeiam para 409 Conflict. */
const CONFLICT_CODES: readonly PendingResolutionErrorCode[] = [
  "operation_terminal",
  "operation_in_progress",
  "execution_not_ended",
  "delivered_not_refundable",
  "operation_identity_conflict",
];

function mapRpcError(message: string | undefined | null): PendingOperationResolutionError {
  const text = message ?? "";
  for (const code of KNOWN_CODES) {
    if (text.includes(code)) return new PendingOperationResolutionError(code, text);
  }
  return new PendingOperationResolutionError("unknown", text || "unknown_error");
}

/** Mapeia um erro da resolução para o status HTTP (puro; testável). */
export function resolutionErrorStatus(error: unknown): number {
  const code =
    error instanceof PendingOperationResolutionError
      ? error.code
      : ((error as { code?: string } | null)?.code ?? "unknown");
  if (BAD_REQUEST_CODES.includes(code as PendingResolutionErrorCode)) return 400;
  if (code === "operation_not_found") return 404;
  if (CONFLICT_CODES.includes(code as PendingResolutionErrorCode)) return 409;
  return 500;
}

export interface ResolvePendingInput {
  readonly actorId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly action: PendingResolutionAction;
  readonly reason: string;
  readonly resolutionOperationId: string;
  /**
   * C1 (B2B-D4) — SINAL EXPLÍCITO de autorização do abandono do claim
   * `in_progress` residual (default `false`).
   */
  readonly authorizeAbandon?: boolean;
  /**
   * Recorte 1 (Plano 08) — SINAL EXPLÍCITO de autorização para encerrar uma
   * publicação REALMENTE INCONCLUSIVA (`in_flight`/`result_unknown`). NÃO
   * desabilita a proteção de ausência obsoleta (`none`/`failed_before_upload`
   * ainda exigem epoch fresco) nem permite estornar `published`. Default `false`.
   */
  readonly authorizePublicationClosure?: boolean;
}

export interface ResolvePendingDependencies {
  readonly client?: SupabaseClient;
  readonly repository?: PendingOperationsRepository;
  /**
   * Quick 261017-cdi — projeção idempotente da campanha após `deliver_existing_art`
   * confirmado. Default = `projectDeliveredCampaign`. Uma falha NÃO reclassifica a
   * entrega (reparo idempotente) e NUNCA provoca estorno.
   */
  readonly projectDeliveredCampaign?: typeof projectDeliveredCampaign;
  /**
   * Quick 261018-enc — projeção idempotente da campanha após `refund_once`
   * CONFIRMADO (`status='refunded'`). Default = `projectClosedCampaign`. Uma falha
   * NÃO reclassifica o encerramento nem sobrescreve entrega confirmada.
   */
  readonly projectClosedCampaign?: typeof projectClosedCampaign;
}

export interface PendingResolutionResult {
  readonly campaignId: string;
  readonly operationId: string;
  readonly action: PendingResolutionAction;
  readonly status: string;
  readonly artifactKind: ArtifactProbe["kind"];
  readonly idempotent: boolean;
}

/** Evidência TIPADA derivada server-side (nunca declarada pelo cliente). */
interface ServerDerivedEvidence {
  readonly origin: "server-derived";
  readonly art_kind: ArtifactProbe["kind"];
  readonly execution_ended: boolean;
  /** Recorte 1 — frescor capturado ANTES da sonda (comparado sob a trava pela RPC). */
  readonly state_epoch: number;
  /** Recorte 1 — estado do fence de publicação (nunca declarado pelo cliente). */
  readonly publication_state: string;
  /** B2B-D4 — marca de abandono AUTORIZADO (só no caminho autorizado/auditado). */
  readonly authorized_abandon?: boolean;
  /** Recorte 1 — autorização RESTRITA ao inconclusivo (marca própria e auditada). */
  readonly authorized_publication_closure?: boolean;
}

/**
 * Lista SOMENTE-LEITURA das pendências (com evidência de arte derivada
 * server-side). NUNCA executa nada — a "fila de atendimento" é apenas lista.
 */
export async function listPendingOperations(
  dependencies: ResolvePendingDependencies = {},
) {
  const repository =
    dependencies.repository ?? new SupabasePendingOperationsRepository(dependencies.client);
  return repository.listPendingOperations();
}

/**
 * Deriva a evidência server-side e resolve a pendência pela RPC auditada.
 * `invalid`/`indeterminate` BLOQUEIAM; `refund_once` exige `absent` CONFIRMADO;
 * um claim `in_progress` sem evidência de encerramento BLOQUEIA (E1/D13).
 *
 * F1 — a decisão de claim ativo é da RPC, derivada SOB A TRAVA; o serviço envia
 * a evidência apenas como fast-path NÃO-autoritativo.
 * F2(a) — operação TERMINAL não é recusada aqui: a RPC decide IDEMPOTENTE
 * (replay equivalente) × CONFLITO (divergente).
 * F3 — o envelope da RPC é validado (identidade + `status` terminal coerente);
 * incompleto/contraditório ⇒ FAIL CLOSED (`invalid_response`).
 */
export async function resolvePendingOperation(
  input: ResolvePendingInput,
  dependencies: ResolvePendingDependencies = {},
): Promise<PendingResolutionResult> {
  if (!input.actorId) throw new PendingOperationResolutionError("missing_actor_id");
  if (!input.campaignId) throw new PendingOperationResolutionError("missing_campaign_id");
  if (!input.operationId) throw new PendingOperationResolutionError("missing_operation_id");
  if (!input.reason || input.reason.trim() === "") {
    throw new PendingOperationResolutionError("missing_reason");
  }
  if (!input.resolutionOperationId) {
    throw new PendingOperationResolutionError("missing_resolution_operation_id");
  }
  if (input.action !== "deliver_existing_art" && input.action !== "refund_once") {
    throw new PendingOperationResolutionError("invalid_action");
  }

  const repository =
    dependencies.repository ?? new SupabasePendingOperationsRepository(dependencies.client);
  const client = dependencies.client ?? supabaseAdmin;

  const state = await repository.findPendingOperation(input.campaignId, input.operationId);
  if (!state) throw new PendingOperationResolutionError("operation_not_found");

  // F5 — deriva a evidência SERVER-SIDE (Storage/DB), nunca booleanos do cliente.
  const probe = await repository.probeArtifact(
    state.storeId,
    input.campaignId,
    input.operationId,
  );
  const artKind = probe.kind;

  // F5/C2 — indeterminado/inválido BLOQUEIA qualquer ação (sem refund/deliver).
  // Fast-path NÃO-autoritativo: a RPC revalida a mesma regra.
  if (artKind === "invalid" || artKind === "indeterminate") {
    throw new PendingOperationResolutionError("insufficient_evidence");
  }

  // F2(a) — operação TERMINAL NÃO é recusada antecipadamente: um replay
  // EQUIVALENTE (mesmo conteúdo) precisa alcançar a RPC e resolver IDEMPOTENTE
  // (um efeito/uma auditoria); um replay DIVERGENTE resolve CONFLITO
  // (`operation_identity_conflict`); um terminal de AÇÃO divergente resolve
  // `operation_terminal`. A RPC é a AUTORIDADE (idempotente × conflito).
  // E1/D13 — execução ativa (claim `in_progress`, inclusive o RESIDUAL) BLOQUEIA
  // enquanto não houver evidência server-side de ENCERRAMENTO. Sem fonte
  // operacional comprovada, `execution_ended` é `false` e a resolução permanece
  // BLOQUEADA (fail-closed, sem transição parcial). Idade/timeout NÃO é evidência.
  // Os pré-checks abaixo são apenas um FAST-PATH NÃO-autoritativo (a RPC deriva o
  // estado SOB A TRAVA); ficam restritos a operações NÃO terminais para que o
  // replay terminal alcance a decisão idempotente/conflito da RPC.
  const executionEnded = !state.processing;
  // C1-i — o SINAL EXPLÍCITO de autorização (`authorizeAbandon`) abre o caminho
  // AUTORIZADO/auditado. SEM o sinal (default `false`), o comportamento de HOJE é
  // PRESERVADO byte-a-byte (`processing` ⇒ `operation_in_progress`, RPC não
  // chamada). A AUTORIDADE final continua sendo a RPC sob a trava.
  const authorizedAbandon = input.authorizeAbandon === true;
  if (!state.terminal) {
    if (state.processing && !authorizedAbandon) {
      throw new PendingOperationResolutionError("operation_in_progress");
    }
    if (input.action === "deliver_existing_art" && artKind !== "integral") {
      throw new PendingOperationResolutionError("insufficient_evidence");
    }
    if (input.action === "refund_once" && artKind !== "absent") {
      throw new PendingOperationResolutionError("insufficient_evidence");
    }
    if (input.action === "refund_once" && !executionEnded && !authorizedAbandon) {
      throw new PendingOperationResolutionError("execution_not_ended");
    }
  }

  const evidence: ServerDerivedEvidence = Object.freeze({
    origin: "server-derived",
    art_kind: artKind,
    execution_ended: executionEnded,
    state_epoch: state.stateEpoch,
    publication_state: state.publicationState,
    // A marca só é emitida no caminho AUTORIZADO; nunca inferida do cliente.
    ...(authorizedAbandon ? { authorized_abandon: true } : {}),
    ...(input.authorizePublicationClosure === true ? { authorized_publication_closure: true } : {}),
  });

  const { data, error } = await client.rpc("admin_resolve_product_1_1_pending", {
    p_actor_id: input.actorId,
    p_campaign_id: input.campaignId,
    p_operation_id: input.operationId,
    p_action: input.action,
    p_reason: input.reason.trim(),
    p_resolution_operation_id: input.resolutionOperationId,
    p_evidence: evidence,
  });
  if (error) throw mapRpcError(error.message);

  // F3 — o envelope da RPC DEVE ser EXPLÍCITO e COERENTE (`success === true`,
  // identidade igual à requisição e `status` TERMINAL coerente com a ação). Um
  // envelope AUSENTE/INCOMPLETO/CONTRADITÓRIO (ex.: `{}`, `null`, sem `success`,
  // identidade divergente, `status` incoerente) NUNCA vira sucesso: FAIL CLOSED
  // (`invalid_response`).
  const record = (data ?? null) as Record<string, unknown> | null;
  if (!record || record.success !== true) {
    // `success === false` explícito: propaga o MOTIVO tipado da RPC (idempotente
    // × conflito × terminal × in_progress, etc.).
    if (record && record.success === false) {
      const reason = typeof record.reason === "string" ? record.reason : "unknown_error";
      throw new PendingOperationResolutionError(
        (KNOWN_CODES.includes(reason as PendingResolutionErrorCode)
          ? reason
          : "unknown") as PendingResolutionErrorCode,
        reason,
      );
    }
    throw new PendingOperationResolutionError("invalid_response", "invalid_response_envelope");
  }

  const expectedStatus = input.action === "deliver_existing_art" ? "delivered" : "refunded";
  if (
    String(record.campaign_id) !== input.campaignId ||
    String(record.operation_id) !== input.operationId ||
    record.action !== input.action ||
    record.status !== expectedStatus
  ) {
    throw new PendingOperationResolutionError("invalid_response", "invalid_response_envelope");
  }

  // Quick 261017-cdi — entrega CONFIRMADA pela RPC: projeta a campanha na
  // listagem. NUNCA propaga erro nem provoca estorno (reparo idempotente).
  if (input.action === "deliver_existing_art") {
    const projectCampaign =
      dependencies.projectDeliveredCampaign ?? projectDeliveredCampaign;
    try {
      await projectCampaign({
        storeId: state.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
    } catch (error) {
      console.warn(
        "[resolve-pending-operation] campaign projection failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Quick 261018-enc — encerramento CONFIRMADO com estorno (`refund_once`
  // idempotente/concluído): projeta a campanha na listagem. O motivo é
  // best-effort; se não for comprovável, usa o neutro. Uma falha aqui NÃO
  // reclassifica o encerramento nem sobrescreve entrega confirmada.
  if (input.action === "refund_once") {
    const projectClosed =
      dependencies.projectClosedCampaign ?? projectClosedCampaign;
    const reason: ProjectClosedReason = state.processing
      ? "authorized_abandon"
      : state.publicationState === "in_flight" ||
          state.publicationState === "result_unknown"
        ? "publication_closure"
        : "closed_neutral";
    try {
      await projectClosed({
        storeId: state.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        reason,
      });
    } catch (error) {
      console.warn(
        "[resolve-pending-operation] campaign closure projection failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return Object.freeze({
    campaignId: input.campaignId,
    operationId: input.operationId,
    action: input.action,
    status: expectedStatus,
    artifactKind: artKind,
    idempotent: record.idempotent === true,
  });
}
