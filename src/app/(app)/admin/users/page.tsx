import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
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
    return <div className="text-red-600">Erro ao carregar usuários: {error.message}</div>;
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
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Buscar
        </button>
      </form>

      <div className="overflow-x-auto rounded-md border">
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
                    <span className="text-red-600 font-medium">{user.errorCampaigns}</span>
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
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum usuário encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
