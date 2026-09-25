"use client";

import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";

/**
 * Painel de orçamento do programa (F48.2.1, D9/D10).
 *
 * Exibe o orçamento autorizado, reservado e consumido e o **saldo restante**
 * (`budget_usd - budget_consumed_usd - budget_reserved_usd`) em JetBrains Mono.
 * O CTA "Autorizar orçamento" leva à tela de programas (autorização é um passo
 * explícito antes das chamadas pagas). Pricing parcial → faixa/aviso em âmbar;
 * ausente → "indisponível" — nunca um valor exato inventado.
 */

export interface BudgetPanelProps {
  budgetUsd: number | null;
  budgetReservedUsd: number;
  budgetConsumedUsd: number;
  programRemainingUsd: number | null;
  coverage?: "complete" | "partial" | "missing";
  /** Fração do teto a partir da qual o aviso âmbar aparece (default 20%). */
  warnThresholdRatio?: number;
}

function formatUsd(value: number | null): string {
  return typeof value === "number" ? `US$ ${value.toFixed(4)}` : "indisponível";
}

export function BudgetPanel({
  budgetUsd,
  budgetReservedUsd,
  budgetConsumedUsd,
  programRemainingUsd,
  coverage = "complete",
  warnThresholdRatio = 0.2,
}: BudgetPanelProps) {
  const nearCeiling =
    typeof budgetUsd === "number" &&
    typeof programRemainingUsd === "number" &&
    budgetUsd > 0 &&
    programRemainingUsd / budgetUsd <= warnThresholdRatio;

  return (
    <section
      aria-labelledby="orcamento-programa"
      className="space-y-3 rounded-xl border border-border bg-bg-surface p-5"
      data-testid="lab-budget-panel"
    >
      <h2
        id="orcamento-programa"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Orçamento do programa
      </h2>

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Orçamento autorizado</dt>
          <dd className="font-mono text-text-primary">{formatUsd(budgetUsd)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Reservado</dt>
          <dd className="font-mono text-text-primary">{formatUsd(budgetReservedUsd)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Consumido</dt>
          <dd className="font-mono text-text-primary">{formatUsd(budgetConsumedUsd)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Saldo restante</dt>
          <dd className="font-mono text-text-primary" data-testid="lab-remaining-balance">
            {programRemainingUsd === null
              ? "Sem orçamento autorizado"
              : formatUsd(programRemainingUsd)}
          </dd>
        </div>
      </dl>

      {coverage !== "complete" && (
        <p className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Pricing parcial ou indisponível — o valor é uma faixa/aviso, não um
            valor exato.
          </span>
        </p>
      )}

      {nearCeiling && (
        <p className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>O saldo restante está próximo do teto autorizado.</span>
        </p>
      )}

      <div className="flex justify-end">
        <Link
          href="/admin/laboratorio/programas"
          className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2 font-heading text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 focus:ring-2 focus:ring-accent-green focus:outline-none"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Autorizar orçamento
        </Link>
      </div>
    </section>
  );
}
