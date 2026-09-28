"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import { formatUsdDisplay } from "@/lib/lab/display-format";

/**
 * Painel de estimativa da bancada (F48.2.2, D12/T-48-2-2-41).
 *
 * A estimativa é exibida **antes** da confirmação. A cobertura de pricing decide
 * a apresentação: `complete` mostra o valor; `partial` mostra a faixa **"a partir
 * de US$ X"** (nunca um total exato); `missing` mostra **"indisponível"**. O valor
 * estimado nunca é apresentado como faturado.
 */

export interface BenchEstimate {
  estimatedUsd: number | null;
  coverage: string;
  mode?: string;
  isEstimate?: boolean;
  costSource?: string | null;
  costRuleVersion?: string | null;
}

interface BenchEstimatePanelProps {
  estimate: BenchEstimate | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * Custo coerente com a cobertura de pricing: `complete` mostra o valor; `partial`
 * mostra "a partir de US$ X"; qualquer outra cobertura mostra "indisponível".
 */
export function formatCostByCoverage(
  value: number | null | undefined,
  coverage: string,
): string {
  if (coverage === "complete") {
    return typeof value === "number" ? formatUsdDisplay(value) : "indisponível";
  }
  if (coverage === "partial") {
    return typeof value === "number"
      ? `a partir de ${formatUsdDisplay(value)}`
      : "indisponível";
  }
  return "indisponível";
}

export function BenchEstimatePanel({
  estimate,
  loading = false,
  error = null,
}: BenchEstimatePanelProps) {
  return (
    <section
      data-testid="bench-estimate-panel"
      className="space-y-3 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-estimate-title"
    >
      <h2
        id="bench-estimate-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Estimativa
      </h2>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-text-secondary font-body">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Calculando a estimativa…
        </p>
      )}

      {error && !loading && (
        <p role="alert" className="text-sm text-accent-red font-body">
          {error}
        </p>
      )}

      {estimate && !loading && (
        <div className="space-y-2">
          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Custo estimado</dt>
              <dd
                className={`font-mono ${
                  estimate.coverage === "partial"
                    ? "text-accent-amber"
                    : "text-text-primary"
                }`}
              >
                {formatCostByCoverage(estimate.estimatedUsd, estimate.coverage)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Cobertura de pricing</dt>
              <dd className="font-mono text-text-secondary">{estimate.coverage}</dd>
            </div>
            {estimate.mode && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-muted font-body">Modo</dt>
                <dd className="font-mono text-text-secondary">{estimate.mode}</dd>
              </div>
            )}
          </dl>

          {estimate.coverage !== "complete" && (
            <p className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Pricing parcial ou ausente — o valor é uma faixa/aviso, não um valor
                exato.
              </span>
            </p>
          )}

          <p className="text-xs text-text-muted font-body">
            Valor estimado antes da confirmação — não é valor faturado.
          </p>
        </div>
      )}
    </section>
  );
}
