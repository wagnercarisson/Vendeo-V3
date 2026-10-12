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

  // F56.2b1b (Plano 06, B1B-D6 / C2 / F4 / I3) — campanha do NOVO fluxo: o
  // download é governado pelo estado PERSISTIDO da operação (`delivered`) +
  // objeto ÍNTEGRO. `art_uploaded` sozinho NÃO libera e o estado persistido NUNCA
  // é promovido por presença de objeto. A URL assinada só é gerada DEPOIS de
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
    const artifactStore = new ProductOneToOneArtifactStore();
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
    const signedUrl = await artifactStore.getSignedArtifactUrl(decision.storagePath);
    return NextResponse.redirect(signedUrl, 302);
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

  const safeName = campaign.product_name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "campanha";
  const dateStr = campaign.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0];
  const filename = `${safeName}-${dateStr}.jpg`;

  return new NextResponse(fileData, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
