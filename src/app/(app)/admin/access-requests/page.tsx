import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import { formatDateTimeBR } from "@/lib/formatters";
import { getLabel } from "@/lib/labels";
import { AccessRequestActions } from "@/components/admin/access-request-actions";
import { STORE_SEGMENTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Recusados" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: "text-accent-amber",
  approved: "text-accent-green",
  rejected: "text-accent-red",
};

const SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
  STORE_SEGMENTS.map((segment) => [segment.value, segment.label]),
);

export default async function AdminAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
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
  const activeTab = TABS.some((tab) => tab.key === sp.tab) ? sp.tab! : "pending";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const { data: requests, error, count } = await supabaseAdmin
    .from("access_requests")
    .select("*", { count: "exact" })
    .eq("status", activeTab)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return (
      <div className="text-destructive">
        Erro ao carregar solicitações: {error.message}
      </div>
    );
  }

  const rows = (requests ?? []) as Array<Record<string, unknown>>;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-bold">
        Solicitações de acesso
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Pedidos de acesso free da landing pública — aprovação/recusa registrada
        no histórico de auditoria.
      </p>

      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/access-requests?tab=${tab.key}`}
            className={`border-b-2 px-4 py-2 font-heading text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma solicitação"
          description={`Nenhuma solicitação ${
            activeTab === "pending"
              ? "pendente"
              : activeTab === "approved"
                ? "aprovada"
                : "recusada"
          } até o momento.`}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-text-muted">
                  <th className="px-2 py-3 text-left font-heading font-semibold">Email</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Nome</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Loja</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Segmento</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">WhatsApp</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Fonte</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Criado em</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Status</th>
                  <th className="px-2 py-3 text-left font-heading font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr key={request.id as string} className="border-b hover:bg-bg-elevated/50">
                    <td className="px-2 py-3">{request.email as string}</td>
                    <td className="px-2 py-3 text-text-muted">
                      {(request.name as string) || "—"}
                    </td>
                    <td className="px-2 py-3 text-text-muted">
                      {(request.store_name as string) || "—"}
                    </td>
                    <td className="px-2 py-3 text-text-muted">
                      {request.segment
                        ? (SEGMENT_LABELS[request.segment as string] ??
                          (request.segment as string))
                        : "—"}
                    </td>
                    <td className="px-2 py-3 text-text-muted">
                      {(request.whatsapp as string) || "—"}
                    </td>
                    <td className="px-2 py-3 text-text-muted">
                      {(request.source as string) || "—"}
                    </td>
                    <td className="px-2 py-3 text-xs text-text-muted">
                      {formatDateTimeBR(request.created_at as string)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center rounded-full bg-bg-elevated px-2 py-0.5 font-heading text-[10px] font-medium ${
                          STATUS_BADGE_CLASSES[request.status as string] ?? ""
                        }`}
                      >
                        {getLabel(STATUS_LABELS, request.status as string)}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <AccessRequestActions
                        requestId={request.id as string}
                        status={request.status as string}
                      />
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
                  href={`/admin/access-requests?tab=${activeTab}&page=${p}`}
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
