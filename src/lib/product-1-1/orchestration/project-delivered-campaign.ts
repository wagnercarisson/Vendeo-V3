import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { artifactStoragePath } from "../artifact/artifact-path";

/**
 * Quick 261017-cdi — Projeção da campanha após ENTREGA CONFIRMADA (Produto 1:1).
 *
 * A listagem (`listCampaigns`) filtra `status ∈ ('ready','error')`. O novo fluxo
 * nunca transicionava `campaigns.status` (permanecia `generating`) nem registrava
 * o caminho real da arte, então as campanhas entregues NÃO apareciam na lista.
 *
 * Este helper centraliza (idempotente) a atualização da PROJEÇÃO da campanha:
 *   `campaigns.status = 'ready'`, `error_message = NULL`,
 *   `storage_path = <arte real do novo fluxo>`.
 *
 * Garantias:
 *  - Só age quando a OPERAÇÃO está PERSISTIDA como `delivered` (nunca
 *    `reserved`/`art_uploaded`/`refunded`/ausente).
 *  - Exige vínculo correto loja ↔ campanha ↔ operação ↔ arte (metadado
 *    persistido em `product_1_1_campaign_artifacts`).
 *  - NUNCA lança: qualquer falha vira resultado tipado. Uma falha de projeção
 *    NÃO pode provocar nova chamada ao provider, estorno, nem reclassificar uma
 *    entrega confirmada como falha — e permite REPARO idempotente (repetir é
 *    seguro).
 *  - NÃO toca aprovação comercial (`approval_status`) nem créditos/auditoria.
 */

const CREDIT_OPS_TABLE = "product_1_1_campaign_credit_operations";
const ARTIFACT_TABLE = "product_1_1_campaign_artifacts";

export type ProjectDeliveredCampaignReason =
  | "projected"
  | "already_projected"
  | "operation_not_delivered"
  | "campaign_not_found"
  | "store_mismatch"
  | "artifact_missing"
  | "projection_update_failed";

export interface ProjectDeliveredCampaignResult {
  readonly projected: boolean;
  readonly reason: ProjectDeliveredCampaignReason;
}

export interface ProjectDeliveredCampaignInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
}

export interface ProjectDeliveredCampaignDeps {
  readonly client?: SupabaseClient;
  readonly log?: (message: string, detail?: Record<string, unknown>) => void;
}

export async function projectDeliveredCampaign(
  input: ProjectDeliveredCampaignInput,
  deps: ProjectDeliveredCampaignDeps = {},
): Promise<ProjectDeliveredCampaignResult> {
  const client =
    deps.client ?? (await import("@/lib/supabase/server")).supabaseAdmin;
  const log =
    deps.log ??
    ((message, detail) => console.warn(message, detail ?? {}));

  try {
    // (1) Operação PERSISTIDA como `delivered` (nunca inconclusiva/estornada/upload).
    const { data: op, error: opError } = await client
      .from(CREDIT_OPS_TABLE)
      .select("status, campaign_id, operation_id")
      .eq("campaign_id", input.campaignId)
      .eq("operation_id", input.operationId)
      .maybeSingle();
    if (opError) {
      return { projected: false, reason: "operation_not_delivered" };
    }
    const opRecord = op as
      | { status?: unknown; campaign_id?: unknown; operation_id?: unknown }
      | null;
    if (
      !opRecord ||
      opRecord.status !== "delivered" ||
      opRecord.campaign_id !== input.campaignId ||
      opRecord.operation_id !== input.operationId
    ) {
      return { projected: false, reason: "operation_not_delivered" };
    }

    // (2) Campanha existe e pertence à MESMA loja (vínculo correto).
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("store_id, status, storage_path, error_message")
      .eq("id", input.campaignId)
      .maybeSingle();
    if (campaignError) {
      return { projected: false, reason: "projection_update_failed" };
    }
    const campaignRecord = campaign as
      | {
          store_id?: unknown;
          status?: unknown;
          storage_path?: unknown;
          error_message?: unknown;
        }
      | null;
    if (!campaignRecord) {
      return { projected: false, reason: "campaign_not_found" };
    }
    if (campaignRecord.store_id !== input.storeId) {
      return { projected: false, reason: "store_mismatch" };
    }

    // (3) A ARTE precisa existir e bater com o caminho determinístico do novo
    //     fluxo (nunca marca `ready` sem arte persistida).
    const expectedArtifactPath = artifactStoragePath(
      input.storeId,
      input.campaignId,
      input.operationId,
    );
    const { data: artifact, error: artifactError } = await client
      .from(ARTIFACT_TABLE)
      .select("storage_path, campaign_id, operation_id")
      .eq("campaign_id", input.campaignId)
      .eq("operation_id", input.operationId)
      .maybeSingle();
    if (artifactError) {
      return { projected: false, reason: "artifact_missing" };
    }
    const artifactRecord = artifact as
      | { storage_path?: unknown; campaign_id?: unknown; operation_id?: unknown }
      | null;
    if (
      !artifactRecord ||
      artifactRecord.storage_path !== expectedArtifactPath ||
      artifactRecord.campaign_id !== input.campaignId ||
      artifactRecord.operation_id !== input.operationId
    ) {
      return { projected: false, reason: "artifact_missing" };
    }

    // (4) Idempotência: já projetada corretamente ⇒ no-op (reparo seguro).
    if (
      campaignRecord.status === "ready" &&
      campaignRecord.storage_path === expectedArtifactPath &&
      campaignRecord.error_message === null
    ) {
      return { projected: true, reason: "already_projected" };
    }

    // (5) Atualização da projeção — NUNCA toca `approval_status`.
    const { error: updateError } = await client
      .from("campaigns")
      .update({
        status: "ready",
        error_message: null,
        storage_path: expectedArtifactPath,
      })
      .eq("id", input.campaignId)
      .eq("store_id", input.storeId);
    if (updateError) {
      log("[project-delivered-campaign] projection update failed", {
        campaignId: input.campaignId,
        operationId: input.operationId,
        error: updateError.message,
      });
      return { projected: false, reason: "projection_update_failed" };
    }

    return { projected: true, reason: "projected" };
  } catch (error) {
    log("[project-delivered-campaign] unexpected error", {
      campaignId: input.campaignId,
      operationId: input.operationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { projected: false, reason: "projection_update_failed" };
  }
}
