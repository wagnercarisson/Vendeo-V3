import type { OperationRunsAggregations } from "@/lib/ai-cost/operation-runs-service";

const SEGMENT_LABELS: Record<string, string> = {
  test: "Teste",
  "freemium/promotional": "Freemium/promocional",
  paid: "Pago",
  "manual/admin": "Manual/admin",
  unknown: "Desconhecido",
};

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  campaign_delivery: "Campanha",
  visual_signature: "Assinatura visual",
  brand_profile: "Perfil de marca",
  theme: "Tema",
  unknown: "Desconhecido",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Sucesso",
  failed: "Falha",
  unknown: "Desconhecido",
};

function formatBRL(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function label(key: string, map: Record<string, string>): string {
  return map[key] ?? key;
}

/**
 * Agregados do painel (D3/D9) — consumidos do service sobre o conjunto
 * filtrado inteiro; a UI nunca calcula. Prioridade visual para o bloco por
 * segmento econômico (D9): custo, resultado estimado, margem estimada % e
 * taxa de erro por segmento; depois as distribuições por hora/owner/loja/tipo/
 * status.
 */
export function SegmentAggregations({
  aggregations,
}: {
  aggregations: OperationRunsAggregations;
}) {
  const segmentEntries = Object.entries(aggregations.bySegment);

  return (
    <section aria-label="Agregados" className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Agregados por segmento econômico
        </h2>
        <p className="text-xs text-muted-foreground">
          Origem operacional do consumo (D9) — não lucratividade real.
        </p>
        {segmentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado de segmento disponível.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {segmentEntries.map(([segment, agg]) => (
              <div
                key={segment}
                className="rounded-lg border border-border bg-bg-surface p-4"
                data-testid={`segment-card-${segment}`}
              >
                <div className="mb-2 text-sm font-semibold">
                  {SEGMENT_LABELS[segment] ?? segment}
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Entregas</dt>
                    <dd>{formatNumber(agg.entregas)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Custo (BRL)</dt>
                    <dd>{formatBRL(agg.custoBrl)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Resultado estimado</dt>
                    <dd>{formatBRL(agg.resultadoEstimadoBrl)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Margem estimada</dt>
                    <dd>{formatPercent(agg.margemEstimadaPct)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Taxa de erro</dt>
                    <dd>{formatPercent(agg.taxaErro)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AggregateBlock
          title="Gerações por tipo de entrega"
          data={aggregations.byDeliveryType}
          labelMap={DELIVERY_TYPE_LABELS}
        />
        <AggregateBlock
          title="Gerações por etapa"
          data={aggregations.byStage}
        />
        <AggregateBlock
          title="Gerações por provider/model"
          data={aggregations.byProviderModel}
        />
        <AggregateBlock
          title="Gerações por status"
          data={aggregations.byStatus}
          labelMap={STATUS_LABELS}
        />
        <AggregateBlock
          title="Gerações por loja"
          data={Object.fromEntries(
            Object.entries(aggregations.byStore).map(([key, store]) => [
              key,
              store.entregas,
            ]),
          )}
          valueLabel={(key) =>
            aggregations.byStore[key]?.storeName ?? "Desconhecida"
          }
        />
        <AggregateBlock
          title="Gerações por owner"
          data={Object.fromEntries(
            Object.entries(aggregations.byOwner).map(([key, owner]) => [
              key,
              owner.entregas,
            ]),
          )}
          valueLabel={(key) =>
            aggregations.byOwner[key]?.ownerId ? key : "Desconhecido"
          }
        />
        <AggregateBlock
          title="Gerações por hora (UTC)"
          data={Object.fromEntries(
            Object.entries(aggregations.byHour).map(([key, value]) => [
              `${String(key).padStart(2, "0")}h`,
              value,
            ]),
          )}
        />
      </div>
    </section>
  );
}

function AggregateBlock({
  title,
  data,
  labelMap,
  valueLabel,
}: {
  title: string;
  data: Record<string, number>;
  labelMap?: Record<string, string>;
  valueLabel?: (key: string) => string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">Sem dados.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1 text-sm">
        {entries.slice(0, 12).map(([key, count]) => (
          <li key={key} className="flex justify-between gap-2">
            <span className="truncate text-muted-foreground">
              {valueLabel ? valueLabel(key) : labelMap ? label(key, labelMap) : key}
            </span>
            <span className="font-medium">{formatNumber(count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
