import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";

interface PageProps {
  searchParams: {
    page?: string;
    action?: string;
    targetType?: string;
  };
}

const ACTION_LABELS: Record<string, string> = {
  credit_grant: "Concessão de Créditos",
  credit_adjustment: "Ajuste de Créditos",
  store_create_invite: "Criação de Loja",
  manual_refund: "Estorno Manual",
};

const TARGET_LABELS: Record<string, string> = {
  store: "Loja",
  user: "Usuário",
  campaign: "Campanha",
};

export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  await requireAdmin();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const filterAction = searchParams.action ?? "";
  const filterTargetType = searchParams.targetType ?? "";

  let query = supabaseAdmin.from("admin_audit_log").select("*", { count: "exact" });
  if (filterAction) query = query.eq("action", filterAction);
  if (filterTargetType) query = query.eq("target_type", filterTargetType);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return <div className="text-red-600">Erro ao carregar audit log: {error.message}</div>;
  }

  const entries = (data ?? []) as Array<Record<string, unknown>>;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Histórico de ações administrativas</p>
      </div>

      <form className="flex flex-wrap gap-2">
        <select
          name="action"
          defaultValue={filterAction}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todas as ações</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          name="targetType"
          defaultValue={filterTargetType}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todos os alvos</option>
          {Object.entries(TARGET_LABELS).map(([value, label]) => (
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

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Ação</th>
              <th className="px-3 py-2 text-left font-medium">Alvo</th>
              <th className="px-3 py-2 text-left font-medium">Motivo</th>
              <th className="px-3 py-2 text-left font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id as string} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2">
                  {ACTION_LABELS[entry.action as string] ?? (entry.action as string)}
                </td>
                <td className="px-3 py-2">
                  {TARGET_LABELS[entry.target_type as string] ?? (entry.target_type as string)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({entry.target_id as string})
                  </span>
                </td>
                <td className="px-3 py-2 text-xs max-w-xs truncate">
                  {entry.reason as string}
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date(entry.created_at as string).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma ação encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
