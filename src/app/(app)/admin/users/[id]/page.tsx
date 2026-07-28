import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CreditService } from "@/lib/credit/credit-service";
import { StoreCreationForm } from "./store-creation-form";
import { CreditGrantForm } from "./credit-grant-form";
import { hasValidPrivacyAcknowledgement } from "@/lib/legal/privacy";
import { getEffectiveConsent } from "@/lib/legal/consent";
import { getAcceptanceStatus, getStoreAcceptanceHistory } from "@/lib/legal/acceptance-service";
import { maskCnpj } from "@/lib/cnpj/mask";
import { FreemiumEntitlementService } from "@/lib/freemium/entitlement-service";
import type { FreemiumEntitlement, FreemiumStatus } from "@/lib/freemium/types";

const creditService = new CreditService();
const freemiumService = new FreemiumEntitlementService();

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const storeData = store as Record<string, unknown> | null;
  const storeId = typeof storeData?.id === "string" ? storeData.id : null;
  const storeName = typeof storeData?.name === "string" ? storeData.name : "Loja sem nome";
  const hasStore = storeData !== null;

  let balance = 0;
  let history: unknown[] = [];
  let campaigns: unknown[] = [];
  let freemiumStatus: FreemiumStatus = "no_cnpj";
  let entitlements: FreemiumEntitlement[] = [];

  // Legal status
  const privacyAcknowledged = await hasValidPrivacyAcknowledgement(userId);
  const communicationsConsent = await getEffectiveConsent(userId, "commercial_communications");
  let legalAcceptanceStatus: "current" | "outdated" | "never" | null = null;
  let acceptanceHistory: Record<string, unknown>[] = [];

  if (storeId) {
    balance = await creditService.getBalance(storeId);
    history = await creditService.getHistory(storeId);
    entitlements = await freemiumService.getHistoryByStore(storeId);

    const breakdown = await creditService.getBalanceBreakdown(storeId);
    const bonusBalance = breakdown.bonusBalance;

    const rootHash = storeData?.cnpj_root_hash as string ?? "";
    if (rootHash && rootHash !== "") {
      const hasOnboarding = entitlements.some(e => e.benefit_type === "onboarding");
      const hasMonthly = entitlements.some(e => e.benefit_type === "monthly");
      const hasAdminException = entitlements.some(e => e.benefit_type === "admin_exception");
      const hasAnyFreemiumRecord = hasOnboarding || hasMonthly || hasAdminException;

      if (bonusBalance > 0) {
        freemiumStatus = "active";
      } else if (hasAnyFreemiumRecord) {
        freemiumStatus = "used";
      } else {
        freemiumStatus = "exhausted";
      }
    }

    const termsStatus = await getAcceptanceStatus(storeId, "terms_of_service");
    const aupStatus = await getAcceptanceStatus(storeId, "acceptable_use");

    if (termsStatus === "current" && aupStatus === "current") {
      legalAcceptanceStatus = "current";
    } else if (termsStatus === "never" && aupStatus === "never") {
      legalAcceptanceStatus = "never";
    } else {
      legalAcceptanceStatus = "outdated";
    }

    acceptanceHistory = await getStoreAcceptanceHistory(storeId);

    const { data: campData } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(20);

    campaigns = (campData ?? []) as unknown[];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Detalhe do Usuário</h1>
        <p className="text-muted-foreground">ID: {userId}</p>
      </div>

      {!hasStore && (
        <div className="rounded-md border border-border bg-bg-surface p-4">
          <p className="font-medium text-text-primary">Usuário sem loja</p>
          <p className="text-sm text-muted-foreground mt-1">
            Este usuário ainda não possui uma loja. Crie uma loja para conceder acesso ao beta.
          </p>
          <StoreCreationForm userId={userId} />
          <div className="mt-3">
            <a href={`/admin/users/${userId}/create-test-store`} className="text-xs text-accent-amber hover:underline font-medium">
              Criar store de teste
            </a>
          </div>
        </div>
      )}

      {hasStore && storeData && (
        <>
          <div className="rounded-md border border-border bg-bg-surface p-4">
            <h2 className="text-lg font-semibold mb-2">Dados da Loja</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Nome</dt>
              <dd>{(storeData.name as string) ?? "—"}</dd>
              <dt className="text-muted-foreground">Segmento</dt>
              <dd>{(storeData.segment as string) ?? "—"}</dd>
              <dt className="text-muted-foreground">Saldo</dt>
              <dd className="font-semibold">{balance} créditos</dd>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-bg-surface p-4">
            <h2 className="text-lg font-semibold mb-3">Verificação Cadastral</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {storeData.is_test_store ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/20 text-accent-amber text-xs font-heading font-semibold">TESTE</span>
                ) : (() => {
                  const v = storeData.verification_status as string;
                  if (v === "approved") return <span className="text-accent-green">Aprovado</span>;
                  if (v === "review") return <span className="text-accent-amber">Em revisão</span>;
                  if (v === "rejected") return <span className="text-accent-red">Recusado</span>;
                  if (v === "defer") return <span className="text-accent-blue">Adiado</span>;
                  return <span className="text-muted-foreground">Não verificado</span>;
                })()}
              </dd>
              {(() => {
                const o = storeData.cnpj_official_data as Record<string, unknown> | null;
                if (!o) return null;
                return <>
                  <dt className="text-muted-foreground">Razão Social</dt>
                  <dd>{(o.razao_social as string) || "—"}</dd>
                  <dt className="text-muted-foreground">Situação</dt>
                  <dd>{(o.situacao_cadastral as string) || "—"}</dd>
                  <dt className="text-muted-foreground">Endereço</dt>
                  <dd className="text-xs">
                    {[o.logradouro, o.numero, o.bairro, o.cidade, o.uf].filter(Boolean).join(", ") || "—"}
                  </dd>
                </>;
              })()}
              {(() => {
                const reasons = storeData.verification_reasons as string[] | null;
                if (!reasons || reasons.length === 0) return null;
                return <>
                  <dt className="text-muted-foreground">Motivos</dt>
                  <dd className="text-xs">{reasons.join(", ")}</dd>
                </>;
              })()}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={`/api/admin/reviews/${storeId}/reveal-cnpj`} method="POST">
                <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg-elevated transition-all">
                  Revelar CNPJ
                </button>
              </form>
              {storeData.verification_status === "defer" && (
                <form action={`/api/admin/reviews/${storeId}/approve`} method="POST" className="inline">
                  <button type="submit" className="rounded-md bg-accent-blue px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 transition-all">
                    Reprocessar
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-bg-surface p-4">
            <h2 className="text-lg font-semibold mb-3">CNPJ e Freemium</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">CNPJ</dt>
              <dd className="font-mono">
                {storeData.cnpj_normalized
                  ? maskCnpj(storeData.cnpj_normalized as string)
                  : <span className="text-muted-foreground">—</span>}
              </dd>
              <dt className="text-muted-foreground">Status Freemium</dt>
              <dd>
                {freemiumStatus === "active" && <span className="text-accent-green">Freemium ativo</span>}
                {freemiumStatus === "used" && <span className="text-accent-amber">Freemium usado</span>}
                {freemiumStatus === "exhausted" && <span className="text-accent-red">Freemium esgotado</span>}
                {freemiumStatus === "no_cnpj" && <span className="text-muted-foreground">Sem CNPJ</span>}
              </dd>
            </dl>
            {entitlements.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Histórico de Entitlements</h3>
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Benefício</th>
                      <th className="px-2 py-1 text-left">Ciclo</th>
                      <th className="px-2 py-1 text-left">Motivo</th>
                      <th className="px-2 py-1 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entitlements.map(e => (
                      <tr key={e.id} className="border-t">
                        <td className="px-2 py-1">{e.benefit_type}</td>
                        <td className="px-2 py-1">{e.cycle ?? "—"}</td>
                        <td className="px-2 py-1">{e.reason ?? "—"}</td>
                        <td className="px-2 py-1 text-right text-xs">
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4">
              <a
                href={`/admin/users/${userId}/grant-freemium-exception`}
                className="rounded-md bg-accent-blue px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 transition-all inline-block"
              >
                Conceder exceção
              </a>
            </div>
          </div>

          <div className="rounded-md border border-border bg-bg-surface p-4">
            <h2 className="text-lg font-semibold mb-3">Situação Legal</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Privacidade</span>
                <span className={`text-sm font-medium ${privacyAcknowledged ? "text-accent-green" : "text-accent-red"}`}>
                  {privacyAcknowledged ? "✅ Ciente" : "❌ Não registrado"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Aceite Contratual</span>
                <span className={`text-sm font-medium ${
                  legalAcceptanceStatus === "current" ? "text-accent-green"
                  : legalAcceptanceStatus === "outdated" ? "text-accent-amber"
                  : "text-text-muted"
                }`}>
                  {legalAcceptanceStatus === "current" ? "✅ Vigente"
                    : legalAcceptanceStatus === "outdated" ? "⏳ Pendente"
                    : "❌ Nunca aceitou"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Consentimento</span>
                <span className={`text-sm font-medium ${
                  communicationsConsent === "granted" ? "text-accent-green"
                  : communicationsConsent === "revoked" ? "text-accent-amber"
                  : "text-text-muted"
                }`}>
                  {communicationsConsent === "granted" ? "✅ Consentimento ativo"
                    : communicationsConsent === "revoked" ? "⏳ Consentimento revogado"
                    : "❌ Nunca definido"}
                </span>
              </div>
            </div>

            {acceptanceHistory.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Histórico de Aceitação</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-2 py-1 text-left">Documento</th>
                        <th className="px-2 py-1 text-left">Versão</th>
                        <th className="px-2 py-1 text-right">Data</th>
                        <th className="px-2 py-1 text-left">Origem</th>
                        <th className="px-2 py-1 text-left">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(acceptanceHistory as Array<Record<string, unknown>>).map((entry) => (
                        <tr key={entry.id as string} className="border-t">
                          <td className="px-2 py-1">{entry.document_type as string}</td>
                          <td className="px-2 py-1">{entry.document_version as string}</td>
                          <td className="px-2 py-1 text-right text-xs">
                            {new Date(entry.accepted_at as string).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-2 py-1">{entry.acceptance_source as string}</td>
                          <td className="px-2 py-1 text-xs font-mono">{entry.ip_address as string}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md border border-border bg-bg-surface p-4">
            <h2 className="text-lg font-semibold mb-3">Conceder Créditos</h2>
            {storeId ? (
              <CreditGrantForm storeId={storeId} storeName={storeName} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Loja sem identificador valido. Nao e possivel conceder creditos.
              </p>
            )}
          </div>

          <div className="rounded-md border border-border bg-bg-surface p-4">
            <h2 className="text-lg font-semibold mb-3">Extrato</h2>
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Tipo</th>
                      <th className="px-2 py-1 text-right">Valor</th>
                      <th className="px-2 py-1 text-right">Saldo</th>
                      <th className="px-2 py-1 text-left">Motivo</th>
                      <th className="px-2 py-1 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(history as Array<Record<string, unknown>>).map((tx) => (
                      <tr key={tx.id as string} className="border-t">
                        <td className="px-2 py-1">{tx.type as string}</td>
                        <td className={`px-2 py-1 text-right ${(tx.amount as number) > 0 ? "text-success" : "text-destructive"}`}>
                          {(tx.amount as number) > 0 ? "+" : ""}{(tx.amount as number)}
                        </td>
                        <td className="px-2 py-1 text-right">{tx.balanceAfter as number}</td>
                        <td className="px-2 py-1">{(tx.reason as string) ?? "—"}</td>
                        <td className="px-2 py-1 text-xs">
                          {new Date(tx.createdAt as string).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma transação encontrada</p>
            )}
          </div>

          <div className="rounded-md border border-border bg-bg-surface p-4">
            <h2 className="text-lg font-semibold mb-3">Campanhas</h2>
            {campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Produto</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-left">Erro</th>
                      <th className="px-2 py-1 text-left">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(campaigns as Array<Record<string, unknown>>).map((camp) => (
                      <tr key={camp.id as string} className="border-t">
                        <td className="px-2 py-1">{(camp.product_name ?? camp.productName ?? "—") as string}</td>
                        <td className="px-2 py-1">
                          {(camp.status as string) === "error" ? (
                            <span className="text-destructive font-medium">error</span>
                          ) : (
                            camp.status as string
                          )}
                        </td>
                        <td className="px-2 py-1 text-xs text-destructive">
                          {(camp.error_message ?? camp.errorMessage ?? "") as string}
                        </td>
                        <td className="px-2 py-1 text-xs">
                          {new Date((camp.created_at ?? camp.createdAt) as string).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
