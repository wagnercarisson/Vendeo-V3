import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

import {
  COPY_BUDGET_MS,
  createCopyBudgetSignal,
  drainCopyTask,
  readCopyAttempts,
  readCopyDelivery,
  readCopyRecoverySummary,
  recordCancellation,
  recordCopyState,
  type CopyDeliveryRecord,
  type CopyFailureClass,
  type CopyState,
  type CopyStateStore,
} from "./copy-state";
import { isRetryableError } from "@/lib/copy/errors";
import {
  ProductOneToOneCopyAcquisitionClient,
  ProductOneToOneCopyAcquisitionError,
  type CopyAcquisitionMode,
  type CopyAcquisitionReason,
  type CopyAcquisitionResult,
} from "./copy-acquisition-client";
import {
  createDefaultProductOneToOneCopyOps,
  type DefaultProductOneToOneCopyRunnerDeps,
  type DefaultProductOneToOneCopyRunnerInput,
} from "./default-copy-runner";

/**
 * F56.2b2a (B2.1 / B2A-D2/D3/D5) — SERVIÇO server-only da recuperação de copy do
 * Produto 1:1.
 *
 * Executa UMA tentativa IDENTIFICADA por acionamento:
 *
 *  1. EXIGE o `requestToken` OBRIGATÓRIO (identidade de acionamento, condição de
 *     dedupe — NUNCA autoridade/vencedor). Ausente ⇒ `missing_request_token`
 *     ANTES de qualquer aquisição/provider;
 *  2. AQUISIÇÃO ATÔMICA via `ProductOneToOneCopyAcquisitionClient.acquire`: o
 *     servidor decide (sob trava) o VENCEDOR e devolve a identidade
 *     (`attempt_seq`/`attempt_token`); o PERDEDOR apenas ACOMPANHA (ZERO
 *     chamadas ao provider);
 *  3. o VENCEDOR produz SOMENTE os textos via `createDefaultProductOneToOneCopyOps`
 *     (UMA chamada ao provider por tentativa, alvo explícito decidido
 *     SERVER-SIDE) e persiste sob a identidade ADQUIRIDA via
 *     `recordCopyState`/`drainCopyTask` (o terminal `failed` carrega
 *     `copy_payload.recovery` — classificação/espera server-side, FONTE ÚNICA em
 *     `copy-state.ts`).
 *
 * Escopo RESTRITO (B2A-D5): NÃO importa nem chama crédito/artefato; a arte
 * `delivered` permanece intocada. O custo interno é REGISTRADO pela telemetria
 * existente do runner — NUNCA vira crédito do lojista.
 *
 * Envelope FECHADO (fail-closed): resposta ausente/contraditória nunca vira
 * sucesso; os códigos/desfechos conhecidos são enumerados. NÃO existe
 * `operation_terminal` (os terminais FINANCEIRO × copy são SEPARADOS).
 */

// ── Envelope FECHADO (códigos/desfechos conhecidos) ─────────────────────────

export type CopyRecoveryErrorCode =
  | "missing_request_token"
  | "attempt_in_progress"
  | "attempt_already_completed"
  | "wait_not_elapsed"
  | "attempt_limit_reached"
  | "already_acquired"
  | "automatic_closed"
  | "stale_attempt"
  | "invalid_content"
  | "missing_attempt_identity"
  | "invalid_attempt_seq"
  | "idempotent"
  | "conflict"
  | "rejected"
  | "unknown";

/** Conjunto FECHADO de códigos/desfechos conhecidos (sem `operation_terminal`). */
export const KNOWN_COPY_RECOVERY_CODES: readonly CopyRecoveryErrorCode[] = Object.freeze([
  "missing_request_token",
  "attempt_in_progress",
  "attempt_already_completed",
  "wait_not_elapsed",
  "attempt_limit_reached",
  "already_acquired",
  "automatic_closed",
  "stale_attempt",
  "invalid_content",
  "missing_attempt_identity",
  "invalid_attempt_seq",
  "idempotent",
  "conflict",
  "rejected",
]);

export class ProductOneToOneCopyRecoveryError extends Error {
  constructor(
    readonly code: CopyRecoveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProductOneToOneCopyRecoveryError";
  }
}

/** Mapeia uma mensagem de erro ao código FECHADO conhecido (senão `unknown`). */
export function mapCopyRecoveryError(
  message: string | undefined | null,
): ProductOneToOneCopyRecoveryError {
  const text = message ?? "";
  for (const code of KNOWN_COPY_RECOVERY_CODES) {
    if (text.includes(code)) return new ProductOneToOneCopyRecoveryError(code, text);
  }
  return new ProductOneToOneCopyRecoveryError("unknown", text || "unknown_error");
}

/** Valida que a resposta da RPC é um objeto; ausente/vazio ⇒ `empty_rpc_response`. */
export function asRecord(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ProductOneToOneCopyRecoveryError("unknown", "empty_rpc_response");
  }
  return data as Record<string, unknown>;
}

// ── Modo de acionamento ─────────────────────────────────────────────────────

export type CopyRecoveryMode = CopyAcquisitionMode; // "auto" | "manual"

/** Modo de SOLICITAÇÃO aceito pelo schema (`auto_retry`) → modo interno (`auto`). */
export function toAcquisitionMode(mode: "auto_retry" | "manual"): CopyRecoveryMode {
  return mode === "manual" ? "manual" : "auto";
}

// ── Query-only (verbatim) do estado persistido ──────────────────────────────

export interface CopyRecoveryStateView {
  readonly attemptSeq: number;
  readonly state: CopyState | null;
  readonly attemptActive: boolean;
  readonly waitRemainingMs: number;
  readonly autoAttempts: number;
  readonly manualAttempts: number;
  readonly definitive: boolean;
  readonly copyDelivery: CopyDeliveryRecord | null;
}

// ── Resultado do acionamento ────────────────────────────────────────────────

export type CopyRecoveryOutcome =
  | "acquired_completed"
  | "acquired_failed"
  | "acquired_unconfirmed"
  | "accompanied";

export interface CopyRecoveryResult {
  readonly outcome: CopyRecoveryOutcome;
  readonly acquired: boolean;
  readonly mode: CopyRecoveryMode;
  readonly attemptSeq: number | null;
  readonly attemptToken: string | null;
  /** Motivo de recusa da aquisição (`null` quando o vencedor foi obtido). */
  readonly reason: CopyAcquisitionReason | null;
  readonly waitRemainingMs: number | null;
  readonly state: CopyRecoveryStateView;
}

export interface RecoverCopyAttemptInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly mode: CopyRecoveryMode;
  /** Identidade do ACIONAMENTO (OBRIGATÓRIA) — dedupe; ausente ⇒ recusa. */
  readonly requestToken: string | undefined | null;
  /** Runner input resolvido SERVER-SIDE (briefing/contexto/pricing) pela rota. */
  readonly runner: DefaultProductOneToOneCopyRunnerInput;
  readonly runnerDeps?: DefaultProductOneToOneCopyRunnerDeps;
}

function readRecoveryFailureClass(
  copyPayload: Record<string, unknown> | null,
): string | null {
  if (copyPayload === null || typeof copyPayload !== "object") return null;
  const recovery = (copyPayload as Record<string, unknown>).recovery;
  if (recovery === null || typeof recovery !== "object") return null;
  const failureClass = (recovery as Record<string, unknown>).failureClass;
  return typeof failureClass === "string" ? failureClass : null;
}

/**
 * Correção pós-revisão (2026-10-14) — classificador PURO da falha da copy.
 *
 * O dreno classificava via `isRetryableError` (erros de DOMÍNIO de copy
 * apenas). O gateway NORMALIZA a falha do provider num `AiInvocationError`
 * (network/timeout/transiente) que carrega o campo `retryable` decidido UMA vez
 * na normalização — e que `isRetryableError` NÃO reconhece (não é um erro de
 * domínio de copy). Sem este classificador, uma falha transitória do gateway
 * era lida como DEFINITIVA e o ciclo automático era encerrado indevidamente.
 *
 * Regra: quando o erro expõe um campo `retryable` BOOLEAN (contrato normalizado
 * do gateway — duck-typing, sem importar o interno do gateway só para
 * `instanceof`), a decisão é `retryable ? "transient" : "definitive"`. Fora
 * disso, cai na classificação de DOMÍNIO existente (`isRetryableError`) — a
 * fronteira dos erros de parsing/domínio de copy permanece INTACTA.
 *
 * É OPCIONAL no dreno: o default do `copy-state.ts` (Plano 01) permanece
 * inalterado; o serviço/orquestrador passam EXPLICITAMENTE este classificador.
 */
export function classifyCopyFailure(error: unknown): CopyFailureClass {
  const retryable =
    error !== null && typeof error === "object"
      ? (error as { retryable?: unknown }).retryable
      : undefined;
  if (typeof retryable === "boolean") {
    return retryable ? "transient" : "definitive";
  }
  return isRetryableError(error) ? "transient" : "definitive";
}

export class ProductOneToOneCopyRecoveryClient {
  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    private readonly acquisition: ProductOneToOneCopyAcquisitionClient = new ProductOneToOneCopyAcquisitionClient(
      client,
    ),
  ) {}

  /**
   * Query-only: devolve o estado persistido VERBATIM (tentativa de maior
   * `attempt_seq`, `attemptActive` por LEASE, `waitRemainingMs`, contadores
   * auto/manual, `definitive`) + o texto/payload entregues. SEM mutação —
   * espelha `resend-query.ts`.
   */
  async readCopyRecoveryState(input: {
    readonly campaignId: string;
    readonly operationId: string;
    readonly nowMs?: number;
  }): Promise<CopyRecoveryStateView> {
    const summary = await readCopyRecoverySummary(this.client, input);
    const copyDelivery = await readCopyDelivery(this.client, {
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    return Object.freeze({ ...summary, copyDelivery });
  }

  /**
   * Executa UMA tentativa identificada por acionamento (vencedor) ou apenas
   * ACOMPANHA (perdedor). O `requestToken` OBRIGATÓRIO é exigido ANTES de
   * qualquer aquisição/provider.
   */
  async recoverCopyAttempt(input: RecoverCopyAttemptInput): Promise<CopyRecoveryResult> {
    const requestToken = input.requestToken;
    if (typeof requestToken !== "string" || requestToken.length === 0) {
      throw new ProductOneToOneCopyRecoveryError(
        "missing_request_token",
        "missing_request_token",
      );
    }

    // Gate B2A-D1 — copy `completed` COM conteúdo entregável ENCERRA.
    const before = await this.readCopyRecoveryState({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    if (before.state === "completed" && (before.copyDelivery?.copyText ?? "").length > 0) {
      return {
        outcome: "accompanied",
        acquired: false,
        mode: input.mode,
        attemptSeq: before.attemptSeq,
        attemptToken: null,
        reason: "attempt_already_completed",
        waitRemainingMs: null,
        state: before,
      };
    }

    let acquired: CopyAcquisitionResult;
    try {
      acquired = await this.acquisition.acquire({
        campaignId: input.campaignId,
        operationId: input.operationId,
        mode: input.mode,
        requestToken,
      });
    } catch (error) {
      if (error instanceof ProductOneToOneCopyAcquisitionError) {
        throw mapCopyRecoveryError(error.message);
      }
      throw error;
    }

    if (!acquired.acquired) {
      // PERDEDOR — apenas ACOMPANHA (ZERO chamadas ao provider), devolvendo o
      // estado corrente + `waitRemainingMs`/identidade existente quando aplicável.
      return {
        outcome: "accompanied",
        acquired: false,
        mode: input.mode,
        attemptSeq: acquired.attemptSeq ?? before.attemptSeq,
        attemptToken: acquired.attemptToken ?? null,
        reason: acquired.reason,
        waitRemainingMs: acquired.waitRemainingMs ?? null,
        state: await this.readCopyRecoveryState({
          campaignId: input.campaignId,
          operationId: input.operationId,
        }),
      };
    }

    // VENCEDOR — UMA chamada ao provider por tentativa, alvo explícito server-side.
    const target = await this.resolveTarget(input, acquired.attemptSeq);
    const runner = createDefaultProductOneToOneCopyOps(input.runner, {
      ...(input.runnerDeps ?? {}),
      target,
    });

    const store: CopyStateStore = {
      recordCopyState: (record) => recordCopyState(this.client, record),
      recordCancellation: (record) => recordCancellation(this.client, record),
    };
    const budget = createCopyBudgetSignal(COPY_BUDGET_MS);
    let drain: Awaited<ReturnType<typeof drainCopyTask>>;
    try {
      drain = await drainCopyTask(
        {
          campaignId: input.campaignId,
          operationId: input.operationId,
          attemptSeq: acquired.attemptSeq,
          attemptToken: acquired.attemptToken,
          recoveryKind: input.mode,
          signal: budget.signal,
          // Correção pós-revisão (2026-10-14) — classifica a falha NORMALIZADA do
          // gateway (`AiInvocationError.retryable`) além dos erros de domínio de
          // copy; sem isto, uma falha transitória do gateway era lida como
          // definitiva e encerrava o ciclo automático indevidamente.
          classifyFailure: classifyCopyFailure,
          run: ({ signal, commit }) =>
            runner.runCopy({ campaignId: input.campaignId, operationId: input.operationId, signal, commit }),
        },
        store,
      );
    } finally {
      budget.dispose();
    }

    const outcome: CopyRecoveryOutcome =
      drain.state === "completed"
        ? "acquired_completed"
        : drain.state === "failed"
          ? "acquired_failed"
          : "acquired_unconfirmed";

    return {
      outcome,
      acquired: true,
      mode: input.mode,
      attemptSeq: acquired.attemptSeq,
      attemptToken: acquired.attemptToken,
      reason: null,
      waitRemainingMs: null,
      state: await this.readCopyRecoveryState({
        campaignId: input.campaignId,
        operationId: input.operationId,
      }),
    };
  }

  /**
   * Alvo EXPLÍCITO desta tentativa (SERVER-SIDE): `primary` na 1ª; `fallback`
   * quando a tentativa ANTERIOR falhou TRANSITÓRIA (fallback = TENTATIVA
   * SEGUINTE, nunca uma segunda chamada dentro do mesmo acionamento).
   */
  private async resolveTarget(
    input: RecoverCopyAttemptInput,
    attemptSeq: number,
  ): Promise<"primary" | "fallback"> {
    if (attemptSeq <= 1) return "primary";
    const attempts = await readCopyAttempts(this.client, {
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    const previous = attempts.find((attempt) => attempt.attemptSeq === attemptSeq - 1);
    return readRecoveryFailureClass(previous?.copyPayload ?? null) === "transient"
      ? "fallback"
      : "primary";
  }
}
