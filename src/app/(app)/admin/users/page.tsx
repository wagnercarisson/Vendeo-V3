import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import type { AdminUserSummary } from "@/lib/admin/schemas";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const search = sp.search ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 20;

  const { data, error } = await supabaseAdmin.rpc("admin_get_users_summary", {
    p_search: search || null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    return <div className="text-destructive">Erro ao carregar usuários: {error.message}</div>;
  }

  const result = data as { data: AdminUserSummary[]; total: number };
  const totalPages = Math.ceil(result.total / pageSize);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Diretório de usuários e lojas</p>
      </div>

      <form className="flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Buscar por email, loja ou segmento..."
          className="flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Buscar
        </button>
      </form>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Loja</th>
              <th className="px-3 py-2 text-left font-medium">Segmento</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2 text-right font-medium">Campanhas</th>
              <th className="px-3 py-2 text-right font-medium">Erros</th>
              <th className="px-3 py-2 text-left font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((user: AdminUserSummary) => (
              <tr key={user.userId} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/users/${user.userId}`}
                    className="font-medium hover:text-primary"
                  >
                    {user.email}
                  </Link>
                </td>
                <td className="px-3 py-2">{user.storeName ?? "—"}</td>
                <td className="px-3 py-2">{user.segment ?? "—"}</td>
                <td className="px-3 py-2 text-right">{user.balance}</td>
                <td className="px-3 py-2 text-right">{user.totalCampaigns}</td>
                <td className="px-3 py-2 text-right">
                  {user.errorCampaigns > 0 ? (
                    <span className="text-destructive font-medium">{user.errorCampaigns}</span>
                  ) : (
                    user.errorCampaigns
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
            {result.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center">
                  <EmptyState
                    icon={Users}
                    title="Nenhum lojista cadastrado"
                    description="Aguardando o primeiro cadastro."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="sm:hidden space-y-3">
        {result.data.map((user: AdminUserSummary) => (
          <Link
            key={user.userId}
            href={`/admin/users/${user.userId}`}
            className="block rounded-lg border border-border bg-bg-surface p-3 space-y-1.5 hover:bg-bg-elevated transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-foreground truncate">{user.email}</span>
              <span className="text-xs text-muted-foreground">{user.storeName ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{user.segment ?? "—"}</span>
              <span className="tabular-nums">
                Saldo: {user.balance} · Campanhas: {user.totalCampaigns}
                {user.errorCampaigns > 0 && (
                  <span className="text-destructive ml-1">({user.errorCampaigns} err)</span>
                )}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Criado em {new Date(user.createdAt).toLocaleDateString("pt-BR")}
            </div>
          </Link>
        ))}
        {result.data.length === 0 && (
          <div className="py-8">
            <EmptyState
              icon={Users}
              title="Nenhum lojista cadastrado"
              description="Aguardando o primeiro cadastro."
            />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Mostrando página {page} de {totalPages} ({result.total} total)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/users?page=${page - 1}${search ? `&search=${search}` : ""}`}
                className="rounded-md border px-3 py-1 hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/users?page=${page + 1}${search ? `&search=${search}` : ""}`}
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
