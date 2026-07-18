import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { Card } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [{ count: totalUsers }, { data: recentActions }, { count: errorCampaigns }] =
    await Promise.all([
      supabaseAdmin.from("admin_audit_log").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("status", "error"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Operacional</h1>
        <p className="text-muted-foreground">Visão geral do console administrativo</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Total de Usuários</p>
            <p className="text-3xl font-bold">{totalUsers ?? 0}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Campanhas com Erro</p>
            <p className="text-3xl font-bold text-red-600">{errorCampaigns ?? 0}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Ações no Audit Log</p>
            <p className="text-3xl font-bold">{totalUsers ?? 0}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-3">Últimas Ações</h2>
          {recentActions && recentActions.length > 0 ? (
            <ul className="space-y-2">
              {recentActions.slice(0, 10).map((action: Record<string, unknown>) => (
                <li key={action.id as string} className="text-sm border-b pb-1 last:border-0">
                  <span className="font-medium">{action.action as string}</span>
                  {" — "}
                  <span className="text-muted-foreground">
                    {(action.reason as string)?.slice(0, 80)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(action.created_at as string).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma ação registrada</p>
          )}
        </div>
      </Card>
    </div>
  );
}
