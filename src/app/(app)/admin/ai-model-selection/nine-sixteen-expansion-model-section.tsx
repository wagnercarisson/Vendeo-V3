import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buildNineSixteenExpansionConfigView } from "@/lib/ai/nine-sixteen-expansion-model-config-view";
import type { NineSixteenExpansionCoverageStatus } from "@/lib/ai/nine-sixteen-expansion-model-config-view";
import type { ExpansionSelectionOrigin } from "@/lib/ai/nine-sixteen-expansion-model-config";
import { NineSixteenExpansionModelForm } from "./nine-sixteen-expansion-model-form";

/**
 * Seção "Imagem de campanhas — Expansão 9:16" da página unificada de modelos
 * (F60.6, D7). Componente de servidor: lê a view própria da expansão uma única
 * vez e compõe o estado vigente + a cobertura das quatro combinações + o
 * formulário cliente.
 *
 * Não renderiza marcador nem rótulo de ativação: selecionar modelo e qualidade não
 * ativa o fluxo. A seção não lê o par 1:1, a seleção legada nem o snapshot da
 * base quadrada.
 */
export const dynamic = "force-dynamic";

const SCOPE_BODY =
  "Esta configuração afeta somente novas operações de expansão 9:16. Não altera a base quadrada nem o fluxo Produto 1:1, e operações já iniciadas continuam usando a seleção congelada na abertura.";

function combinationLabel(selection: { model: string; quality: string }): string {
  return `${selection.model} · ${selection.quality}`;
}

function originLabel(origin: ExpansionSelectionOrigin): string {
  return origin === "legacy_sunburst_low" ? "Legado Sunburst low" : "Configurada";
}

function coverageLabel(
  coverage: NineSixteenExpansionCoverageStatus["pricingCoverage"],
): string {
  if (coverage === "complete") return "Completa";
  if (coverage === "partial") return "Parcial";
  return "Ausente";
}

function coverageVariant(
  coverage: NineSixteenExpansionCoverageStatus["pricingCoverage"],
): "ready" | "generating" | "error" {
  if (coverage === "complete") return "ready";
  if (coverage === "partial") return "generating";
  return "error";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR");
}

export async function NineSixteenExpansionModelSection() {
  const view = await buildNineSixteenExpansionConfigView();
  const current = view.current;

  const coverageRows = view.eligibleModels.flatMap((model) =>
    view.eligibleQualities.map((quality) => ({
      model,
      quality,
      status: view.targetCoverageByCombination[`${model}|${quality}`],
    })),
  );

  return (
    <section
      id="expansao-9-16-imagem"
      aria-labelledby="nine-sixteen-expansion-heading"
      className="scroll-mt-6 space-y-6 border-t border-border pt-8"
    >
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
          Operação de IA
        </div>
        <h2
          id="nine-sixteen-expansion-heading"
          className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
        >
          Imagem de campanhas — Expansão 9:16
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Defina o modelo e a qualidade usados na expansão 9:16. A escolha vale apenas para
          novas operações de expansão e é registrada com auditoria e motivo obrigatório.
        </p>
      </header>

      <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-blue" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-heading text-sm font-semibold text-text-primary">
              Escopo da expansão 9:16
            </p>
            <p className="text-sm text-text-secondary">{SCOPE_BODY}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3
          id="nine-sixteen-expansion-current-heading"
          className="font-heading text-lg font-semibold text-text-primary"
        >
          Seleção vigente
        </h3>

        {view.state === "read_failed" ? (
          <Card className="p-6">
            <ErrorState
              title="Falha ao carregar a configuração"
              description="Não foi possível ler a configuração da expansão 9:16. Isso não significa ausência de configuração. Recarregue a página."
            />
          </Card>
        ) : view.state === "invalid" ? (
          <Card className="p-6">
            <ErrorState
              title="Configuração inválida"
              description="Existe uma configuração registrada para a expansão 9:16, mas ela está fora do catálogo elegível. Ajuste a combinação abaixo para regularizar."
            />
          </Card>
        ) : !view.configured || !current ? (
          <Card className="p-6">
            <EmptyState
              title="Nenhuma configuração registrada"
              description="Não há configuração de expansão 9:16 registrada. Enquanto ela estiver ausente, novas expansões não são iniciadas. Defina a combinação abaixo para regularizar."
            />
          </Card>
        ) : (
          <Card className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Modelo e qualidade
                </p>
                <p className="mt-1 break-words text-sm text-text-primary">
                  {combinationLabel(current)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Origem
                </p>
                <p className="mt-1">
                  <span className="inline-flex items-center rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-0.5 font-heading text-xs font-semibold text-accent-blue">
                    {originLabel(current.origin)}
                  </span>
                </p>
              </div>
            </div>

            {view.configVersionId && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="text-text-muted">Versão</span>
                <code className="font-mono text-xs text-text-primary">{view.configVersionId}</code>
              </div>
            )}

            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Autor
                </dt>
                <dd className="mt-1 break-words text-text-primary">{view.updatedBy ?? "—"}</dd>
              </div>
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Atualizado em
                </dt>
                <dd className="mt-1 break-words text-text-primary">
                  {formatTimestamp(view.updatedAt)}
                </dd>
              </div>
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3 sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Motivo da última alteração
                </dt>
                <dd className="mt-1 break-words text-text-primary">{view.reason ?? "—"}</dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Cobertura de pricing
              </p>
              <ul className="space-y-2">
                {coverageRows.map(({ model, quality, status }) => (
                  <li
                    key={`${model}|${quality}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-deep/40 p-3 text-xs"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <code className="font-mono text-xs text-text-primary">{model}</code>
                      <span className="text-text-secondary">· {quality}</span>
                    </span>
                    {status && (
                      <span className="[&>span]:font-semibold">
                        <Badge variant={coverageVariant(status.pricingCoverage)}>
                          {coverageLabel(status.pricingCoverage)}
                        </Badge>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </div>

      <NineSixteenExpansionModelForm view={view} />
    </section>
  );
}
