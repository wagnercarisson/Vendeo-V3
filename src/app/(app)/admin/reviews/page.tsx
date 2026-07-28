import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { maskCnpj } from "@/lib/cnpj/mask";
import { ReviewActions } from "@/components/admin/review-actions";

const REASON_LABELS: Record<string, string> = {
  nome_divergente: "Nome divergente",
  cidade_divergente: "Cidade divergente",
  uf_divergente: "UF divergente",
  situacao_suspensa: "Situação suspensa",
  api_unavailable: "API indisponível",
  cnpj_baixada: "CNPJ baixado",
  cnpj_nula: "CNPJ nulo",
  root_already_used: "Raiz já usada",
};

const TABS = [
  { key: "review", label: "Pendentes" },
  { key: "defer", label: "Adiados" },
  { key: "rejected", label: "Recusados" },
  { key: "approved", label: "Aprovados" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; reason?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const activeTab = sp.tab ?? "review";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const reasonFilter = sp.reason ?? "";
  const pageSize = 20;

  const validTab = TABS.find(t => t.key === activeTab) ? activeTab : "review";

  let query = supabaseAdmin
    .from("stores")
    .select("id, name, user_id, created_at, verification_status, verification_reasons, verification_data, cnpj_normalized, cnpj_official_data", { count: "exact" })
    .eq("verification_status", validTab)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (reasonFilter) {
    query = query.contains("verification_reasons", [reasonFilter]);
  }

  const { data: stores, error, count } = await query;

  if (error) {
    return <div className="text-destructive">Erro ao carregar revisões: {error.message}</div>;
  }

  const userIds = [...new Set(stores.map(s => s.user_id))];
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  const userMap: Record<string, string> = {};
  for (const u of (users ?? [])) userMap[u.id] = u.email;

  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-6">Revisão Cadastral</h1>

      <div className="flex gap-1 mb-6 border-b">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={`/admin/reviews?tab=${tab.key}`}
            className={`px-4 py-2 text-sm font-heading font-semibold border-b-2 transition-colors ${
              validTab === tab.key
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {(!stores || stores.length === 0) ? (
        <p className="text-text-muted text-sm">Nenhuma loja encontrada.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-2 font-heading font-semibold">Loja</th>
                  <th className="text-left py-3 px-2 font-heading font-semibold">CNPJ</th>
                  <th className="text-left py-3 px-2 font-heading font-semibold">Email</th>
                  <th className="text-left py-3 px-2 font-heading font-semibold">Data</th>
                  <th className="text-left py-3 px-2 font-heading font-semibold">Motivos</th>
                  <th className="text-left py-3 px-2 font-heading font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {stores.map(store => (
                  <tr key={store.id} className="border-b hover:bg-bg-elevated/50">
                    <td className="py-3 px-2">
                      <Link href={`/admin/users/${store.user_id}`} className="text-accent-blue hover:underline font-medium">
                        {store.name}
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-text-muted font-mono text-xs">
                      {store.cnpj_normalized ? maskCnpj(store.cnpj_normalized) : "—"}
                    </td>
                    <td className="py-3 px-2 text-text-muted">{userMap[store.user_id] || "—"}</td>
                    <td className="py-3 px-2 text-text-muted text-xs">
                      {new Date(store.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {(store.verification_reasons || []).map((r: string) => (
                          <span key={r} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-heading font-medium bg-bg-elevated text-text-muted">
                            {REASON_LABELS[r] || r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      {(validTab === "review" || validTab === "defer" || validTab === "rejected") && (
                        <ReviewActions storeId={store.id} tab={validTab as "review" | "defer" | "rejected"} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Link
                  key={p}
                  href={`/admin/reviews?tab=${validTab}&page=${p}`}
                  className={`min-w-[32px] h-8 flex items-center justify-center text-xs font-heading font-semibold rounded ${
                    p === page ? "bg-accent-blue text-white" : "text-text-muted hover:text-text-primary"
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
