import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { notFound } from "@/lib/api-error-response";
import { getCampaign, listArtVersions } from "@/lib/campaign/persistence";
import { classifyCampaignFlow } from "@/lib/campaign/new-flow-marker";
import { computeApprovalState, isDeliveryReleased } from "@/lib/campaign/display";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { ProductOneToOneArtifactStore } from "@/lib/product-1-1/artifact/artifact-store";
import { decideNewFlowDownload } from "@/lib/product-1-1/artifact/download-gate";
import { buildSafeDownloadFilename } from "@/lib/campaign/download-filename";
import { resolveCampaignGenerationOrigin } from "@/lib/product-9-16-two-stage/orchestration/origin";
import { nineSixteenVerticalAccess } from "@/lib/product-9-16-two-stage/orchestration/vertical-access";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const user = await requireApiUser();

  if (!UUID_V4_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  const campaign = await getCampaign(id);
  if (!campaign) {
    return notFound("Campaign not found");
  }

  await requireOwnership(campaign.store_id, user.userId);

  // F60.5 — ramo 9:16 por expansao ANTES do gate F56.2b1b/store direto.
  const generationOrigin = resolveCampaignGenerationOrigin(
    campaign.input_snapshot,
  );
  if (generationOrigin.kind === "two_stage_9_16") {
    const operationRow = await supabaseAdmin
      .from("product_9_16_two_stage_operations")
      .select("operation_id")
      .eq("campaign_id", id)
      .maybeSingle<{ operation_id: string }>();
    if (operationRow.error) {
      return NextResponse.json(
        { error: { code: "operation_unavailable", message: "Operação indisponível." } },
        { status: 503 },
      );
    }
    const operationId = operationRow.data?.operation_id;
    if (!operationId) {
      return NextResponse.json(
        { error: { code: "operation_not_found", message: "Operação não encontrada." } },
        { status: 404 },
      );
    }
    const control = new ProductTwoStageOperationClient(supabaseAdmin as never);
    const lookup = await control.getOperationView({
      campaignId: id,
      operationId,
    });
    if (lookup.kind === "read_failed") {
      return NextResponse.json(
        { error: { code: "operation_unavailable", message: "Operação indisponível." } },
        { status: 503 },
      );
    }
    if (lookup.kind === "absent") {
      return NextResponse.json(
        { error: { code: "operation_not_found", message: "Operação não encontrada." } },
        { status: 404 },
      );
    }
    const access = await nineSixteenVerticalAccess(
      {
        storeId: campaign.store_id,
        campaignId: id,
        operationId,
        mode: "download",
      },
      { client: supabaseAdmin },
    );
    if (access.kind === "not_available") {
      if (access.reason === "indeterminate") {
        return NextResponse.json(
          { error: { code: "artifact_unavailable", message: "Arte indisponível." } },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: { code: access.reason, message: "Download não autorizado." } },
        { status: 403 },
      );
    }
    if (access.kind !== "downloadBytes") {
      return NextResponse.json(
        { error: { code: "artifact_unavailable", message: "Arte indisponível." } },
        { status: 403 },
      );
    }
    const filename = buildSafeDownloadFilename({
      productName: campaign.product_name,
      createdAt: campaign.created_at,
      extension: "jpg",
    });
    return new NextResponse(
      new Blob([new Uint8Array(access.bytes)], { type: access.mimeType }),
      {
        headers: {
          "Content-Type": access.mimeType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  // F56.2b1b (Plano 06, B1B-D6 / C2 / F4 / I3) — campanha do NOVO fluxo: o
  // download é governado pelo estado PERSISTIDO da operação (`delivered`) +
  // objeto ÍNTEGRO. `art_uploaded` sozinho NÃO libera e o estado persistido NUNCA
  // é promovido por presença de objeto. A entrega dos bytes só ocorre DEPOIS de
  // `decideNewFlowDownload` liberar (I3). A F37 NÃO governa este ramo. Campanhas
  // legadas (operação `null`) seguem no caminho anterior byte-compatível.
  const loadNewFlowOperation = async () => {
    try {
      return await new ProductOneToOneAttemptStartClient().getCampaignOperation(id);
    } catch {
      // Leitura do novo fluxo indisponível (fundação INATIVA / RPC ausente no
      // ambiente): NUNCA tratar como campanha nova. O caminho legado abaixo só lê
      // `campaigns.storage_path` — nunca a arte do novo fluxo — então não há
      // exposição da arte nova e o legado permanece byte-compatível.
      return null;
    }
  };
  const newFlowOperation = await loadNewFlowOperation();

  // F56.2b1b (Plano 06 — correção) — CLASSIFICAÇÃO PERSISTIDA. O fluxo da campanha
  // é decidido pela informação PERSISTIDA (`campaigns.input_snapshot.
  // frozenContentReferences`), NUNCA pelo resultado da leitura da operação. Marcador
  // PRESENTE ⇒ campanha do NOVO fluxo: se a operação não puder ser lida (RPC
  // ausente/erro) OU estiver ausente, FALHA FECHADA — sem download e sem URL
  // assinada — jamais caindo no ramo legado. Marcador AUSENTE ⇒ LEGADO PROVADO
  // (ramo abaixo preservado byte a byte). Classificação INDETERMINADA ⇒ fail-closed.
  const flowClassification = classifyCampaignFlow(campaign.input_snapshot);
  if (
    flowClassification === "indeterminate" ||
    (flowClassification === "new_flow" && !newFlowOperation)
  ) {
    return NextResponse.json({ error: "Download not available" }, { status: 503 });
  }

  if (newFlowOperation) {
    // F59/D-12 — dispatch pelo formato PERSISTIDO. Formato inválido/versão
    // desconhecida falha fechado; NUNCA cai para o caminho quadrado.
    const formatResolution = resolveCampaignFormat(campaign.input_snapshot);
    if (formatResolution.kind === "unavailable") {
      return NextResponse.json(
        { error: { code: "format_unavailable", message: "Formato da campanha indisponível." } },
        { status: 503 },
      );
    }
    const artifactStore =
      formatResolution.kind === "9:16"
        ? new (await import("@/lib/product-vertical-9-16/artifact/artifact-store")).VerticalArtifactStore()
        : new ProductOneToOneArtifactStore();
    const probe = await artifactStore.probeArtifact({
      storeId: campaign.store_id,
      campaignId: id,
      operationId: newFlowOperation.operationId,
    });
    const decision = decideNewFlowDownload({
      operationStatus: newFlowOperation.status,
      unknown: newFlowOperation.unknown && !newFlowOperation.terminal,
      artifactProbe: probe,
    });
    if (!decision.allowed || decision.storagePath === null) {
      return NextResponse.json({ error: "Download not available" }, { status: 403 });
    }
    // F56.2b1b (correção UAT 56.2.6) — ENTREGA do arquivo pela PRÓPRIA rota:
    // baixa os bytes do bucket privado e devolve `attachment` com nome seguro e
    // tipo correto. NÃO redireciona para a URL de EXIBIÇÃO e NÃO depende de
    // `Content-Disposition` em redirect cross-origin. A URL usada para exibir a
    // imagem na página permanece inalterada.
    let artifact: { buffer: Buffer; mimeType: "image/jpeg" };
    try {
      artifact = await artifactStore.downloadArtifact(decision.storagePath);
    } catch {
      return NextResponse.json({ error: "Failed to download image" }, { status: 502 });
    }
    const filename = buildSafeDownloadFilename({
      productName: campaign.product_name,
      createdAt: campaign.created_at,
      extension: "jpg",
    });
    const body = new Uint8Array(artifact.buffer);
    return new NextResponse(new Blob([body], { type: artifact.mimeType }), {
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // F37.1 (D2/decisão 4): gate de aprovação — enquanto a candidata não é
  // aprovada (pending/regenerating com flag on), o download é bloqueado (403).
  // not_enabled/legacy/approved → serve como hoje (approved → storage_path
  // repontado no approve; legacy/not_enabled → path atual).
  if (await isCampaignApprovalEnabled()) {
    const versions = await listArtVersions(campaign.id);
    const state = computeApprovalState(campaign, versions, true);
    if (!isDeliveryReleased(state)) {
      return NextResponse.json({ error: "Campaign pending approval" }, { status: 403 });
    }
  }

  const { data: fileData, error: downloadError } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .download(campaign.storage_path ?? "");

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: "Failed to download image" },
      { status: 502 }
    );
  }

  const filename = buildSafeDownloadFilename({
    productName: campaign.product_name,
    createdAt: campaign.created_at,
    extension: "jpg",
  });

  return new NextResponse(fileData, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
