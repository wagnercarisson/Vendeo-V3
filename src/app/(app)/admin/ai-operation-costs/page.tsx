import { requireAdmin } from "@/lib/admin/require-admin";
import {
  OperationRunsService,
  OperationRunsUnavailableError,
} from "@/lib/ai-cost/operation-runs-service";
import type { Segment } from "@/lib/ai-cost/operation-runs-service";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";
import { KpisGrid } from "./kpis-grid";
import { OperationRunsTable } from "./operation-runs-table";
import { SegmentAggregations } from "./segment-aggregations";
import { AiOperationCostsFilters } from "./ai-operation-costs-filters";
import { CostBadgeLegend } from "./cost-badge";

export const dynamic = "force-dynamic";

/** Valores válidos do segmento econômico (D9) — espelham o enum do service. */
const SEGMENTS: Segment[] = [
  "test",
  "freemium/promotional",
  "paid",
  "manual/admin",
  "unknown",
];

interface SearchParams {
  periodStart?: string;
  periodEnd?: string;
  storeId?: string;
  operationRunType?: string;
  status?: string;
  provider?: string;
  model?: string;
  generationType?: string;
  operationRunId?: string;
  segment?: string;
  page?: string;
}

export default async function AdminAiOperationCostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Acesso negado. Apenas administradores podem acessar esta página.
      </div>
    );
  }

  const sp = await searchParams;

  // Filtros (D3/D9) — repassados ao service; a UI NUNCA recalcula KPIs/agregados.
  const segment =
    sp.segment && SEGMENTS.includes(sp.segment as Segment)
      ? (sp.segment as Segment)
      : null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const result = await (async () => {
    try {
      return await new OperationRunsService().listRuns({
        periodStart: sp.periodStart ?? null,
        periodEnd: sp.periodEnd ?? null,
        storeId: sp.storeId ?? null,
        operationRunType: sp.operationRunType ?? null,
        status: sp.status ?? null,
        provider: sp.provider ?? null,
        model: sp.model ?? null,
        generationType: sp.generationType ?? null,
        operationRunId: sp.operationRunId ?? null,
        segment,
        page,
      });
    } catch (err) {
      if (err instanceof OperationRunsUnavailableError) {
        return null;
      }
      throw err;
    }
  })();

  // 503 fail-closed (padrão F38): nunca presumir custo quando a leitura falha.
  if (result === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Custos de Operação
          </h1>
          <p className="text-sm text-muted-foreground">
            Apuração call-level de custos de IA por entrega — estimativas
            operacionais.
          </p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Serviço indisponível no momento. Tente novamente em alguns instantes.
        </div>
      </div>
    );
  }

  const filters = {
    periodStart: sp.periodStart ?? null,
    periodEnd: sp.periodEnd ?? null,
    storeId: sp.storeId ?? null,
    operationRunType: sp.operationRunType ?? null,
    status: sp.status ?? null,
    provider: sp.provider ?? null,
    model: sp.model ?? null,
    generationType: sp.generationType ?? null,
    operationRunId: sp.operationRunId ?? null,
    segment,
  };

  // Estado vazio: sem entregas no período filtrado (padrão metrics page).
  if (result.runs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Custos de Operação
          </h1>
          <p className="text-sm text-muted-foreground">
            Apuração call-level de custos de IA por entrega — estimativas
            operacionais.
          </p>
          <SemanticNotice />
        </div>
        <AiOperationCostsFilters filters={filters} />
        <EmptyState
          icon={Activity}
          title="Aguardando dados de geração"
          description="Os custos de operação aparecerão conforme campanhas e assinaturas visuais forem geradas."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Custos de Operação
        </h1>
        <p className="text-sm text-muted-foreground">
          Apuração call-level de custos de IA por entrega — estimativas
          operacionais, não custo financeiro reconciliado.
        </p>
        <SemanticNotice />
      </div>
      <AiOperationCostsFilters filters={filters} />
      <KpisGrid summary={result.summary} />
      <CostBadgeLegend />
      <OperationRunsTable runs={result.runs} />
      <SegmentAggregations aggregations={result.aggregations} />
    </div>
  );
}

/**
 * Aviso de semântica (F38.2.1-11 / D8): parâmetros econômicos correntes
 * (usd_brl_rate/credit_value_brl) valem SOMENTE para novas gerações — o
 * histórico exibido usa snapshots/backfill e NÃO é recalculado.
 */
function SemanticNotice() {
  return (
    <p
      className="mt-1 text-xs text-muted-foreground"
      data-testid="economic-parameters-warning"
    >
      Alterações nos parâmetros econômicos valem para novas gerações e não
      recalculam o histórico exibido.
    </p>
  );
}
