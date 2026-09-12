import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateSignedPreviewUrl } from "./display";
import type {
  CampaignArtVersion,
  CorrectionAnalysisState,
  CorrectionReport,
  CorrectionReportStatus,
  CorrectionSubmission,
} from "./types";
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBriefSnapshot } from "@/lib/campaign/brief";
import { buildCampaignBrief } from "@/lib/store-identity-service";
import type { CampaignInput, StoreIdentitySnapshot } from "@/components/campaign/types";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import type { GenerateImageServiceResult } from "@/lib/image-generation/services/image-generation-service";
import { createImageProvider } from "@/lib/image-generation/providers/factory";
import type { GenerateImageRequest, GenerationPhaseEvent } from "@/lib/image-generation/schema";
import type { GenerationMetricsEvent } from "@/lib/image-generation/metrics/types";
import type { ImageProviderUsageMeta } from "@/lib/image-generation/providers/types";
import { IMAGE_GENERATION_RESPONSES_MODEL } from "@/lib/image-generation/config";
import { AiCostTracker, resolveAiCost } from "@/lib/ai-cost";
import { createDefaultTelemetryContext } from "@/lib/ai";
import type { TokenUsage } from "@/lib/ai-cost/types";
import type { GenerationEventType } from "@/lib/visual-signature/types";
import { dataUrlToCampaignImage, deleteCampaignImage } from "./persistence";
import { transcodeToJpeg } from "./image-processor";

// F37.2 (R5/R6): persistência do caso de correção por não conformidade.
//
// Invariantes:
//  - A filha `campaign_correction_submissions` NÃO tem `campaign_id` — a campanha
//    é alcançada via `report_id`.
//  - A decisão corrente é a tentativa de maior `attempt_number` (ordem determinística;
//    `created_at` pode empatar) — nunca por `created_at`.
//  - A aprovação final NÃO é espelhada no relato: deriva de
//    `campaigns.approved_version_id`/`approved_at` + versões.
//  - A conclusão da análise NUNCA é UPDATE TS direto: delega à RPC
//    `complete_campaign_correction_analysis` (guarda atômica estado/lease/vigência).

// ─── Leitura/escrita base ────────────────────────────────────────────────────

export async function getCorrectionReport(
  campaignId: string
): Promise<CorrectionReport | null> {
  const { data, error } = await supabaseAdmin
    .from("campaign_correction_reports")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as CorrectionReport | null) ?? null;
}

export async function listCorrectionSubmissions(
  reportId: string
): Promise<CorrectionSubmission[]> {
  const { data, error } = await supabaseAdmin
    .from("campaign_correction_submissions")
    .select("*")
    .eq("report_id", reportId)
    .order("attempt_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CorrectionSubmission[];
}

export async function createCorrectionReport(input: {
  campaignId: string;
  storeId: string;
  reportedVersionId: string;
  operationRunId?: string | null;
}): Promise<CorrectionReport> {
  const { data, error } = await supabaseAdmin
    .from("campaign_correction_reports")
    .insert({
      campaign_id: input.campaignId,
      store_id: input.storeId,
      reported_version_id: input.reportedVersionId,
      status: "open",
      operation_run_id: input.operationRunId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CorrectionReport;
}

export async function completeCorrectionAnalysis(input: {
  reportId: string;
  submissionId: string;
  attemptNumber: number;
  analysisState: Exclude<CorrectionAnalysisState, "analyzing">;
  category?: string | null;
  normalizedInstruction?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("complete_campaign_correction_analysis", {
    p_report_id: input.reportId,
    p_submission_id: input.submissionId,
    p_attempt_number: input.attemptNumber,
    p_analysis_state: input.analysisState,
    p_category: input.category ?? null,
    p_normalized_instruction: input.normalizedInstruction ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

// ─── Consultas admin ─────────────────────────────────────────────────────────

export interface CorrectionReportFilters {
  status?: CorrectionReportStatus;
  analysisState?: CorrectionAnalysisState;
  reviewed?: "reviewed" | "unreviewed";
}

export interface CorrectionReportListItem {
  report: CorrectionReport;
  /** Decisão corrente = tentativa de maior attempt_number (null se não houver). */
  currentSubmission: CorrectionSubmission | null;
}

export interface ListCorrectionReportsResult {
  items: CorrectionReportListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// Resolve a decisão corrente (maior attempt_number) de cada relato a partir das
// submissões da filha. Retorna um mapa reportId -> submissão vigente.
async function resolveCurrentSubmissions(
  reportIds: string[]
): Promise<Map<string, CorrectionSubmission>> {
  const map = new Map<string, CorrectionSubmission>();
  if (reportIds.length === 0) {
    return map;
  }

  const { data, error } = await supabaseAdmin
    .from("campaign_correction_submissions")
    .select("*")
    .in("report_id", reportIds)
    .order("attempt_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as CorrectionSubmission[]) {
    // order ascendente → a última gravada é a de maior attempt_number
    map.set(row.report_id, row);
  }

  return map;
}

export async function listCorrectionReports(input: {
  filters?: CorrectionReportFilters;
  page?: number;
  pageSize?: number;
} = {}): Promise<ListCorrectionReportsResult> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.max(1, input.pageSize ?? 20);
  const filters = input.filters ?? {};

  let query = supabaseAdmin
    .from("campaign_correction_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.reviewed === "reviewed") {
    query = query.not("reviewed_by_support_at", "is", null);
  } else if (filters.reviewed === "unreviewed") {
    query = query.is("reviewed_by_support_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const reports = (data ?? []) as CorrectionReport[];
  const currentByReport = await resolveCurrentSubmissions(reports.map((r) => r.id));

  let items: CorrectionReportListItem[] = reports.map((report) => ({
    report,
    currentSubmission: currentByReport.get(report.id) ?? null,
  }));

  // Filtro pela analysis_state da tentativa vigente (resolvido após a decisão corrente).
  if (filters.analysisState) {
    items = items.filter(
      (item) => item.currentSubmission?.analysis_state === filters.analysisState
    );
  }

  const total = items.length;
  const offset = (page - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
  };
}

export interface CorrectionReportDetail {
  report: CorrectionReport;
  submissions: CorrectionSubmission[];
  versions: CampaignArtVersion[];
  /** versionId -> signed URL (service_role), incluindo a v1 `superseded`. */
  signedUrls: Record<string, string | null>;
  /** Aprovação DERIVADA de campaigns (nunca espelhada no relato). */
  approval: { approvedVersionId: string | null; approvedAt: string | null };
}

export async function getCorrectionReportDetail(
  reportId: string
): Promise<CorrectionReportDetail | null> {
  const { data: reportData, error: reportError } = await supabaseAdmin
    .from("campaign_correction_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) {
    throw new Error(reportError.message);
  }

  const report = (reportData as CorrectionReport | null) ?? null;
  if (!report) {
    return null;
  }

  const submissions = await listCorrectionSubmissions(reportId);

  const { data: versionData, error: versionError } = await supabaseAdmin
    .from("campaign_art_versions")
    .select("*")
    .eq("campaign_id", report.campaign_id)
    .order("version_number", { ascending: true });

  if (versionError) {
    throw new Error(versionError.message);
  }

  const versions = (versionData ?? []) as CampaignArtVersion[];

  const signedUrls: Record<string, string | null> = {};
  for (const version of versions) {
    signedUrls[version.id] = version.storage_path
      ? await generateSignedPreviewUrl(version.storage_path)
      : null;
  }

  const { data: campaignData, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("approved_version_id, approved_at")
    .eq("id", report.campaign_id)
    .maybeSingle();

  if (campaignError) {
    throw new Error(campaignError.message);
  }

  return {
    report,
    submissions,
    versions,
    signedUrls,
    approval: {
      approvedVersionId:
        (campaignData as { approved_version_id: string | null } | null)
          ?.approved_version_id ?? null,
      approvedAt:
        (campaignData as { approved_at: string | null } | null)?.approved_at ?? null,
    },
  };
}

// Marcação ORTOGONAL "revisado pelo suporte" — não altera status/rejection_count/
// versões/aprovação.
export async function markReportReviewedBySupport(
  reportId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("campaign_correction_reports")
    .update({
      reviewed_by_support_at: new Date().toISOString(),
      reviewed_by_support_user: actorId,
    })
    .eq("id", reportId);

  if (error) {
    throw new Error(error.message);
  }
}

// ─── F37.2 (R4/D5): orquestrador da geração da v2 ────────────────────────────
//
// Fluxo: baixar imagens F41 do snapshot (storagePath → data URL) → reconstruir
// brief/contexto a partir do snapshot imutável → gerar via ImageGenerationService
// com o hook `onBeforeImageProviderCall` (consome a oportunidade imediatamente
// antes da 1ª chamada ao provider) → upload da v2 em {storeId}/{campaignId}/v2.jpg
// → RPC `complete_campaign_correction_v2` (snapshot copiado da v1 no banco; NUNCA
// do cliente). Falha pré-provider não consome (relato permanece `open`); falha
// pós-provider chama `fail_campaign_correction_v2` + cleanup best-effort do órfão.
//
// Sem reserva de crédito, sem transações de crédito e sem nova chave de
// operação — a v2 é parte da mesma entrega (1 crédito = 1 campanha aprovada).
// Sem `candidateArtDataUrl` (a v1 não é enviada como referência).

/** Baixa uma imagem do bucket `campaign-images` e a reconverte em data URL JPEG. */
export async function storagePathToDataUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      error?.message ?? `Falha ao baixar a imagem de entrada: ${storagePath}`
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

export interface GenerateCorrectionV2Input {
  campaignId: string;
  reportId: string;
  submissionId: string;
  userId?: string | null;
  signal?: AbortSignal;
  onPhaseChange?: (event: GenerationPhaseEvent) => void;
  /** Snapshot econômico do run (F38.2.1) propagado aos eventos call-level. */
  usdBrlRateAtGeneration?: number | null;
  creditValueBrlAtGeneration?: number | null;
}

export type GenerateCorrectionV2Result =
  | { success: true; campaignId: string; storagePath: string; versionId: string | null }
  | {
      success: false;
      code: string;
      message: string;
      /** true = falha ANTES do provider (consumo não rodou; relato permanece open). */
      preProvider: boolean;
    };

async function getCorrectionReportById(
  reportId: string
): Promise<CorrectionReport | null> {
  const { data, error } = await supabaseAdmin
    .from("campaign_correction_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as CorrectionReport | null) ?? null;
}

// Falha pós-provider atômica (mantém rejection_count=1, libera a candidata,
// failed_no_v2). Best-effort no caller — nunca derruba a resposta do orquestrador.
async function failCorrectionV2(campaignId: string, reportId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("fail_campaign_correction_v2", {
      p_campaign_id: campaignId,
      p_report_id: reportId,
    });
    if (error) {
      console.error(
        `[correction-reports] fail_campaign_correction_v2 falhou: ${error.message}`
      );
    }
  } catch (err) {
    console.error(
      `[correction-reports] fail_campaign_correction_v2 exceção: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function generateCorrectionV2(
  input: GenerateCorrectionV2Input
): Promise<GenerateCorrectionV2Result> {
  const { campaignId, reportId, submissionId } = input;

  // a. Carrega relato, v1 (snapshot + storage), campanha e tentativa elegível.
  const report = await getCorrectionReportById(reportId);
  if (!report || report.campaign_id !== campaignId) {
    return {
      success: false,
      code: "report_campaign_mismatch",
      message: "Relato de correção não encontrado para a campanha.",
      preProvider: true,
    };
  }

  const { data: v1Data, error: v1Error } = await supabaseAdmin
    .from("campaign_art_versions")
    .select("*")
    .eq("id", report.reported_version_id)
    .maybeSingle();

  if (v1Error) {
    throw new Error(v1Error.message);
  }
  const v1 = v1Data as CampaignArtVersion | null;
  if (!v1) {
    return {
      success: false,
      code: "no_reported_version",
      message: "Versão v1 reportada não encontrada.",
      preProvider: true,
    };
  }

  const { data: campaignData, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id, store_id, identity_snapshot, operation_run_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(campaignError.message);
  }
  if (!campaignData) {
    return {
      success: false,
      code: "campaign_not_found",
      message: "Campanha não encontrada.",
      preProvider: true,
    };
  }

  const storeId = (campaignData as { store_id: string }).store_id;
  const identitySnapshot = (campaignData as { identity_snapshot: Record<string, unknown> | null })
    .identity_snapshot as unknown as StoreIdentitySnapshot | null;
  if (!identitySnapshot) {
    return {
      success: false,
      code: "identity_snapshot_missing",
      message: "Identidade da loja indisponível para a correção.",
      preProvider: true,
    };
  }

  const { data: submissionData, error: submissionError } = await supabaseAdmin
    .from("campaign_correction_submissions")
    .select("*")
    .eq("id", submissionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (submissionError) {
    throw new Error(submissionError.message);
  }
  const submission = submissionData as CorrectionSubmission | null;
  if (
    !submission ||
    submission.analysis_state !== "eligible" ||
    !submission.normalized_instruction
  ) {
    return {
      success: false,
      code: "submission_not_eligible",
      message: "Tentativa não elegível para geração da v2.",
      preProvider: true,
    };
  }

  // b. Reconstrução do brief/contexto a partir do snapshot imutável (campaign_brief_v1).
  const snapshot = v1.brief_snapshot as unknown as CampaignBriefSnapshot;

  const snapshotImages = snapshot?.media?.images ?? [];
  const productImages = (
    await Promise.all(
      snapshotImages
        .filter((img) => Boolean(img.storagePath))
        .map(async (img) => ({
          role: img.role,
          source: img.source,
          mimeType: img.mimeType,
          dataUrl: await storagePathToDataUrl(img.storagePath as string),
        }))
    )
  );

  if (productImages.length === 0) {
    return {
      success: false,
      code: "product_images_unavailable",
      message: "Imagens do produto indisponíveis para a correção.",
      preProvider: true,
    };
  }

  const flat: GenerateImageRequest = {
    storeId,
    productName: snapshot.product.name,
    description: snapshot.product.description,
    campaignIntent: snapshot.commercial.intent,
    originalPriceCents: snapshot.commercial.originalPriceCents,
    discountedPriceCents: snapshot.commercial.discountedPriceCents,
    badgeText: snapshot.commercial.badgeText,
    hook: snapshot.commercial.hook,
    cta: snapshot.commercial.cta,
    objective: snapshot.commercial.objective,
    campaignDetails: snapshot.commercial.campaignDetails,
    additionalDetails: snapshot.commercial.additionalDetails,
    targetChannel: snapshot.commercial.targetChannel,
    format: snapshot.commercial.format,
    validity: snapshot.commercial.validity?.enabled
      ? snapshot.commercial.validity.displayText
      : undefined,
    availabilityNotes: snapshot.commercial.availabilityNotes,
    sensitiveConstraints: snapshot.creativeContext.sensitiveConstraints,
    preserveImageContext: snapshot.creativeContext.preserveImageContext,
    mandatoryArtworkText: snapshot.commercial.legalNotice?.enabled
      ? snapshot.commercial.legalNotice.text
      : undefined,
    productImages,
  };

  const brief = buildCampaignBriefFromFlat(flat, storeId);
  const campaignInput: CampaignInput = flat;
  const context = await buildCampaignBrief(identitySnapshot, campaignInput);

  // F37.2 (R4/D5): `input_validation` emitida como `skipped` via override
  // `brief_review_confirmed` (F43) — sem nova chamada de visão.
  context.campaignInput.inputValidationOverride = {
    productImageCheck: "brief_review_confirmed",
  };

  // c. Geração com hook de consumo + bloco único de não conformidade.
  const operationRunId =
    (campaignData as { operation_run_id: string | null }).operation_run_id ??
    crypto.randomUUID();
  const traceId = crypto.randomUUID();
  const attemptNumber = submission.attempt_number;
  const normalizedInstruction = submission.normalized_instruction;

  const recordCall = async (params: {
    generationType: GenerationEventType;
    status: "success" | "failed";
    info: {
      provider: string;
      model: string;
      usage?: TokenUsage;
      usageMeta?: ImageProviderUsageMeta;
      durationMs: number;
    };
    errorType?: string;
  }): Promise<void> => {
    try {
      const cost = await resolveAiCost({
        provider: params.info.provider,
        model: params.info.model,
        usage: params.info.usage,
        imageGenerationTool: params.info.usageMeta?.imageGenerationTool === true,
        generationType: params.generationType,
      });

      const usageMeta = params.info.usageMeta
        ? {
            provider_usage_raw: params.info.usageMeta.providerUsageRaw,
            provider_usage_source: params.info.usageMeta.providerUsageSource,
            responses_model: params.info.usageMeta.responsesModel,
            image_generation_tool: params.info.usageMeta.imageGenerationTool,
          }
        : undefined;

      await new AiCostTracker().record({
        operationRunId,
        operationRunType: "campaign_delivery",
        traceId,
        storeId,
        userId: input.userId ?? null,
        campaignId,
        generationType: params.generationType,
        provider: params.info.provider,
        model: params.info.model,
        attemptNumber,
        durationMs: params.info.durationMs,
        status: params.status,
        errorType: params.errorType ?? null,
        tokens: params.info.usage,
        cost,
        usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
        creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
        metadata: usageMeta,
      });
    } catch (err) {
      console.error(
        "[correction-reports] recordCall failed (best-effort):",
        err instanceof Error ? err.message : String(err)
      );
    }
  };

  const onMetrics = (event: GenerationMetricsEvent): void => {
    switch (event.phase) {
      case "image_generation":
        void recordCall({
          generationType: "campaign_image",
          status: "success",
          info: {
            provider: event.provider,
            model: event.model,
            usage: event.usage,
            usageMeta: event.usageMeta,
            durationMs: event.durationMs,
          },
        });
        break;
      default:
        // F46-04 (reabertura, D9): input_validation/quality_review são
        // persistidas pelo SINK único; prompt_assembly/done não são chamadas de IA.
        break;
    }
  };

  // Hook fire-once: consome a oportunidade imediatamente antes da 1ª chamada ao
  // provider. Falha aqui propaga como falha pré-provider (não consome).
  let consumptionStarted = false;
  const onBeforeImageProviderCall = async (): Promise<void> => {
    const { error } = await supabaseAdmin.rpc(
      "consume_campaign_correction_opportunity",
      {
        p_campaign_id: campaignId,
        p_report_id: reportId,
        p_submission_id: submissionId,
      }
    );
    if (error) {
      throw new Error(error.message);
    }
    consumptionStarted = true;
  };

  const storagePath = `${storeId}/${campaignId}/v2.jpg`;
  const provider = createImageProvider();
  const imageService = new ImageGenerationService(provider);
  const startedAt = Date.now();

  // F46-04 (reabertura, D9): telemetria pelo sink único para as capacidades de
  // VISÃO (campaign_input_validation/campaign_image_review). A imagem
  // (campaign_image) permanece híbrida (recordCall manual) até 46-05.
  const telemetry = createDefaultTelemetryContext({
    operationRunId,
    operationRunType: "campaign_delivery",
    traceId,
    storeId,
    userId: input.userId ?? undefined,
    campaignId,
    attemptNumber,
    usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
    creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
  });

  let result: GenerateImageServiceResult;
  try {
    result = await imageService.generateImage(
      brief,
      context,
      input.onPhaseChange,
      input.signal,
      onMetrics,
      {
        onBeforeImageProviderCall,
        normalizedInstruction,
        telemetry,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!consumptionStarted) {
      // e. Falha pré-provider: consumo não rodou; relato permanece `open`.
      return { success: false, code: "pre_provider_failure", message, preProvider: true };
    }
    await failCorrectionV2(campaignId, reportId);
    try {
      await deleteCampaignImage(storagePath);
    } catch {
      /* best-effort */
    }
    return { success: false, code: "generation_failed", message, preProvider: false };
  }

  if (!result.success) {
    if (!consumptionStarted) {
      return {
        success: false,
        code: result.code,
        message: result.message,
        preProvider: true,
      };
    }
    // f. Falha pós-provider: encerra o caso atômico + cleanup best-effort.
    await failCorrectionV2(campaignId, reportId);
    try {
      await deleteCampaignImage(storagePath);
    } catch {
      /* best-effort */
    }
    return {
      success: false,
      code: result.code,
      message: result.message,
      preProvider: false,
    };
  }

  // d. Sucesso: transcode → upload da v2 → RPC de conclusão (sem p_mime_type;
  // snapshot copiado da v1 no banco, nunca do cliente).
  const durationMs = Date.now() - startedAt;
  let uploaded = false;
  try {
    const { buffer, mimeType } = dataUrlToCampaignImage(result.imageDataUrl);
    const jpeg = await transcodeToJpeg(buffer, mimeType);

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from("campaign-images")
      .upload(storagePath, jpeg.buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    uploaded = true;

    const generationMetadata: Record<string, unknown> = {
      provider: provider.name,
      model: IMAGE_GENERATION_RESPONSES_MODEL,
      durationMs,
      generatedAt: new Date().toISOString(),
      operationRunId,
      correction: {
        reportId,
        submissionId,
        category: submission.category,
      },
    };

    const renderSnapshot: Record<string, unknown> = {
      format: "jpeg",
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      mimeType: "image/jpeg",
      quality: 90,
      colorSpace: "srgb",
    };

    const { data: completeData, error: completeError } = await supabaseAdmin.rpc(
      "complete_campaign_correction_v2",
      {
        p_campaign_id: campaignId,
        p_report_id: reportId,
        p_submission_id: submissionId,
        p_storage_path: storagePath,
        p_generation_metadata: generationMetadata,
        p_render_snapshot: renderSnapshot,
      }
    );

    if (completeError) {
      throw new Error(completeError.message);
    }

    const versionId =
      (completeData as { version_id?: string } | null)?.version_id ?? null;

    return { success: true, campaignId, storagePath, versionId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failCorrectionV2(campaignId, reportId);
    if (uploaded) {
      try {
        await deleteCampaignImage(storagePath);
      } catch {
        /* best-effort */
      }
    }
    return { success: false, code: "persistence_failed", message, preProvider: false };
  }
}
