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
