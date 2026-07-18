import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CreditService } from "@/lib/credit/credit-service";

const creditService = new CreditService();

interface PageProps {
  params: { id: string };
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  await requireAdmin();
  const userId = params.id;

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const storeData = store as Record<string, unknown> | null;
  const hasStore = storeData !== null;
  const storeId = storeData?.id as string | null;

  let balance = 0;
  let history: unknown[] = [];
  let campaigns: unknown[] = [];

  if (storeId) {
    balance = await creditService.getBalance(storeId);
    history = await creditService.getHistory(storeId);

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
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-800">Usuário sem loja</p>
          <p className="text-sm text-amber-700 mt-1">
            Este usuário ainda não possui uma loja. Crie uma loja para conceder acesso ao beta.
          </p>
          <div className="mt-3 space-y-2">
            <input
              id="storeName"
              name="storeName"
              placeholder="Nome da loja"
              className="block w-full rounded-md border px-3 py-2 text-sm"
            />
            <input
              id="segment"
              name="segment"
              placeholder="Segmento (ex: moda-calcados-acessorios)"
              className="block w-full rounded-md border px-3 py-2 text-sm"
            />
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              hx-post={`/api/admin/stores`}
              hx-vals={`{"userId":"${userId}","storeName":document.getElementById('storeName').value,"segment":document.getElementById('segment').value}`}
              hx-target="#store-result"
            >
              Criar Loja
            </button>
            <div id="store-result" />
          </div>
        </div>
      )}

      {hasStore && storeData && (
        <>
          <div className="rounded-md border p-4">
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

          <div className="rounded-md border p-4">
            <h2 className="text-lg font-semibold mb-3">Conceder Créditos</h2>
            <div className="space-y-2">
              <input
                id="grant-amount"
                type="number"
                min={1}
                placeholder="Quantidade"
                className="block w-full rounded-md border px-3 py-2 text-sm"
              />
              <textarea
                id="grant-reason"
                placeholder="Motivo (mínimo 10 caracteres)"
                className="block w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
              />
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                hx-post={`/api/admin/credits/grant`}
                hx-vals={`{"storeId":"${storeId}","amount":document.getElementById('grant-amount').value,"reason":document.getElementById('grant-reason').value,"operationId":crypto.randomUUID()}`}
                hx-target="#grant-result"
              >
                Conceder Créditos
              </button>
              <div id="grant-result" />
            </div>
          </div>

          <div className="rounded-md border p-4">
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
                        <td className={`px-2 py-1 text-right ${(tx.amount as number) > 0 ? "text-green-600" : "text-red-600"}`}>
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

          <div className="rounded-md border p-4">
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
                            <span className="text-red-600 font-medium">error</span>
                          ) : (
                            camp.status as string
                          )}
                        </td>
                        <td className="px-2 py-1 text-xs text-red-600">
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
