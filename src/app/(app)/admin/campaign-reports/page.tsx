import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { listCorrectionReports } from "@/lib/campaign/correction-reports";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import { formatDateTimeBR } from "@/lib/formatters";
import type {
  CorrectionAnalysisState,
  CorrectionReportStatus,
} from "@/lib/campaign/types";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: CorrectionReportStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "open", label: "Aberto" },
  { value: "generation_started", label: "Geração iniciada" },
  { value: "v2_generated", label: "V2 gerada" },
  { value: "failed_no_v2", label: "Falhou sem v2" },
];

const ANALYSIS_OPTIONS: Array<{ value: CorrectionAnalysisState | ""; label: string }> = [
  { value: "", label: "Todas" },
  { value: "analyzing", label: "Analisando" },
  { value: "eligible", label: "Elegível" },
  { value: "blocked", label: "Bloqueado" },
  { value: "unclear", label: "Não claro" },
  { value: "analysis_failed", label: "Falha de análise" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);
const ANALYSIS_LABELS: Record<string, string> = Object.fromEntries(
  ANALYSIS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

const REVIEW_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "unreviewed", label: "Não revisados" },
  { value: "reviewed", label: "Revisados" },
] as const;

interface SearchParams {
  status?: string;
  analysisState?: string;
  reviewed?: string;
  page?: string;
}

export default async function AdminCampaignReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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

  const sp = await searchParams;
  const status = (sp.status ?? "") as CorrectionReportStatus | "";
  const analysisState = (sp.analysisState ?? "") as CorrectionAnalysisState | "";
  const reviewed = (sp.reviewed ?? "") as "" | "reviewed" | "unreviewed";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  // Decisão corrente = analysis_state da tentativa de maior attempt_number
  // (resolvido no serviço, nunca por created_at).
  const result = await listCorrectionReports({
    filters: {
      ...(status ? { status } : {}),
      ...(analysisState ? { analysisState } : {}),
      ...(reviewed ? { reviewed } : {}),
    },
    page,
    pageSize: 20,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const buildHref = (overrides: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const next = {
      status: status || undefined,
      analysisState: analysisState || undefined,
      reviewed: reviewed || undefined,
      page: String(page),
      ...overrides,
    };
    if (next.status) params.set("status", next.status);
    if (next.analysisState) params.set("analysisState", next.analysisState);
    if (next.reviewed) params.set("reviewed", next.reviewed);
    if (next.page && next.page !== "1") params.set("page", next.page);
    const qs = params.toString();
    return `/admin/campaign-reports${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-bold">Relatos de correção</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Casos de não conformidade da arte (F37.2) — decisão corrente derivada da
        tentativa de maior <code>attempt_number</code>.
      </p>

      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Status do caso
          <select
            name="status"
            defaultValue={status}
            className="rounded border border-border bg-bg-surface px-2 py-1 text-sm text-text-primary"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Análise vigente
          <select
            name="analysisState"
            defaultValue={analysisState}
            className="rounded border border-border bg-bg-surface px-2 py-1 text-sm text-text-primary"
          >
            {ANALYSIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Revisão
          <select
            name="reviewed"
            defaultValue={reviewed}
            className="rounded border border-border bg-bg-surface px-2 py-1 text-sm text-text-primary"
          >
            {REVIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-accent-green px-3 py-1.5 font-heading text-sm font-semibold text-white hover:brightness-110"
        >
          Filtrar
        </button>
        <Link
          href="/admin/campaign-reports"
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Limpar
        </Link>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum relato"
          description="Nenhum caso de correção corresponde aos filtros selecionados."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-text-muted">
                  <th className="px-2 py-3 text-left font-heading font-semibold">Campanha</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Loja</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Status do caso</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Decisão corrente</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">V1 relatada</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">V2 gerada</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Criado em</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Revisado</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map(({ report, currentSubmission }) => (
                  <tr key={report.id} className="border-b hover:bg-bg-elevated/50">
                    <td className="px-2 py-3">
                      <Link
                        href={`/admin/campaign-reports/${report.id}`}
                        className="font-mono text-xs text-accent-blue hover:underline"
                      >
                        {report.campaign_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-text-muted">
                      {report.store_id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-3">
                      {STATUS_LABELS[report.status] ?? report.status}
                    </td>
                    <td className="px-2 py-3">
                      {currentSubmission
                        ? `${ANALYSIS_LABELS[currentSubmission.analysis_state] ?? currentSubmission.analysis_state} (#${currentSubmission.attempt_number})`
                        : "—"}
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-text-muted">
                      {report.reported_version_id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-text-muted">
                      {report.generated_version_id
                        ? report.generated_version_id.slice(0, 8)
                        : "—"}
                    </td>
                    <td className="px-2 py-3 text-xs text-text-muted">
                      {formatDateTimeBR(report.created_at)}
                    </td>
                    <td className="px-2 py-3 text-xs">
                      {report.reviewed_by_support_at ? (
                        <span className="text-accent-green">Revisado</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={buildHref({ page: String(p) })}
                  className={`flex h-8 min-w-[32px] items-center justify-center rounded font-heading text-xs font-semibold ${
                    p === page
                      ? "bg-accent-blue text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
