import Link from "next/link";
import { Fragment } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { maskCnpj } from "@/lib/cnpj/mask";
import { ReviewActions } from "@/components/admin/review-actions";
import { ReviewDetail } from "./review-detail";
import { VERIFICATION_REASON_LABELS } from "@/lib/admin/labels";
import { getLabel } from "@/lib/labels";
import { formatDateBR } from "@/lib/formatters";

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
    .select("id, name, user_id, created_at, verification_status, verification_reasons, verification_data, cnpj_normalized, cnpj_official_data, cnpj_root_hash, city, state, segment", { count: "exact" })
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

  const rootHashes = [...new Set(stores.map(s => s.cnpj_root_hash).filter(Boolean))];
  const { data: entitlements } = await supabaseAdmin
    .from("freemium_entitlements")
    .select("root_hash, benefit_type, cycle, reason, created_at")
    .in("root_hash", rootHashes.length > 0 ? rootHashes : ["none"]);
  const historyByRoot: Record<string, unknown[]> = {};
  for (const e of (entitlements ?? [])) {
    (historyByRoot[e.root_hash] ??= []).push(e);
  }

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
                  <StoreRows
                    key={store.id}
                    store={store}
                    userMap={userMap}
                    validTab={validTab}
                    history={historyByRoot[store.cnpj_root_hash ?? ""] ?? []}
                  />
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

function StoreRows({
  store,
  userMap,
  validTab,
  history,
}: {
  store: Record<string, unknown>;
  userMap: Record<string, string>;
  validTab: string;
  history: unknown[];
}) {
  const storeId = store.id as string;
  const storeName = store.name as string | null;
  const cnpjNormalized = store.cnpj_normalized as string | null;
  const userId = store.user_id as string;
  const createdAt = store.created_at as string;
  const reasons = (store.verification_reasons ?? []) as string[];

  return (
    <Fragment>
      <tr className="border-b hover:bg-bg-elevated/50">
        <td className="py-3 px-2">
          <Link href={`/admin/users/${userId}`} className="text-accent-blue hover:underline font-medium">
            {storeName}
          </Link>
        </td>
        <td className="py-3 px-2 text-text-muted font-mono text-xs">
          {cnpjNormalized ? maskCnpj(cnpjNormalized) : "—"}
        </td>
        <td className="py-3 px-2 text-text-muted">{userMap[userId] || "—"}</td>
        <td className="py-3 px-2 text-text-muted text-xs">
          {formatDateBR(createdAt)}
        </td>
        <td className="py-3 px-2">
          <div className="flex flex-wrap gap-1">
            {reasons.map((r: string) => (
              <span key={r} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-heading font-medium bg-bg-elevated text-text-muted">
                {getLabel(VERIFICATION_REASON_LABELS, r)}
              </span>
            ))}
          </div>
        </td>
        <td className="py-3 px-2">
          {(validTab === "review" || validTab === "defer" || validTab === "rejected") && (
            <ReviewActions storeId={storeId} tab={validTab as "review" | "defer" | "rejected"} />
          )}
        </td>
      </tr>
      <tr className="border-b hover:bg-bg-elevated/50">
        <td colSpan={6} className="py-2 px-2">
          <details>
            <summary className="cursor-pointer text-xs text-accent-blue hover:underline font-medium">
              Ver dados informados × oficiais
            </summary>
            <ReviewDetail
              store={{
                name: storeName,
                city: store.city as string | null | undefined,
                state: store.state as string | null | undefined,
                segment: store.segment as string | null | undefined,
                cnpj_official_data: store.cnpj_official_data as
                  | {
                      razao_social?: string | null;
                      nome_fantasia?: string | null;
                      cidade?: string | null;
                      uf?: string | null;
                      cnae_principal?: string | null;
                      cnae_descricao?: string | null;
                      situacao_cadastral?: string | null;
                    }
                  | null
                  | undefined,
              }}
              rootHistory={history as { benefit_type: string; cycle: string | null; created_at: string; reason: string | null }[]}
            />
          </details>
        </td>
      </tr>
    </Fragment>
  );
}
