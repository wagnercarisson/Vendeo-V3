import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import type { AdminUserSummary } from "@/lib/admin/schemas";
import { maskCnpj } from "@/lib/cnpj/mask";
import type { FreemiumStatus } from "@/lib/freemium/types";
import { formatDateBR } from "@/lib/formatters";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; freemiumStatus?: string; verificationStatus?: string; kind?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const search = sp.search ?? "";
  const freemiumFilter = sp.freemiumStatus ?? "";
  const verificationFilter = sp.verificationStatus ?? "";
  const storeKind = sp.kind ?? "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 20;

  const { data, error } = await supabaseAdmin.rpc("admin_get_users_summary", {
    p_search: search || null,
    p_page: page,
    p_page_size: pageSize,
    p_verification_status: verificationFilter || null,
    p_store_kind: storeKind,
  });

  if (error) {
    return <div className="text-destructive">Erro ao carregar usuários: {error.message}</div>;
  }

  const result = data as { data: AdminUserSummary[]; total: number };
  const totalPages = Math.ceil(result.total / pageSize);

  // Enrich with CNPJ and freemium status
  const storeIds = result.data.map(u => u.storeId).filter(Boolean) as string[];
  const { data: stores } = await supabaseAdmin
    .from("stores")
    .select("id, cnpj_normalized, cnpj_root_hash")
    .in("id", storeIds.length > 0 ? storeIds : ["none"]);

  const storeMap: Record<string, { cnpjNormalized: string | null; cnpjRootHash: string | null }> = {};
  for (const s of (stores ?? [])) {
    storeMap[s.id] = { cnpjNormalized: s.cnpj_normalized, cnpjRootHash: s.cnpj_root_hash };
  }

  // Fetch credit balances for freemium status calculation
  const { data: balances } = await supabaseAdmin
    .from("credit_balances")
    .select("store_id, balance, bonus_balance, purchased_balance")
    .in("store_id", storeIds.length > 0 ? storeIds : ["none"]);

  const balanceMap: Record<string, { balance: number; bonusBalance: number; purchasedBalance: number }> = {};
  for (const b of (balances ?? [])) {
    balanceMap[b.store_id] = {
      balance: b.balance ?? 0,
      bonusBalance: b.bonus_balance ?? 0,
      purchasedBalance: b.purchased_balance ?? 0,
    };
  }

  // Fetch entitlements for freemium status calculation
  const { data: entitlements } = await supabaseAdmin
    .from("freemium_entitlements")
    .select("store_id, benefit_type")
    .in("store_id", storeIds.length > 0 ? storeIds : ["none"]);

  const entitlementMap: Record<string, Set<string>> = {};
  for (const e of (entitlements ?? [])) {
    if (!entitlementMap[e.store_id]) entitlementMap[e.store_id] = new Set();
    entitlementMap[e.store_id].add(e.benefit_type);
  }

  const enrichedUsers = result.data.map((user) => {
    const storeInfo = user.storeId ? storeMap[user.storeId] : null;
    const userEntitlements = user.storeId ? entitlementMap[user.storeId] : undefined;
    const balanceInfo = user.storeId ? balanceMap[user.storeId] : undefined;
    const bonusBalance = balanceInfo?.bonusBalance ?? 0;
    const displayBalance = balanceInfo?.balance ?? user.balance ?? 0;

    let freemiumStatus: FreemiumStatus = "no_cnpj";
    if (storeInfo?.cnpjRootHash && storeInfo.cnpjRootHash !== "") {
      const hasOnboarding = userEntitlements?.has("onboarding") ?? false;
      const hasMonthly = userEntitlements?.has("monthly") ?? false;
      const hasAdminException = userEntitlements?.has("admin_exception") ?? false;
      const hasAnyFreemiumRecord = hasOnboarding || hasMonthly || hasAdminException;

      if (bonusBalance > 0) {
        freemiumStatus = "active";
      } else if (hasAnyFreemiumRecord) {
        freemiumStatus = "used";
      } else {
        freemiumStatus = "exhausted";
      }
    }

    const verificationStatus = (user as unknown as Record<string, unknown>).verificationStatus as string | undefined;
    const isTestStore = (user as unknown as Record<string, unknown>).isTestStore as boolean | undefined;

    return {
      ...user,
      balance: displayBalance,
      bonusBalance,
      purchasedBalance: balanceInfo?.purchasedBalance ?? user.purchasedBalance ?? 0,
      cnpjMasked: storeInfo?.cnpjNormalized ? maskCnpj(storeInfo.cnpjNormalized) : null,
      freemiumStatus,
      verificationStatus: verificationStatus || "unverified",
      isTestStore: isTestStore || false,
    };
  });

  const filteredUsers = freemiumFilter
    ? enrichedUsers.filter(u => u.freemiumStatus === freemiumFilter)
    : enrichedUsers;

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
        <select
          name="freemiumStatus"
          defaultValue={freemiumFilter}
          className="rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
        >
          <option value="">Todos (freemium)</option>
          <option value="no_cnpj">Sem CNPJ</option>
          <option value="active">Freemium ativo</option>
          <option value="used">Freemium usado</option>
          <option value="exhausted">Freemium esgotado</option>
        </select>
        <select
          name="verificationStatus"
          defaultValue={verificationFilter}
          className="rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
        >
          <option value="">Todas (verificação)</option>
          <option value="approved">Aprovado</option>
          <option value="review">Revisão</option>
          <option value="rejected">Recusado</option>
          <option value="defer">Adiado</option>
          <option value="unverified">Não verificado</option>
        </select>
        <select
          name="kind"
          defaultValue={storeKind}
          className="rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
        >
          <option value="all">Todos (tipo)</option>
          <option value="production">Produção</option>
          <option value="test">Teste</option>
        </select>
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
              <th className="px-3 py-2 text-left font-medium">CNPJ</th>
              <th className="px-3 py-2 text-left font-medium">Verificação</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2 text-right font-medium">Campanhas</th>
              <th className="px-3 py-2 text-right font-medium">Erros</th>
              <th className="px-3 py-2 text-left font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
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
                <td className="px-3 py-2 text-xs font-mono">{user.cnpjMasked ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {user.isTestStore ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/20 text-accent-amber text-[10px] font-heading font-semibold">TESTE</span>
                  ) : (() => {
                    const vStatus = user.verificationStatus;
                    const vColors: Record<string, string> = {
                      approved: "bg-accent-green/10 text-accent-green",
                      review: "bg-accent-amber/10 text-accent-amber",
                      rejected: "bg-accent-red/10 text-accent-red",
                      defer: "bg-accent-blue/10 text-accent-blue",
                    };
                    const vLabels: Record<string, string> = {
                      approved: "Aprovado",
                      review: "Revisão",
                      rejected: "Recusado",
                      defer: "Adiado",
                    };
                    return vStatus && vStatus !== "unverified" ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-heading font-semibold ${vColors[vStatus] || "bg-bg-elevated text-text-muted"}`}>
                        {vLabels[vStatus] || vStatus}
                      </span>
                    ) : <span className="text-text-muted text-[10px]">—</span>;
                  })()}
                </td>
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
                  {formatDateBR(user.createdAt)}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center">
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
        {filteredUsers.map((user: AdminUserSummary) => (
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
              Criado em {formatDateBR(user.createdAt)}
            </div>
          </Link>
        ))}
        {filteredUsers.length === 0 && (
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
                href={`/admin/users?page=${page - 1}${search ? `&search=${search}` : ""}${freemiumFilter ? `&freemiumStatus=${freemiumFilter}` : ""}${verificationFilter ? `&verificationStatus=${verificationFilter}` : ""}${storeKind !== "all" ? `&kind=${storeKind}` : ""}`}
                className="rounded-md border px-3 py-1 hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/users?page=${page + 1}${search ? `&search=${search}` : ""}${freemiumFilter ? `&freemiumStatus=${freemiumFilter}` : ""}${verificationFilter ? `&verificationStatus=${verificationFilter}` : ""}${storeKind !== "all" ? `&kind=${storeKind}` : ""}`}
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
