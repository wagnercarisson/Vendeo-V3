import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Cliente fino (server-only) da AQUISIÇÃO ATÔMICA da tentativa de copy do
 * Produto 1:1 (B2.1 / Plano 06).
 *
 * O cliente APENAS invoca a RPC — a trava estável compartilhada por operação
 * (advisory → C4 → copy_state), os limites (3 auto + 3 manual = 6), a espera, a
 * dedupe do MESMO acionamento e a transição de `mode` vivem no Postgres, nunca
 * aqui. O VENCEDOR é quem recebe `acquired: true` (com o `attempt_token` gerado
 * SERVER-SIDE); o PERDEDOR (`acquired: false`, com qualquer motivo) APENAS
 * ACOMPANHA e NÃO deve iniciar chamada ao provider.
 *
 * Envelope FECHADO (fail-closed): o cliente NUNCA aceita sucesso implícito.
 * `{acquired:true}` exige `attempt_seq` (1..6), `attempt_token` não-vazio, `mode`
 * presente e igual ao solicitado (∈ {auto,manual}) e `reason` ausente/NULL (um
 * `reason` não-nulo CONTRADIZ um vencedor); código de recusa desconhecido/ausente
 * NUNCA é vencedor. TERMINAIS SEPARADOS:
 * NÃO há `operation_terminal` — o terminal FINANCEIRO (`delivered`/`refunded`)
 * não encerra a recuperação de textos; só a copy `completed` encerra.
 */

export const ACQUIRE_COPY_ATTEMPT_RPC = "product_1_1_acquire_copy_attempt" as const;

export type CopyAcquisitionMode = "auto" | "manual";

/** Motivos de RECUSA devolvidos pela RPC (terminais financeiro × copy SEPARADOS). */
export type CopyAcquisitionReason =
  | "attempt_in_progress"
  | "attempt_already_completed"
  | "wait_not_elapsed"
  | "attempt_limit_reached"
  | "already_acquired"
  | "automatic_closed";

export type CopyAcquisitionResult =
  | {
      readonly acquired: true;
      readonly attemptSeq: number;
      readonly attemptToken: string;
      readonly mode: CopyAcquisitionMode;
      readonly expiredClosed?: boolean;
    }
  | {
      readonly acquired: false;
      readonly reason: CopyAcquisitionReason;
      readonly attemptSeq?: number;
      readonly attemptToken?: string;
      readonly waitRemainingMs?: number;
    };

export interface AcquireCopyAttemptInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly mode: CopyAcquisitionMode;
  readonly requestToken?: string;
}

const KNOWN_REASONS: readonly CopyAcquisitionReason[] = [
  "attempt_in_progress",
  "attempt_already_completed",
  "wait_not_elapsed",
  "attempt_limit_reached",
  "already_acquired",
  "automatic_closed",
];

const KNOWN_ERROR_CODES = [
  "missing_campaign_id",
  "missing_operation_id",
  "invalid_mode",
] as const;

type CopyAcquisitionErrorCode = (typeof KNOWN_ERROR_CODES)[number] | "unknown";

export class ProductOneToOneCopyAcquisitionError extends Error {
  constructor(
    readonly code: CopyAcquisitionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProductOneToOneCopyAcquisitionError";
  }
}

function mapError(
  message: string | undefined | null,
): ProductOneToOneCopyAcquisitionError {
  const text = message ?? "";
  for (const code of KNOWN_ERROR_CODES) {
    if (text.includes(code)) return new ProductOneToOneCopyAcquisitionError(code, text);
  }
  return new ProductOneToOneCopyAcquisitionError("unknown", text || "unknown_error");
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ProductOneToOneCopyAcquisitionError("unknown", "empty_rpc_response");
  }
  return data as Record<string, unknown>;
}

function mapAcquire(
  data: unknown,
  input: AcquireCopyAttemptInput,
): CopyAcquisitionResult {
  const record = asRecord(data);
  const acquired = record.acquired;
  if (typeof acquired !== "boolean") {
    throw new ProductOneToOneCopyAcquisitionError(
      "unknown",
      "copy_acquisition_invalid_envelope",
    );
  }

  if (acquired) {
    // Envelope FECHADO: o vencedor EXIGE `attempt_seq` (1..6), `attempt_token`
    // não-vazio, `mode` PRESENTE/validado (∈ {auto,manual} e igual ao solicitado)
    // e `reason` ausente/NULL. Contradição/ausência ⇒ LANÇA (NUNCA vencedor
    // implícito): um `reason` não-nulo contradiz um vencedor.
    const attemptSeq = Number(record.attempt_seq);
    const attemptToken = record.attempt_token;
    const rawMode = record.mode;
    const reason = record.reason;
    const modeValid = rawMode === "auto" || rawMode === "manual";
    if (
      !Number.isInteger(attemptSeq) ||
      attemptSeq < 1 ||
      attemptSeq > 6 ||
      typeof attemptToken !== "string" ||
      attemptToken.length === 0 ||
      !(reason === undefined || reason === null) ||
      !modeValid ||
      rawMode !== input.mode
    ) {
      throw new ProductOneToOneCopyAcquisitionError(
        "unknown",
        "copy_acquisition_invalid_envelope",
      );
    }
    return Object.freeze({
      acquired: true,
      attemptSeq,
      attemptToken,
      // O servidor só adquire com o `mode` solicitado; o retorno é o `mode`
      // validado (presente no envelope e igual à solicitação).
      mode: rawMode as CopyAcquisitionMode,
      expiredClosed: record.expired_closed === true,
    });
  }

  const reason = record.reason;
  if (
    typeof reason !== "string" ||
    !KNOWN_REASONS.includes(reason as CopyAcquisitionReason)
  ) {
    throw new ProductOneToOneCopyAcquisitionError(
      "unknown",
      "copy_acquisition_invalid_envelope",
    );
  }

  const result: {
    acquired: false;
    reason: CopyAcquisitionReason;
    attemptSeq?: number;
    attemptToken?: string;
    waitRemainingMs?: number;
  } = { acquired: false, reason: reason as CopyAcquisitionReason };

  if (reason === "already_acquired") {
    // Dedupe do MESMO acionamento: a identidade EXISTENTE é OBRIGATÓRIA
    // (`attempt_seq` 1..6 + `attempt_token` não-vazio); ausência/invalidade ⇒
    // envelope fechado (NUNCA omite silenciosamente).
    const seq = Number(record.attempt_seq);
    const token = record.attempt_token;
    if (
      !Number.isInteger(seq) ||
      seq < 1 ||
      seq > 6 ||
      typeof token !== "string" ||
      token.length === 0
    ) {
      throw new ProductOneToOneCopyAcquisitionError(
        "unknown",
        "copy_acquisition_invalid_envelope",
      );
    }
    result.attemptSeq = seq;
    result.attemptToken = token;
  }
  if (reason === "wait_not_elapsed") {
    // A espera restante é OBRIGATÓRIA: número finito ≥ 0; ausência/invalidade ⇒
    // envelope fechado.
    const wait = Number(record.wait_remaining_ms);
    if (!Number.isFinite(wait) || wait < 0) {
      throw new ProductOneToOneCopyAcquisitionError(
        "unknown",
        "copy_acquisition_invalid_envelope",
      );
    }
    result.waitRemainingMs = wait;
  }

  return Object.freeze(result);
}

export class ProductOneToOneCopyAcquisitionClient {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  /** Adquire (ou perde) a tentativa. O PERDEDOR NÃO lança — apenas acompanha. */
  async acquire(input: AcquireCopyAttemptInput): Promise<CopyAcquisitionResult> {
    const { data, error } = await this.client.rpc(ACQUIRE_COPY_ATTEMPT_RPC, {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_mode: input.mode,
      p_request_token: input.requestToken ?? null,
    });
    if (error) throw mapError(error.message);
    return mapAcquire(data, input);
  }
}
