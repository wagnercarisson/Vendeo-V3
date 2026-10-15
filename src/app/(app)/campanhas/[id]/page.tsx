import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listArtVersions } from "@/lib/campaign/persistence";
import { classifyCampaignFlow } from "@/lib/campaign/new-flow-marker";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { supabaseAdmin } from "@/lib/supabase/server";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import { getCorrectionReport } from "@/lib/campaign/correction-reports";
import {
  getCampaignForDisplay,
  generateSignedPreviewUrl,
  mapCampaignToProps,
  computeApprovalState,
  getActiveCandidateArtVersion,
  mapNewFlowDisplayState,
  mapNewFlowCopy,
  mapNewFlowCopyRecovery,
  mapRestoredForm,
} from "@/lib/campaign/display";
import type {
  CampaignFormRestore,
  NewFlowCopyRecoveryRecord,
  NewFlowCopyRecoveryView,
} from "@/lib/campaign/display";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { ProductOneToOneArtifactStore } from "@/lib/product-1-1/artifact/artifact-store";
import {
  readCopyDelivery,
  readCopyCancellation,
  readCopyRecoverySummary,
} from "@/lib/product-1-1/copy/copy-state";
import CampaignPageClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

// F37.2 (R7): teto de staleness do consumo = timeout global de geração + 30s.
const CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000;

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  const user = await requirePageUser();

  const store = await getCurrentStore(user.userId);
  if (!store) {
    notFound();
  }

  let campaign = await getCampaignForDisplay(id);
  if (!campaign) {
    notFound();
  }

  let props = mapCampaignToProps(campaign, id);

  // F56.2b1b (Plano 06, B1B-D7 / C1 / I2 / E1) — campanha do NOVO fluxo: o
  // estado exibido deriva da OPERAÇÃO PERSISTIDA (`getCampaignOperation`), NUNCA
  // de `campaign.status`. A leitura só REFLETE o estado persistido — não retoma
  // nem controla processamento. `delivered`/`refunded` (terminal) PREVALECEM
  // sobre o marcador histórico `unknown`; `unknown` só governa operação não
  // terminal. Campanhas legadas (operação `null`) seguem no caminho atual
  // byte-compatível (aprovação F37 + `computeDisplayStatus`).
  const loadNewFlowOperation = async () => {
    try {
      return await new ProductOneToOneAttemptStartClient().getCampaignOperation(id);
    } catch {
      // Leitura indisponível (fundação INATIVA / RPC ausente no ambiente): nunca
      // tratar como campanha nova — o caminho legado permanece intacto.
      return null;
    }
  };
  const newFlowOperation = await loadNewFlowOperation();
  const newFlowState = mapNewFlowDisplayState(newFlowOperation);

  // F56.2b1b (Plano 06 — correção) — CLASSIFICAÇÃO PERSISTIDA. O fluxo da campanha
  // é decidido pela informação PERSISTIDA (`campaigns.input_snapshot.
  // frozenContentReferences`), NUNCA pelo resultado da leitura da operação. Marcador
  // PRESENTE ⇒ campanha do NOVO fluxo: se a operação não puder ser lida (RPC
  // ausente/erro), FALHA FECHADA — superfície segura de resultado DESCONHECIDO —
  // NUNCA as telas legadas (`StaleView`/`ErrorView`) de regeneração nem o gate F37.
  // Marcador AUSENTE ⇒ LEGADO PROVADO (caminho abaixo preservado). INDETERMINADA ⇒
  // fail-closed.
  const flowClassification = classifyCampaignFlow(campaign.input_snapshot);
  if (
    flowClassification === "indeterminate" ||
    (flowClassification === "new_flow" && !newFlowState)
  ) {
    props.newFlow = {
      state: "unknown",
      supportReference: null,
      operationId: null,
      supportEmail: process.env.SUPPORT_EMAIL,
    };
    return <CampaignPageClient {...props} />;
  }

  if (newFlowState && newFlowOperation) {
    let newFlowCopy: ReturnType<typeof mapNewFlowCopy> = null;
    let newFlowRecovery: NewFlowCopyRecoveryView | null = null;
    // F56.2b2b (B2.2 / C4 / B2B-D9) — no ramo `refunded`, lê o snapshot
    // restaurado SERVER-SIDE (SOMENTE-leitura) para o formulário restaurado.
    // Fail-closed: leitura indisponível ⇒ `null` (sem promessa falsa). NÃO inicia
    // geração/cobrança. `display.ts` (G-NA) resolve estruturalmente — sem import
    // de `product-1-1`.
    let restoredForm: CampaignFormRestore | null = null;
    if (newFlowState === "refunded") {
      try {
        restoredForm = mapRestoredForm({
          campaignId: id,
          inputSnapshot: campaign.input_snapshot,
          identitySnapshot: campaign.identity_snapshot,
        });
      } catch {
        restoredForm = null;
      }
    }
    if (newFlowState === "delivered") {
      try {
        const artifactStore = new ProductOneToOneArtifactStore();
        const probe = await artifactStore.probeArtifact({
          storeId: campaign.store_id,
          campaignId: id,
          operationId: newFlowOperation.operationId,
        });
        if (probe.kind === "integral") {
          props.imageUrl = await artifactStore.getSignedArtifactUrl(probe.storagePath);
        }
      } catch {
        // Melhor esforço: sem arte íntegra a página não promete recuperação.
      }

      // F56.2b1b (P3) — a copy entregue é lida POR OPERAÇÃO (nunca dos campos
      // legados de `campaigns`) e exibida na campanha. A leitura é SOMENTE
      // leitura: NUNCA inicia geração/cobrança. Falha de leitura ⇒ sem informação
      // de copy (a arte continua exibida; nenhuma promessa falsa).
      let delivery: Awaited<ReturnType<typeof readCopyDelivery>> = null;
      try {
        delivery = await readCopyDelivery(supabaseAdmin, {
          campaignId: id,
          operationId: newFlowOperation.operationId,
        });
        const cancellation = delivery
          ? await readCopyCancellation(supabaseAdmin, {
              campaignId: id,
              operationId: newFlowOperation.operationId,
            })
          : null;
        newFlowCopy = mapNewFlowCopy(delivery, cancellation !== null);
      } catch {
        newFlowCopy = null;
        delivery = null;
      }

      // F56.2b2a (B2.1 / Plano 04) — SUMÁRIO read-only da RECUPERAÇÃO de copy,
      // lido pelo módulo JÁ AUTORIZADO da página (`copy/copy-state`), AO LADO das
      // leituras acima e DENTRO do bloco `delivered` (o gate permanece). A leitura
      // é SOMENTE leitura (nunca inicia geração/cobrança). Fail-closed: leitura
      // indisponível ⇒ `indeterminada` (não comprova ausência de tentativa, a arte
      // continua exibida, nenhuma promessa falsa). Sem tentativa
      // (`attemptSeq === 0`/`state === null`) ⇒ SEM superfície de recuperação.
      try {
        const summary = await readCopyRecoverySummary(supabaseAdmin, {
          campaignId: id,
          operationId: newFlowOperation.operationId,
        });
        const recoveryRecord: NewFlowCopyRecoveryRecord = {
          state: summary.state,
          attemptSeq: summary.attemptSeq,
          attemptActive: summary.attemptActive,
          waitRemainingMs: summary.waitRemainingMs,
          autoAttempts: summary.autoAttempts,
          manualAttempts: summary.manualAttempts,
          definitive: summary.definitive,
        };
        newFlowRecovery = mapNewFlowCopyRecovery(recoveryRecord, delivery);
      } catch {
        newFlowRecovery = mapNewFlowCopyRecovery(null, delivery);
      }
    }
    props.newFlow = {
      state: newFlowState,
      supportReference: newFlowOperation.supportReference ?? null,
      operationId: newFlowOperation.operationId,
      supportEmail: process.env.SUPPORT_EMAIL,
      copy: newFlowCopy,
      recovery: newFlowRecovery,
      restoredForm,
    };
    return <CampaignPageClient {...props} />;
  }

  if (campaign.status === "ready" && campaign.storage_path) {
    const signedUrl = await generateSignedPreviewUrl(campaign.storage_path);
    props.imageUrl = signedUrl;
  }

  // F37.1 (D2/decisão 3) + F37.2 (R1/R7): deriva o estado de aprovação para
  // campanhas ready. `pending` (v1/v2) e `regenerating` ganham props da candidata
  // ativa; os demais estados (approved/legacy/not_enabled) seguem como entrega.
  if (campaign.status === "ready") {
    const flagEnabled = await isCampaignApprovalEnabled();
    let versions = flagEnabled ? await listArtVersions(id) : [];
    let state = computeApprovalState(campaign, versions, flagEnabled);

    // F37.2 (R7): recuperação preguiçosa — se derivou `regenerating`, tenta
    // reverter um consumo preso além do teto. Se `recovered:true`, RECARREGA
    // campanha/versões do banco ANTES de recalcular (nunca re-derivar sobre os
    // mesmos objetos em memória).
    if (state.status === "regenerating") {
      try {
        const { data: recoverData, error: recoverError } = await supabaseAdmin.rpc(
          "recover_campaign_correction_generation",
          {
            p_campaign_id: id,
            p_stale_before: new Date(
              Date.now() - CORRECTION_GENERATION_STALE_AFTER_MS
            ).toISOString(),
          }
        );
        if (recoverError) {
          console.error(
            `[campanhas/[id]] recover_campaign_correction_generation failed (best-effort) — ${recoverError.message}`
          );
        }
        if ((recoverData as { recovered?: boolean } | null)?.recovered === true) {
          const reloaded = await getCampaignForDisplay(id);
          if (reloaded) {
            campaign = reloaded;
            versions = await listArtVersions(id);
            state = computeApprovalState(campaign, versions, flagEnabled);
            props = mapCampaignToProps(campaign, id);
            if (campaign.status === "ready" && campaign.storage_path) {
              props.imageUrl = await generateSignedPreviewUrl(campaign.storage_path);
            }
          }
        }
      } catch (err) {
        console.error(
          `[campanhas/[id]] recover exception (best-effort) — ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    if (state.status === "pending" || state.status === "regenerating") {
      const candidate = getActiveCandidateArtVersion(versions);
      const isV1 = candidate?.version_number === 1;

      let hasOpportunity = false;
      if (isV1) {
        try {
          const report = await getCorrectionReport(id);
          hasOpportunity = !report || report.status === "open";
        } catch (err) {
          console.error(
            `[campanhas/[id]] getCorrectionReport failed (best-effort) — ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      props.approval = {
        state,
        candidateImageUrl: candidate?.storage_path
          ? await generateSignedPreviewUrl(candidate.storage_path)
          : null,
        candidateVersionId: candidate?.id ?? null,
        isV1,
        hasOpportunity,
      };
    }
  }

  return <CampaignPageClient {...props} />;
}
