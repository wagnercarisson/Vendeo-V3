import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listArtVersions } from "@/lib/campaign/persistence";
import { classifyCampaignFlow } from "@/lib/campaign/new-flow-marker";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { supabaseAdmin } from "@/lib/supabase/server";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import { getCorrectionReport } from "@/lib/campaign/correction-reports";
import { getCampaignDetailMessages } from "@/lib/i18n/campaign-detail";
import type { SupportedUiLocale } from "@/lib/i18n/locales";
import { getUiRenderContext } from "@/lib/i18n/server";
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
  JointTwoFormatState,
  NewFlowCopyRecoveryRecord,
  NewFlowCopyRecoveryView,
} from "@/lib/campaign/display";
import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import { classifyTwoFormatCampaign } from "@/lib/product-two-format/contracts";
import {
  applyTwoFormatDurableOutcomes,
  readTwoFormatDurableOutcomes,
  resolveTwoFormatControlOperation,
} from "@/lib/product-two-format/control-reader";
import type { TwoFormatFormat } from "@/lib/product-two-format/types";
import { normalizeTwoFormatOutcome } from "@/lib/campaign/two-format-outcome";
import { resolveCampaignGenerationOrigin } from "@/lib/product-9-16-two-stage/orchestration/origin";
import { nineSixteenVerticalAccess } from "@/lib/product-9-16-two-stage/orchestration/vertical-access";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { ProductOneToOneArtifactStore } from "@/lib/product-1-1/artifact/artifact-store";
import { readTwoFormatDelivery } from "@/lib/product-two-format/delivery-reader";
import { resolveTwoFormatAccess } from "@/lib/product-two-format/access";
import { COMPOSITION_ARTIFACT_BUCKET } from "@/lib/campaign/composition-artifacts/artifact-path";
import { readProductOneToOneBackgroundDirection } from "@/lib/product-1-1/snapshot/persist-snapshot";
import {
  readCopyDelivery,
  readCopyCancellation,
  readCopyRecoverySummary,
} from "@/lib/product-1-1/copy/copy-state";
import CampaignPageClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ format?: string | string[] }>;
}

// F37.2 (R7): teto de staleness do consumo = timeout global de geração + 30s.
const CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000;

type JointFormatRequest =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "valid"; readonly format: TwoFormatFormat };

/**
 * Distingue `?format=` AUSENTE de valor inválido/vazio/duplicado. Só a ausência
 * autoriza o fallback para o formato preferido; os demais falham fechado.
 */
function parseJointFormatRequest(
  raw: string | string[] | undefined,
): JointFormatRequest {
  if (raw === undefined) return { kind: "absent" };
  if (raw === "1:1" || raw === "9:16") {
    return { kind: "valid", format: raw };
  }
  return { kind: "invalid" };
}

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;

  const user = await requirePageUser();

  const [store, ui] = await Promise.all([
    getCurrentStore(user.userId),
    getUiRenderContext(user.userId),
  ]);
  if (!store) {
    notFound();
  }

  const locale: SupportedUiLocale = ui.ok ? ui.locale : "pt-BR";
  const messages = getCampaignDetailMessages(locale);

  let campaign = await getCampaignForDisplay(id);
  if (!campaign) {
    notFound();
  }

  let props = mapCampaignToProps(campaign, id);

  // F60.7 C3 — classificação CONJUNTA antes de qualquer identidade financeira
  // individual. `getCampaignOperation` escolhe a reserva mais recente por
  // `created_at DESC`; numa campanha conjunta existem DUAS reservas, então ela
  // não é autoridade para a operação de controle. O ramo conjunto resolve a
  // identidade pela autoridade conjunta (vínculos de entrega) e nunca chama a
  // RPC financeira individual.
  const flowClassification = classifyCampaignFlow(campaign.input_snapshot);
  const jointClassification = classifyTwoFormatCampaign(campaign.input_snapshot);

  const renderUnknownJoint = (operationId: string | null) => {
    props.newFlow = {
      state: "unknown",
      supportReference: null,
      operationId,
      supportEmail: process.env.SUPPORT_EMAIL,
    };
    return (
      <CampaignPageClient {...props} messages={messages} locale={locale} />
    );
  };

  if (flowClassification === "indeterminate") {
    return renderUnknownJoint(null);
  }
  if (jointClassification.kind === "inconsistent") {
    return renderUnknownJoint(null);
  }

  if (jointClassification.kind === "two_format") {
    const control = await resolveTwoFormatControlOperation({
      campaignId: id,
      storeId: campaign.store_id,
    });
    if (control.kind !== "found") {
      return renderUnknownJoint(null);
    }

    const jointRead = await readTwoFormatDelivery(
      {
        campaignId: id,
        operationId: control.operationId,
        storeId: campaign.store_id,
      },
      { client: supabaseAdmin },
    );
    if (jointRead.kind !== "found") {
      return renderUnknownJoint(control.operationId);
    }

    // Outcome durável por identidade (controle + quadrado). Crédito reservado
    // NUNCA rebaixa um outcome `unknown` para simples processamento.
    const durable = await readTwoFormatDurableOutcomes({
      campaignId: id,
      controlOperationId: control.operationId,
      operations: [jointRead.view.square.deliveryOperationId],
    });
    const view = applyTwoFormatDurableOutcomes(jointRead.view, {
      unknownOperationIds:
        durable.kind === "found" ? durable.unknownOperationIds : new Set(),
      outcomesReadFailed: durable.kind !== "found",
      controlOperationId: control.operationId,
    });

    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const formatRequest = parseJointFormatRequest(
      resolvedSearchParams?.format,
    );
    const requestedFormat =
      formatRequest.kind === "valid" ? formatRequest.format : null;
    const preferredFormat =
      view.square.state === "delivered"
        ? "1:1"
        : view.vertical.state === "delivered"
          ? "9:16"
          : null;
    // Só a AUSÊNCIA do parâmetro permite escolher o preferido. Valor inválido,
    // vazio ou duplicado nunca cai silenciosamente no outro formato.
    const targetFormat =
      formatRequest.kind === "absent" ? preferredFormat : requestedFormat;
    const access =
      targetFormat === null
        ? null
        : resolveTwoFormatAccess({ view, format: targetFormat });
    let previewUrl: string | null = null;
    if (access?.allowed === true) {
      const signed = await supabaseAdmin.storage
        .from(COMPOSITION_ARTIFACT_BUCKET)
        .createSignedUrl(access.artifactPath, 300);
      previewUrl = signed.data?.signedUrl ?? null;
    }

    const square = view.square.state;
    const vertical = view.vertical.state;
    // Reutiliza o normalizador ÚNICO do C2 para não divergir do formulário.
    const jointOutcome = normalizeTwoFormatOutcome({
      formats: {
        "1:1": { state: square },
        "9:16": { state: vertical },
      },
    });
    let jointState: JointTwoFormatState =
      jointOutcome.kind === "complete"
        ? "delivered"
        : jointOutcome.kind === "error"
          ? "unknown"
          : jointOutcome.kind;
    // Entregue + o outro ainda processando NÃO é "running" puro: a arte
    // entregue permanece visível e o pendente é acompanhado em separado.
    if (
      jointState === "processing" &&
      (square === "delivered" || vertical === "delivered")
    ) {
      jointState = "partial_processing";
    }

    props.imageUrl = previewUrl;
    props.newFlowFormat = targetFormat ?? undefined;
    props.downloadUrl =
      targetFormat !== null
        ? `/api/campaign/${id}/download?format=${targetFormat}`
        : `/api/campaign/${id}/download`;
    props.downloadDisabled = access?.allowed !== true;
    props.joint = {
      formats: {
        "1:1": square,
        "9:16": vertical,
      },
      preferredFormat,
      requestedFormat,
      requestedFormatInvalid: formatRequest.kind === "invalid",
      previewFormat: access?.allowed === true ? targetFormat : null,
      previewUrl,
      state: jointState,
    };

    let newFlowCopy: ReturnType<typeof mapNewFlowCopy> = null;
    try {
      newFlowCopy = mapNewFlowCopy(
        await readCopyDelivery(supabaseAdmin, {
          campaignId: id,
          operationId: control.operationId,
        }),
        false,
      );
    } catch {
      newFlowCopy = null;
    }
    props.newFlow = {
      state:
        jointState === "refunded"
          ? "refunded"
          : jointState === "unknown"
            ? "unknown"
            : jointState === "processing" ||
                jointState === "finalization_pending"
              ? "running"
              : "delivered",
      supportReference:
        durable.kind === "found" ? durable.controlSupportReference : null,
      operationId: control.operationId,
      supportEmail: process.env.SUPPORT_EMAIL,
      copy: newFlowCopy,
    };
    return (
      <CampaignPageClient {...props} messages={messages} locale={locale} />
    );
  }

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

  if (flowClassification === "new_flow" && !newFlowState) {
    return renderUnknownJoint(null);
  }

  if (newFlowState && newFlowOperation) {
    // F59/D-12 — formato PERSISTIDO, resolvido server-side. Indisponível ⇒ sem
    // frame vertical e sem URL assinada (fail-closed).
    const formatResolution = resolveCampaignFormat(campaign.input_snapshot);
    if (formatResolution.kind !== "unavailable") {
      props.newFlowFormat = formatResolution.kind;
    }
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
        // P1 — a direção de fundo vive na EVIDÊNCIA CONGELADA (não em
        // `input_snapshot`). A leitura é SOMENTE-leitura e usa o `operationId`
        // RESOLVIDO NO SERVIDOR; ausência/erro ⇒ `null` (fail-closed ⇒ o formulário
        // exige escolha explícita — NUNCA `studio` silencioso).
        const backgroundDirection = await readProductOneToOneBackgroundDirection(
          supabaseAdmin,
          { campaignId: id, operationId: newFlowOperation.operationId },
        );
        restoredForm = mapRestoredForm({
          campaignId: id,
          inputSnapshot: campaign.input_snapshot,
          identitySnapshot: campaign.identity_snapshot,
          backgroundDirection,
        });
      } catch {
        restoredForm = null;
      }
    }
    if (newFlowState === "delivered") {
      const generationOrigin = resolveCampaignGenerationOrigin(
        campaign.input_snapshot,
      );
      if (generationOrigin.kind === "two_stage_9_16") {
        const access = await nineSixteenVerticalAccess(
          {
            storeId: campaign.store_id,
            campaignId: id,
            operationId: newFlowOperation.operationId,
            mode: "preview",
          },
          { client: supabaseAdmin },
        );
        if (access.kind === "previewUrl") props.imageUrl = access.url;
      } else if (formatResolution.kind !== "unavailable") {
        try {
          const artifactStore =
            formatResolution.kind === "9:16"
              ? new (await import("@/lib/product-vertical-9-16/artifact/artifact-store")).VerticalArtifactStore()
              : new ProductOneToOneArtifactStore();
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
    return (
      <CampaignPageClient {...props} messages={messages} locale={locale} />
    );
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

  return (
    <CampaignPageClient {...props} messages={messages} locale={locale} />
  );
}
