import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getCorrectionReportDetail } from "@/lib/campaign/correction-reports";
import { formatDateTimeBR } from "@/lib/formatters";
import { CampaignReportReviewed } from "@/components/admin/campaign-report-reviewed";

export const dynamic = "force-dynamic";

const ANALYSIS_LABELS: Record<string, string> = {
  analyzing: "Analisando",
  eligible: "Elegível",
  blocked: "Bloqueado",
  unclear: "Não claro",
  analysis_failed: "Falha de análise",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  generation_started: "Geração iniciada",
  v2_generated: "V2 gerada",
  failed_no_v2: "Falhou sem v2",
};

function formatTs(value: string | null | undefined): string {
  return value ? formatDateTimeBR(value) : "—";
}

export default async function AdminCampaignReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Acesso negado. Apenas administradores podem acessar esta página.
      </div>
    );
  }

  const { reportId } = await params;

  // v1 × v2 lado a lado: as signed URLs (service_role, geradas via
  // generateSignedPreviewUrl no serviço) incluem a v1 `superseded` (path preservado).
  const detail = await getCorrectionReportDetail(reportId);
  if (!detail) {
    notFound();
  }

  const { report, submissions, versions, signedUrls, approval } = detail;
  const consumptionCount = report.status === "open" ? 0 : 1;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/campaign-reports"
          className="text-xs text-text-muted hover:text-text-primary"
        >
          ← Relatos de correção
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-bold">Relato de correção</h1>
        <p className="font-mono text-xs text-text-muted">{report.id}</p>
      </div>

      <dl className="mb-6 grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">Campanha</dt>
          <dd className="font-mono text-xs text-text-primary">{report.campaign_id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">Loja</dt>
          <dd className="font-mono text-xs text-text-primary">{report.store_id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">Status do caso</dt>
          <dd className="text-text-primary">{STATUS_LABELS[report.status] ?? report.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            Consumo (rejection_count)
          </dt>
          <dd className="text-text-primary">{consumptionCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">V1 relatada</dt>
          <dd className="font-mono text-xs text-text-primary">{report.reported_version_id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">V2 gerada</dt>
          <dd className="font-mono text-xs text-text-primary">
            {report.generated_version_id ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">Geração iniciada em</dt>
          <dd className="text-text-primary">{formatTs(report.generation_started_at)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            operation_run_id
          </dt>
          <dd className="text-text-primary">
            {report.operation_run_id ? (
              <Link
                href={`/admin/ai-operation-costs?operationRunId=${report.operation_run_id}`}
                className="font-mono text-xs text-accent-blue hover:underline"
              >
                {report.operation_run_id}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            Aprovação (derivada de campaigns.approved_version_id)
          </dt>
          <dd className="text-text-primary">
            {approval.approvedVersionId
              ? `Aprovada — ${approval.approvedVersionId.slice(0, 8)} (${formatTs(approval.approvedAt)})`
              : "Não aprovada"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            Revisado pelo suporte
          </dt>
          <dd className="text-text-primary">
            {report.reviewed_by_support_at ? (
              <span className="text-accent-green">
                {formatTs(report.reviewed_by_support_at)}
              </span>
            ) : (
              "Não revisado"
            )}
          </dd>
        </div>
      </dl>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Versões (v1 × v2)</h2>
        {!report.reviewed_by_support_at && (
          <CampaignReportReviewed reportId={report.id} />
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {versions.map((version) => (
          <div key={version.id} className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs text-text-muted">
              v{version.version_number} · {version.status} · {version.asset_status}
            </p>
            {signedUrls[version.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrls[version.id] as string}
                alt={`Versão ${version.version_number}`}
                className="w-full rounded object-contain"
              />
            ) : (
              <p className="text-xs text-text-muted">Sem asset disponível.</p>
            )}
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-heading text-lg font-semibold">
        Histórico de tentativas (por attempt_number)
      </h2>
      {submissions.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhuma tentativa registrada.</p>
      ) : (
        <ul className="space-y-3">
          {submissions.map((submission) => (
            <li
              key={submission.id}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-heading text-xs font-semibold text-text-primary">
                  Tentativa #{submission.attempt_number}
                </span>
                <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                  {ANALYSIS_LABELS[submission.analysis_state] ?? submission.analysis_state}
                </span>
                {submission.category && (
                  <span className="font-mono text-[10px] text-text-muted">
                    {submission.category}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-text-secondary">{submission.text}</p>
              {submission.normalized_instruction && (
                <p className="mt-1 text-xs text-text-muted">
                  Instrução normalizada: {submission.normalized_instruction}
                </p>
              )}
              <p className="mt-1 text-[10px] text-text-muted">
                criada {formatTs(submission.created_at)} · concluída{" "}
                {formatTs(submission.completed_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
