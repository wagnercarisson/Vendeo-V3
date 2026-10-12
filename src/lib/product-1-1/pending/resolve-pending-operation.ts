import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ArtifactProbe } from "../artifact/types";
import {
  SupabasePendingOperationsRepository,
  type PendingOperationsRepository,
} from "./pending-operations-repository";

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
}

export interface ResolvePendingDependencies {
  readonly client?: SupabaseClient;
  readonly repository?: PendingOperationsRepository;
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

  // F5 — operação terminal não é resolvível (nenhum efeito novo).
  if (state.terminal) throw new PendingOperationResolutionError("operation_terminal");

  // F5/C2 — indeterminado/inválido BLOQUEIA qualquer ação (sem refund/deliver).
  if (artKind === "invalid" || artKind === "indeterminate") {
    throw new PendingOperationResolutionError("insufficient_evidence");
  }

  // E1/D13 — execução ativa (claim `in_progress`, inclusive o RESIDUAL) BLOQUEIA
  // enquanto não houver evidência server-side de ENCERRAMENTO. Sem fonte
  // operacional comprovada, `execution_ended` é `false` e a resolução permanece
  // BLOQUEADA (fail-closed, sem transição parcial). Idade/timeout NÃO é evidência.
  const executionEnded = !state.processing;
  if (state.processing && !executionEnded) {
    throw new PendingOperationResolutionError("operation_in_progress");
  }

  if (input.action === "deliver_existing_art" && artKind !== "integral") {
    throw new PendingOperationResolutionError("insufficient_evidence");
  }
  if (input.action === "refund_once" && artKind !== "absent") {
    throw new PendingOperationResolutionError("insufficient_evidence");
  }
  if (input.action === "refund_once" && !executionEnded) {
    throw new PendingOperationResolutionError("execution_not_ended");
  }

  const evidence: ServerDerivedEvidence = Object.freeze({
    origin: "server-derived",
    art_kind: artKind,
    execution_ended: executionEnded,
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

  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success === false) {
    const reason = typeof record.reason === "string" ? record.reason : "unknown_error";
    throw new PendingOperationResolutionError(
      (KNOWN_CODES.includes(reason as PendingResolutionErrorCode)
        ? reason
        : "unknown") as PendingResolutionErrorCode,
      reason,
    );
  }

  return Object.freeze({
    campaignId: String(record.campaign_id ?? input.campaignId),
    operationId: String(record.operation_id ?? input.operationId),
    action: input.action,
    status: String(record.status ?? ""),
    artifactKind: artKind,
    idempotent: record.idempotent === true,
  });
}
