import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quick 261018-enc — Projeção da campanha após ENCERRAMENTO CONFIRMADO com
 * estorno (Produto 1:1).
 *
 * A entrega confirmada é projetada por `projectDeliveredCampaign` (operação
 * `delivered` ⇒ `campaigns.status='ready'`). Os encerramentos com estorno
 * (`product_1_1_campaign_credit_operations.status='refunded'`) NÃO tinham
 * projeção: a campanha permanecia `status='generating'` e desaparecia do
 * histórico (`listCampaigns` filtra `ready,error`). Este helper irmão centraliza
 * (idempotente) a projeção do ENCERRAMENTO.
 *
 * Garantias:
 *  - Só age quando a OPERAÇÃO está PERSISTIDA como `refunded` (nunca
 *    `reserved`/`art_uploaded`/`delivered`/ausente) e o vínculo
 *    loja ↔ campanha ↔ operação confere.
 *  - NUNCA sobrescreve uma entrega confirmada (`status='ready'`): um evento
 *    atrasado de encerramento NÃO reverte `ready` para `error`. A escrita é
 *    CONDICIONAL (`status <> 'ready'`) e atômica (uma instrução).
 *  - NUNCA lança: qualquer falha vira resultado tipado.
 *  - NUNCA troca o motivo exibido em replays: se a campanha JÁ está `error`, a
 *    projeção válida é PRESERVADA (`already_projected`) — `processing`/
 *    `publication_state` são transitórios e o motivo só é gravado na PRIMEIRA
 *    projeção.
 *  - NÃO toca aprovação (`approval_status`), créditos, auditoria, snapshots,
 *    `storage_path`, publicação, nem dispara provider/retry/estorno.
 */

const CREDIT_OPS_TABLE = "product_1_1_campaign_credit_operations";
const CAMPAIGNS_TABLE = "campaigns";

/** Motivo do encerramento (best-effort; ausente ⇒ neutro). */
export type ProjectClosedReason =
  | "confirmed_failure"
  | "authorized_abandon"
  | "publication_closure"
  | "closed_neutral";

/** Mensagem persistida em `error_message` por motivo (nunca “falha técnica” para abandono administrativo). */
export const CLOSED_CAMPAIGN_MESSAGES: Record<ProjectClosedReason, string> = {
  confirmed_failure:
    "A geração não foi concluída e o crédito foi estornado.",
  authorized_abandon:
    "Esta geração foi encerrada administrativamente e o crédito foi estornado.",
  publication_closure:
    "A publicação não pôde ser confirmada; a operação foi encerrada e o crédito foi estornado.",
  closed_neutral:
    "Esta geração foi encerrada e o crédito foi estornado.",
};

export type ProjectClosedCampaignReason =
  | "projected"
  | "already_projected"
  | "delivery_preserved"
  | "projection_not_applied"
  | "operation_not_closed"
  | "campaign_not_found"
  | "store_mismatch"
  | "projection_update_failed";

export interface ProjectClosedCampaignResult {
  readonly projected: boolean;
  readonly reason: ProjectClosedCampaignReason;
}

export interface ProjectClosedCampaignInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  /** Motivo do encerramento; ausente ⇒ `closed_neutral` (não comprovado). */
  readonly reason?: ProjectClosedReason;
}

export interface ProjectClosedCampaignDeps {
  readonly client?: SupabaseClient;
  readonly log?: (message: string, detail?: Record<string, unknown>) => void;
}

export async function projectClosedCampaign(
  input: ProjectClosedCampaignInput,
  deps: ProjectClosedCampaignDeps = {},
): Promise<ProjectClosedCampaignResult> {
  const client =
    deps.client ?? (await import("@/lib/supabase/server")).supabaseAdmin;
  const log =
    deps.log ??
    ((message, detail) => console.warn(message, detail ?? {}));
  const reason: ProjectClosedReason = input.reason ?? "closed_neutral";
  const message =
    CLOSED_CAMPAIGN_MESSAGES[reason] ?? CLOSED_CAMPAIGN_MESSAGES.closed_neutral;

  try {
    // (1) Operação PERSISTIDA como `refunded` (nunca inconclusiva/entrega).
    const { data: op, error: opError } = await client
      .from(CREDIT_OPS_TABLE)
      .select("status, campaign_id, operation_id")
      .eq("campaign_id", input.campaignId)
      .eq("operation_id", input.operationId)
      .maybeSingle();
    if (opError) {
      return { projected: false, reason: "operation_not_closed" };
    }
    const opRecord = op as
      | { status?: unknown; campaign_id?: unknown; operation_id?: unknown }
      | null;
    if (
      !opRecord ||
      opRecord.status !== "refunded" ||
      opRecord.campaign_id !== input.campaignId ||
      opRecord.operation_id !== input.operationId
    ) {
      return { projected: false, reason: "operation_not_closed" };
    }

    // (2) Campanha existe e pertence à MESMA loja (vínculo correto).
    const { data: campaign, error: campaignError } = await client
      .from(CAMPAIGNS_TABLE)
      .select("store_id, status")
      .eq("id", input.campaignId)
      .maybeSingle();
    if (campaignError) {
      return { projected: false, reason: "projection_update_failed" };
    }
    const campaignRecord = campaign as
      | { store_id?: unknown; status?: unknown }
      | null;
    if (!campaignRecord) {
      return { projected: false, reason: "campaign_not_found" };
    }
    if (campaignRecord.store_id !== input.storeId) {
      return { projected: false, reason: "store_mismatch" };
    }

    // (3) Entrega CONFIRMADA: NUNCA sobrescrever `ready` (evento atrasado).
    if (campaignRecord.status === "ready") {
      return { projected: false, reason: "delivery_preserved" };
    }

    // (4) Projeção VÁLIDA anterior: PRESERVAR (não recalcular o motivo).
    if (campaignRecord.status === "error") {
      return { projected: true, reason: "already_projected" };
    }

    // (5) Atualização CONDICIONAL — projeta SOMENTE a partir de `generating`,
    // preservando `ready` (entrega confirmada) E um `error` JÁ gravado (outra
    // chamada concorrente). Nunca reverte `ready`/`error` para uma nova mensagem.
    const { data: updated, error: updateError } = await client
      .from(CAMPAIGNS_TABLE)
      .update({ status: "error", error_message: message })
      .eq("id", input.campaignId)
      .eq("store_id", input.storeId)
      .eq("status", "generating")
      .select("id");
    if (updateError) {
      log("[project-closed-campaign] projection update failed", {
        campaignId: input.campaignId,
        operationId: input.operationId,
        error: updateError.message,
      });
      return { projected: false, reason: "projection_update_failed" };
    }

    // (6) Nenhuma linha atualizada ⇒ distinguir entrega preservada de no-op.
    if (!updated || updated.length === 0) {
      const { data: after } = await client
        .from(CAMPAIGNS_TABLE)
        .select("status")
        .eq("id", input.campaignId)
        .maybeSingle();
      const afterRecord = after as { status?: unknown } | null;
      if (afterRecord?.status === "ready") {
        return { projected: false, reason: "delivery_preserved" };
      }
      if (afterRecord?.status === "error") {
        return { projected: true, reason: "already_projected" };
      }
      return { projected: false, reason: "projection_not_applied" };
    }

    return { projected: true, reason: "projected" };
  } catch (error) {
    log("[project-closed-campaign] unexpected error", {
      campaignId: input.campaignId,
      operationId: input.operationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { projected: false, reason: "projection_update_failed" };
  }
}
