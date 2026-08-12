"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCredits } from "@/lib/credit/format";
import {
  useOperationCosts,
  type OperationCostsMap,
  type UseOperationCostsStatus,
} from "@/hooks/use-operation-costs";

interface BalanceCardProps {
  balance?: number;
  hasStore?: boolean;
  variant?: "loading" | "error" | "ready";
  storeName?: string;
  ctaHref?: string;
  supportEmail?: string;
}

function getState(balance: number, hasStore: boolean) {
  if (!hasStore) return "no_store";
  if (balance >= 3) return "normal";
  if (balance > 0) return "low";
  return "zero";
}

// Compact per-operation cost view (max 2 lines, mobile-legible). When costs are
// loaded it shows "Label: valor" using formatCredits (singular/plural); a
// disabled or missing operation renders "indisponível" instead of inventing a
// number. Otherwise it falls back to a neutral line without any cost figure.
function OperationCostRows({
  costs,
  status,
}: {
  costs: OperationCostsMap | null;
  status: UseOperationCostsStatus;
}) {
  if (status === "loaded" && costs) {
    const campaign = costs.campaign_generation;
    const signature = costs.visual_signature_generation;
    return (
      <div className="mt-1 space-y-0.5">
        <p className="text-sm text-text-muted font-body">
          {campaign && campaign.enabled !== false
            ? `Campanha: ${formatCredits(campaign.costCredits)}`
            : "Campanha: indisponível"}
        </p>
        <p className="text-sm text-text-muted font-body">
          {signature && signature.enabled !== false
            ? `Assinatura visual: ${formatCredits(signature.costCredits)}`
            : "Assinatura visual: indisponível"}
        </p>
      </div>
    );
  }
  return (
    <p className="text-sm text-text-muted font-body mt-1">
      Cada geração consome créditos.
    </p>
  );
}

function ReadyContent({ balance, hasStore, supportEmail }: BalanceCardProps) {
  const { costs, status } = useOperationCosts();
  const state = getState(balance ?? 0, hasStore ?? true);

  if (!hasStore) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-primary font-heading">
            Créditos
          </h2>
        </div>
        <p className="text-text-primary font-body">
          Você ainda não tem uma loja
        </p>
        <p className="text-sm text-text-muted font-body">
          Crie sua loja para começar a gerar campanhas e ganhar 10 créditos gratuitos.
        </p>
        <Link
          href="/loja"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
        >
          Criar loja
        </Link>
      </div>
    );
  }

  const displayState = state as "normal" | "low" | "zero";

  const stateConfig = {
    normal: {
      title: `${formatCredits(balance ?? 0)} disponíveis`,
      cta: null,
    },
    low: {
      title: "Créditos acabando",
      description: `Você tem ${balance} crédito(s). Solicite mais antes de ficar sem.`,
      cta: { label: "Solicitar créditos", color: "bg-accent-amber" },
    },
    zero: {
      title: "Créditos insuficientes",
      description: "Você não tem créditos disponíveis. Solicite mais créditos com o time do Vendeo.",
      cta: { label: "Solicitar créditos", color: "bg-accent-green" },
    },
  };

  const config = stateConfig[displayState];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-accent-green" />
        <h2 className="text-lg font-semibold text-text-primary font-heading">
          Créditos
        </h2>
      </div>
      <p className="text-3xl font-bold text-text-primary font-heading">
        {balance}
      </p>
      <div>
        <p className="text-text-primary font-medium font-body">
          {config.title}
        </p>
        {displayState === "normal" ? (
          <OperationCostRows costs={costs} status={status} />
        ) : (
          <p className="text-sm text-text-muted font-body mt-1">
            {stateConfig[displayState].description}
          </p>
        )}
      </div>
      {config.cta && (
        <div>
          <button
            type="button"
            onClick={() => {
              const modal = document.getElementById("credit-cta-modal");
              if (modal) {
                (modal as HTMLDialogElement).showModal?.();
              }
            }}
            className={`inline-flex min-h-[44px] items-center rounded-lg ${config.cta.color} px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200`}
          >
            {config.cta.label}
          </button>

          <dialog
            id="credit-cta-modal"
            className="rounded-xl border border-border bg-bg-surface p-0 backdrop:bg-black/50 max-w-md w-full"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                (e.target as HTMLDialogElement).close();
              }
            }}
          >
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary font-heading">
                Solicitar créditos
              </h3>
              {supportEmail ? (
                <div className="space-y-2">
                  <p className="text-text-secondary text-sm font-body">
                    Envie um email para{" "}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="text-accent-green underline"
                    >
                      {supportEmail}
                    </a>{" "}
                    solicitando mais créditos. O time do Vendeo responderá em até 24h.
                  </p>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
                  >
                    Enviar email
                  </a>
                </div>
              ) : (
                <p className="text-text-secondary text-sm font-body">
                  Entre em contato com o time do Vendeo para solicitar mais créditos.
                  Responderemos em até 24h.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  const modal = document.getElementById("credit-cta-modal");
                  if (modal) {
                    (modal as HTMLDialogElement).close();
                  }
                }}
                className="text-sm text-text-muted hover:text-text-primary underline transition-colors duration-200"
              >
                Fechar
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}

export function BalanceCard(props: BalanceCardProps) {
  const { variant = "ready" } = props;

  if (variant === "loading") {
    return (
      <Card className="p-5 space-y-4">
        <Skeleton height="24px" width="120px" />
        <Skeleton height="36px" width="80px" />
        <Skeleton height="16px" width="200px" />
      </Card>
    );
  }

  if (variant === "error") {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5 text-accent-red" />
          <h2 className="text-lg font-semibold text-text-primary font-heading">
            Créditos
          </h2>
        </div>
        <p className="text-accent-red text-sm font-body">
          Não foi possível carregar o saldo
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ReadyContent {...props} />
    </Card>
  );
}
