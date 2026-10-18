import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buildImageModelPairConfigView } from "@/lib/ai/image-model-pair-config-view";
import type { ImageModelPair } from "@/lib/ai/image-model-pair";
import type { ImagePairPricingCoverage } from "@/lib/ai-cost/types";
import { ImageModelPairConfigForm, ImageModelPairScopeBanner } from "../image-model-pair/form";

/**
 * Seção "Imagem de campanhas — Produto 1:1" da página unificada de modelos.
 *
 * Componente de servidor que reutiliza integralmente a leitura e o formulário do
 * antigo `/admin/image-model-pair` (mesmo `buildImageModelPairConfigView`, mesmo
 * endpoint `/api/admin/image-model-pair`). A composição na página única não
 * altera contrato, validações, RPCs nem persistência.
 */
export const dynamic = "force-dynamic";

function pairLabel(pair: ImageModelPair): string {
  return `${pair.model} · ${pair.quality}`;
}

function coverageLabel(coverage: ImagePairPricingCoverage): string {
  if (coverage === "complete") return "Completa";
  if (coverage === "partial") return "Parcial";
  return "Ausente";
}

function coverageVariant(coverage: ImagePairPricingCoverage): "ready" | "generating" | "error" {
  if (coverage === "complete") return "ready";
  if (coverage === "partial") return "generating";
  return "error";
}

function originLabel(origin: "human_decision" | "selection"): string {
  return origin === "human_decision" ? "Decisão humana" : "Seleção";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR");
}

export async function ProductOneToOneImageModelSection() {
  const view = await buildImageModelPairConfigView();
  const current = view.current;

  return (
    <section
      id="produto-1-1-imagem"
      aria-labelledby="product-1-1-image-heading"
      className="scroll-mt-6 space-y-6 border-t border-border pt-8"
    >
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
          Operação de IA
        </div>
        <h2 id="product-1-1-image-heading" className="font-heading text-2xl font-bold text-text-primary sm:text-3xl">
          Imagem de campanhas — Produto 1:1
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Defina o par principal e o fallback (modelo + qualidade) do fluxo Produto 1:1.
          Restrito ao catálogo elegível, com auditoria e motivo obrigatório.
        </p>
      </header>

      <ImageModelPairScopeBanner />

      <div className="space-y-3">
        <h3 id="current-pair-heading" className="font-heading text-lg font-semibold text-text-primary">
          Par vigente
        </h3>

        {view.readError ? (
          <Card className="p-6">
            <ErrorState
              title="Falha ao carregar a configuração"
              description="Não foi possível carregar a configuração do par de modelos. Recarregue a página."
            />
          </Card>
        ) : !view.configured || !current ? (
          <Card className="p-6">
            <EmptyState
              title="Nenhuma configuração registrada"
              description="Defina o par principal e o fallback do fluxo Produto 1:1. A escolha é registrada como decisão humana e a habilitação do fluxo é controlada separadamente."
            />
          </Card>
        ) : (
          <Card className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Par principal</p>
                <p className="mt-1 break-words text-sm text-text-primary">{pairLabel(current.primary)}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Par fallback</p>
                <p className="mt-1 break-words text-sm text-text-primary">{pairLabel(current.fallback)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <span className="flex items-center gap-2">
                <span className="text-text-muted">Origem</span>
                <span className="inline-flex items-center rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-0.5 font-heading text-xs font-semibold text-accent-blue">
                  {view.origin ? originLabel(view.origin) : "Seleção"}
                </span>
              </span>
              {view.configVersionId && (
                <span className="flex items-center gap-2">
                  <span className="text-text-muted">Versão</span>
                  <code className="font-mono text-xs text-text-primary">{view.configVersionId}</code>
                </span>
              )}
            </div>

            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <dt className="font-semibold uppercase tracking-wider text-text-muted">Autor</dt>
                <dd className="mt-1 break-words text-text-primary">{view.updatedBy ?? "—"}</dd>
              </div>
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                <dt className="font-semibold uppercase tracking-wider text-text-muted">Atualizado em</dt>
                <dd className="mt-1 break-words text-text-primary">{formatTimestamp(view.updatedAt)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-bg-deep/40 p-3 sm:col-span-2">
                <dt className="font-semibold uppercase tracking-wider text-text-muted">Motivo da última alteração</dt>
                <dd className="mt-1 break-words text-text-primary">{view.reason ?? "—"}</dd>
              </div>
            </dl>

            {view.pricing ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Cobertura de pricing</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-2">
                    Principal
                    <Badge variant={coverageVariant(view.pricing.primary.pricingCoverage)}>
                      {coverageLabel(view.pricing.primary.pricingCoverage)}
                    </Badge>
                  </span>
                  <span className="flex items-center gap-2">
                    Fallback
                    <Badge variant={coverageVariant(view.pricing.fallback.pricingCoverage)}>
                      {coverageLabel(view.pricing.fallback.pricingCoverage)}
                    </Badge>
                  </span>
                </div>
                {view.pricing.missingComponents.length > 0 && (
                  <p className="text-xs text-accent-amber">
                    Componentes ausentes: {view.pricing.missingComponents.join(", ")}.
                  </p>
                )}
              </div>
            ) : (
              !view.eligible && (
                <p className="text-xs text-accent-amber">
                  A configuração vigente está fora do catálogo elegível; ajuste o par para regularizar.
                </p>
              )
            )}
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <h3 id="eligible-catalog-heading" className="font-heading text-lg font-semibold text-text-primary">
          Catálogo elegível
        </h3>
        <Card className="space-y-4 p-6">
          <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4 text-sm text-text-secondary">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-blue" aria-hidden="true" />
              <p>
                <strong className="text-text-primary">Catálogo somente leitura.</strong> Novos modelos entram por migration.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {view.eligibleModels.map((model) => (
              <li
                key={model}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-deep/40 p-3"
              >
                <code className="font-mono text-xs text-text-primary">{model}</code>
                <span className="text-xs text-text-secondary">{view.eligibleQualities.join(" · ")}</span>
                <Badge variant="ready">active</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ImageModelPairConfigForm view={view} />
    </section>
  );
}
