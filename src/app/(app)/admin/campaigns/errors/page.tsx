import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";

interface PageProps {
  searchParams: { page?: string };
}

export default async function AdminCampaignErrorsPage({ searchParams }: PageProps) {
  await requireAdmin();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabaseAdmin
    .from("campaigns")
    .select("*, stores(name)", { count: "exact" })
    .eq("status", "error")
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return <div className="text-red-600">Erro ao carregar campanhas: {error.message}</div>;
  }

  const campaigns = (data ?? []) as Array<Record<string, unknown>>;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Campanhas com Erro</h1>
        <p className="text-muted-foreground">Triagem de campanhas que falharam na geração</p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Produto</th>
              <th className="px-3 py-2 text-left font-medium">Loja</th>
              <th className="px-3 py-2 text-left font-medium">Erro</th>
              <th className="px-3 py-2 text-left font-medium">Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((camp) => (
              <tr key={camp.id as string} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2 font-medium">
                  {(camp.product_name as string) ?? (camp.productName as string) ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {(camp.stores as Record<string, unknown> | undefined)?.name as string ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {(camp.error_message as string) ?? (camp.errorMessage as string) ?? "Erro desconhecido"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date((camp.updated_at ?? camp.updatedAt) as string).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma campanha com erro encontrada
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
                href={`/admin/campaigns/errors?page=${page - 1}`}
                className="rounded-md border px-3 py-1 hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/campaigns/errors?page=${page + 1}`}
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
