import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import { AUDIT_ACTION_LABELS, TARGET_TYPE_LABELS } from "@/lib/admin/labels";
import { getLabel } from "@/lib/labels";
import { formatDateTimeBR } from "@/lib/formatters";

async function resolveActorEmails(entries: Array<Record<string, unknown>>): Promise<Map<string, string>> {
  const actorIds = [...new Set(entries.map((e) => e.actor_id as string))].filter(Boolean);
  const map = new Map<string, string>();
  if (actorIds.length === 0) return map;

  const { data: emails } = await supabaseAdmin.rpc("admin_get_user_emails", {
    p_user_ids: actorIds,
  });
  if (emails) {
    for (const entry of emails as Array<{ user_id: string; email: string }>) {
      map.set(entry.user_id, entry.email);
    }
  }
  return map;
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; targetType?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const filterAction = sp.action ?? "";
  const filterTargetType = sp.targetType ?? "";

  let query = supabaseAdmin.from("admin_audit_log").select("*", { count: "exact" });
  if (filterAction) query = query.eq("action", filterAction);
  if (filterTargetType) query = query.eq("target_type", filterTargetType);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return <div className="text-destructive">Erro ao carregar audit log: {error.message}</div>;
  }

  const entries = (data ?? []) as Array<Record<string, unknown>>;
  const totalPages = Math.ceil((count ?? 0) / pageSize);
  const actorEmailMap = await resolveActorEmails(entries);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico de auditoria</h1>
        <p className="text-muted-foreground">Histórico de ações administrativas</p>
      </div>

      <form className="flex flex-wrap gap-2">
        <select
          name="action"
          defaultValue={filterAction}
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="">Todas as ações</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          name="targetType"
          defaultValue={filterTargetType}
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="">Todos os alvos</option>
          {Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Filtrar
        </button>
      </form>

      <div className="hidden sm:block overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Ator</th>
              <th className="px-3 py-2 text-left font-medium">Ação</th>
              <th className="px-3 py-2 text-left font-medium">Alvo</th>
              <th className="px-3 py-2 text-left font-medium">Motivo</th>
              <th className="px-3 py-2 text-left font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id as string} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2 text-xs">
                  {actorEmailMap.get(entry.actor_id as string) ?? (entry.actor_id as string).slice(0, 8) + "…"}
                </td>
                <td className="px-3 py-2">
                  {getLabel(AUDIT_ACTION_LABELS, entry.action as string)}
                </td>
                <td className="px-3 py-2">
                  {getLabel(TARGET_TYPE_LABELS, entry.target_type as string)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({entry.target_id as string})
                  </span>
                </td>
                <td className="px-3 py-2 text-xs max-w-xs truncate">
                  {entry.reason as string}
                </td>
                <td className="px-3 py-2 text-xs">
                  {formatDateTimeBR(entry.created_at as string)}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma ação encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="sm:hidden space-y-3">
        {entries.map((entry) => (
          <div key={entry.id as string} className="rounded-lg border border-border bg-bg-surface p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                {actorEmailMap.get(entry.actor_id as string) ?? (entry.actor_id as string).slice(0, 8) + "…"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTimeBR(entry.created_at as string)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{getLabel(AUDIT_ACTION_LABELS, entry.action as string)}</span>
              <span className="text-xs text-muted-foreground">
                {getLabel(TARGET_TYPE_LABELS, entry.target_type as string)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{entry.reason as string}</p>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="py-8">
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma ação encontrada"
              description="Nenhuma ação administrativa registrada até o momento."
            />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Mostrando página {page} de {totalPages} ({count} total)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/audit-log?page=${page - 1}${filterAction ? `&action=${filterAction}` : ""}${filterTargetType ? `&targetType=${filterTargetType}` : ""}`}
                className="rounded-md border px-3 py-1 hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/audit-log?page=${page + 1}${filterAction ? `&action=${filterAction}` : ""}${filterTargetType ? `&targetType=${filterTargetType}` : ""}`}
                className="rounded-md border px-3 py-1 hover:bg-muted"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
