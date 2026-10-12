import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import {
  SupabasePendingOperationsRepository,
  type PendingOperationView,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import {
  PendingOperationsList,
  PendingReadOnlyNotice,
  ResolutionForm,
  type PendingOperationItem,
} from "./resolution-form";

/**
 * F56.2b1b (Plano 07, Superfície 4 / UI-SPEC) — página administrativa das
 * pendências do Produto 1:1.
 *
 * A lista é SOMENTE-LEITURA e a resolução é por EVIDÊNCIA derivada server-side
 * (F5): a página lê as pendências persistidas (estado de crédito + claims +
 * sonda de arte) e as entrega ao painel client. NENHUMA geração é reiniciada,
 * reenfileirada ou enviada automaticamente ao provedor.
 */

export const dynamic = "force-dynamic";

function mapItem(view: PendingOperationView): PendingOperationItem {
  return {
    campaignId: view.campaignId,
    operationId: view.operationId,
    storeId: view.storeId,
    status: view.status,
    amount: view.amount,
    artifactKind: view.artifactKind,
    processing: view.processing,
    unknown: view.unknown,
    terminal: view.terminal,
    supportReference: view.supportReference,
    createdAt: view.createdAt,
    latestAttemptAt: view.latestAttemptAt,
  };
}

export default async function AdminProductOneToOnePendingPage() {
  let views: PendingOperationView[] = [];
  let readError = false;
  try {
    views = await new SupabasePendingOperationsRepository().listPendingOperations();
  } catch {
    readError = true;
  }

  const operations = views.map(mapItem);

  return (
    <div className="space-y-6">
      {/* Região A — header */}
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
          Operação de IA
        </div>
        <h1 className="font-heading text-2xl font-bold text-text-primary sm:text-3xl">
          Pendências do Produto 1:1
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Operações de geração que aguardam resolução por evidência. Esta superfície não executa
          geração.
        </p>
      </header>

      {/* Região B — aviso permanente de somente-leitura */}
      <PendingReadOnlyNotice />

      {/* Região C — lista de pendências (ou estado vazio / erro de leitura) */}
      <section aria-labelledby="pending-list-heading" className="space-y-3">
        <h2
          id="pending-list-heading"
          className="font-heading text-lg font-semibold text-text-primary"
        >
          Pendências
        </h2>
        {readError ? (
          <Card className="p-6">
            <ErrorState
              title="Não foi possível carregar as pendências"
              description="Recarregue a página."
            />
          </Card>
        ) : (
          <PendingOperationsList operations={operations} />
        )}
      </section>

      {/* Região D — painel de resolução (client) */}
      {operations.length > 0 && <ResolutionForm item={operations[0]} />}
    </div>
  );
}
