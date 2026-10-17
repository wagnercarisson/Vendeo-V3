import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * F56.2b2c (B2.3) — Repositório RPC-only do controle de gasto do piloto.
 *
 * Escrita SOMENTE pelas RPCs `SECURITY DEFINER` da migration
 * `20261017000002_f56_2b2c_pilot_spend_control.sql`; nenhuma escrita direta.
 * O client é INJETÁVEL (testes usam um fake).
 */

export type PilotPaidCallKind =
  | "image_primary"
  | "image_retry"
  | "image_fallback"
  | "copy_initial"
  | "copy_auto"
  | "copy_manual";

export interface PilotBeginPaidCallInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly callId: string;
  readonly kind: PilotPaidCallKind;
  readonly attemptSeq: number;
  readonly estimatedUsd: number;
  readonly ownerToken: string;
}

export interface PilotSpendRepositoryPort {
  setCap(input: {
    actorId: string;
    capUsd: number;
    reason: string;
    operationId: string;
  }): Promise<Record<string, unknown>>;
  beginPaidCall(input: PilotBeginPaidCallInput): Promise<Record<string, unknown>>;
  endPaidCall(input: {
    callId: string;
    ownerToken: string;
    actualEstimatedUsd: number | null;
  }): Promise<Record<string, unknown>>;
  markUnknown(input: {
    callId: string;
    ownerToken: string;
    reason: string;
  }): Promise<Record<string, unknown>>;
  blockGlobal(input: { callId: string; reason: string }): Promise<Record<string, unknown>>;
  reconcileUnknown(input: {
    actorId: string;
    callId: string;
    decision: string;
    reason: string;
    operationId: string;
  }): Promise<Record<string, unknown>>;
}

export class SupabasePilotSpendRepository implements PilotSpendRepositoryPort {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  private async rpc(
    fn: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.rpc(fn, params);
    if (error) {
      // Repassa a MENSAGEM da RPC para o serviço classificar (códigos fechados).
      throw new Error(error.message ?? "pilot_spend_rpc_error");
    }
    return (data ?? {}) as Record<string, unknown>;
  }

  setCap(input: {
    actorId: string;
    capUsd: number;
    reason: string;
    operationId: string;
  }): Promise<Record<string, unknown>> {
    return this.rpc("product_1_1_pilot_set_cap", {
      p_actor_id: input.actorId,
      p_cap_usd: input.capUsd,
      p_reason: input.reason,
      p_operation_id: input.operationId,
    });
  }

  beginPaidCall(input: PilotBeginPaidCallInput): Promise<Record<string, unknown>> {
    return this.rpc("product_1_1_pilot_begin_paid_call", {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_call_id: input.callId,
      p_kind: input.kind,
      p_attempt_seq: input.attemptSeq,
      p_estimated_usd: input.estimatedUsd,
      p_owner_token: input.ownerToken,
    });
  }

  endPaidCall(input: {
    callId: string;
    ownerToken: string;
    actualEstimatedUsd: number | null;
  }): Promise<Record<string, unknown>> {
    return this.rpc("product_1_1_pilot_end_paid_call", {
      p_call_id: input.callId,
      p_owner_token: input.ownerToken,
      p_actual_estimated_usd: input.actualEstimatedUsd,
    });
  }

  markUnknown(input: {
    callId: string;
    ownerToken: string;
    reason: string;
  }): Promise<Record<string, unknown>> {
    return this.rpc("product_1_1_pilot_mark_unknown", {
      p_call_id: input.callId,
      p_owner_token: input.ownerToken,
      p_reason: input.reason,
    });
  }

  blockGlobal(input: { callId: string; reason: string }): Promise<Record<string, unknown>> {
    return this.rpc("product_1_1_pilot_block_global", {
      p_call_id: input.callId,
      p_reason: input.reason,
    });
  }

  reconcileUnknown(input: {
    actorId: string;
    callId: string;
    decision: string;
    reason: string;
    operationId: string;
  }): Promise<Record<string, unknown>> {
    return this.rpc("product_1_1_pilot_reconcile_unknown", {
      p_actor_id: input.actorId,
      p_call_id: input.callId,
      p_decision: input.decision,
      p_reason: input.reason,
      p_operation_id: input.operationId,
    });
  }
}
