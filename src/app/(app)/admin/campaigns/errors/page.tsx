import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import { formatDateTimeBR } from "@/lib/formatters";

export default async function AdminCampaignErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; include_test?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const includeTest = sp.include_test === "1";

  const query = supabaseAdmin
    .from("campaigns")
    .select("*, stores!inner(name, user_id, is_test_store)", { count: "exact" })
    .eq("status", "error");

  if (!includeTest) {
    query.eq("stores.is_test_store", false);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return <div className="text-destructive">Erro ao carregar campanhas: {error.message}</div>;
  }

  const campaigns = (data ?? []) as Array<Record<string, unknown>>;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  const storeUserIds = [...new Set(
    (data ?? []).map(
      (row: Record<string, unknown>) =>
        (row.stores as Record<string, unknown> | undefined)?.user_id as string,
    ).filter(Boolean) as string[],
  )];

  const emailMap = new Map<string, string>();
  if (storeUserIds.length > 0) {
    const { data: emails } = await supabaseAdmin.rpc("admin_get_user_emails", {
      p_user_ids: storeUserIds,
    });
    if (emails) {
      for (const entry of emails as Array<{ user_id: string; email: string }>) {
        emailMap.set(entry.user_id, entry.email);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Campanhas com Erro</h1>
        <p className="text-muted-foreground">Triagem de campanhas que falharam na geração</p>
      </div>

      <div className="flex items-center gap-4 mb-2">
        <Link
          href={includeTest ? "/admin/campaigns/errors" : "/admin/campaigns/errors?include_test=1"}
          className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors ${
            includeTest
              ? "bg-accent-amber/10 border-accent-amber/30 text-accent-amber"
              : "bg-muted border-border text-muted-foreground"
          }`}
        >
          {includeTest ? "⬡ Incluindo lojas de teste" : "☐ Incluir lojas de teste"}
        </Link>
        {includeTest && (
          <span className="text-xs text-muted-foreground">
            Lojas de teste aparecem com badge <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/20 text-accent-amber text-[10px] font-heading font-semibold">TESTE</span>
          </span>
        )}
      </div>

      <div className="hidden sm:block overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {includeTest && <th className="px-3 py-2 text-left font-medium w-10">T</th>}
              <th className="px-3 py-2 text-left font-medium">Produto</th>
              <th className="px-3 py-2 text-left font-medium">Loja</th>
              <th className="px-3 py-2 text-left font-medium">Usuário</th>
              <th className="px-3 py-2 text-left font-medium">Erro</th>
              <th className="px-3 py-2 text-left font-medium">Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((camp) => {
              const storeData = camp.stores as Record<string, unknown> | undefined;
              const isTest = storeData?.is_test_store === true;
              return (
              <tr key={camp.id as string} className={`border-t hover:bg-muted/50 ${isTest ? "opacity-70" : ""}`}>
                {includeTest && (
                  <td className="px-3 py-2">
                    {isTest ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/20 text-accent-amber text-[10px] font-heading font-semibold">T</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 font-medium">
                  {(camp.product_name as string) ?? (camp.productName as string) ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {storeData?.name as string ?? "—"}
                  {isTest && includeTest && (
                    <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/20 text-accent-amber text-[10px] font-heading font-semibold">TESTE</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {emailMap.get(storeData?.user_id as string) ?? "—"}
                </td>
                <td className="px-3 py-2">
                    <span className="inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {(camp.error_message as string) ?? (camp.errorMessage as string) ?? "Erro desconhecido"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {formatDateTimeBR((camp.updated_at ?? camp.updatedAt) as string)}
                </td>
              </tr>
            )})}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center">
                  <EmptyState
                    icon={ShieldCheck}
                    title="Nenhum erro registrado"
                    description="Tudo funcionando sem problemas."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="sm:hidden space-y-3">
        {campaigns.map((camp) => {
          const storeData = camp.stores as Record<string, unknown> | undefined;
          const isTest = storeData?.is_test_store === true;
          return (
            <div key={camp.id as string} className={`rounded-lg border p-3 space-y-1.5 ${isTest ? "border-accent-amber/20 bg-bg-surface opacity-80" : "border-border bg-bg-surface"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground truncate">
                  {(camp.product_name as string) ?? (camp.productName as string) ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2 flex items-center gap-1">
                  {storeData?.name as string ?? "—"}
                  {isTest && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/20 text-accent-amber text-[10px] font-heading font-semibold">TESTE</span>}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{emailMap.get(storeData?.user_id as string) ?? "—"}</span>
                <span>{formatDateTimeBR((camp.updated_at ?? camp.updatedAt) as string)}</span>
              </div>
              <div>
                <span className="inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {(camp.error_message as string) ?? (camp.errorMessage as string) ?? "Erro desconhecido"}
                </span>
              </div>
            </div>
          );
        })}
        {campaigns.length === 0 && (
          <div className="py-8">
            <EmptyState
              icon={ShieldCheck}
              title="Nenhum erro registrado"
              description="Tudo funcionando sem problemas."
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
