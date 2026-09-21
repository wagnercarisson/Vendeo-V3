import Link from "next/link";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCredits } from "@/lib/credit/format";
import { getDemoStatus, formatRelativeExpiry, type DemoStatus } from "@/lib/credit/demo-status";

interface BalanceDisplayProps {
  balance: number;
  hasStore?: boolean;
  variant?: "badge" | "card" | "inline";
  showCta?: boolean;
  ctaHref?: string;
  availableBalance?: number;
  demoBalance?: number;
  demoExpiresAt?: string | null;
  originDemoGrantTxId?: string | null;
}

function getState(balance: number, hasStore: boolean) {
  if (!hasStore) return "no_store";
  if (balance >= 3) return "normal";
  if (balance > 0) return "low";
  return "zero";
}

function getDemoLabel(status: DemoStatus) {
  return { active: "Demonstração ativa", expiring_soon: "Expira em breve", exhausted: "Demonstração esgotada", expired: "Demonstração encerrada", none: "Demonstração não iniciada" }[status];
}

function DemoSummary({ demoBalance = 0, demoExpiresAt = null, originDemoGrantTxId = null }: BalanceDisplayProps) {
  const status = getDemoStatus({ demoBalance, demoExpiresAt, originDemoGrantTxId });
  const isRelevant = status !== "none";
  return <span className={isRelevant ? "text-xs text-text-secondary" : "sr-only"}>
    {getDemoLabel(status)}
    {demoExpiresAt && (status === "active" || status === "expiring_soon")
      ? ` · ${new Date(demoExpiresAt).toLocaleString("pt-BR")} (${formatRelativeExpiry(demoExpiresAt)})`
      : ""}
  </span>;
}

function BadgeVariant(props: BalanceDisplayProps) {
  const { balance, hasStore, showCta, ctaHref } = props;
  const state = getState(balance, hasStore ?? true);

  const colorClass =
    state === "no_store" || state === "normal"
      ? "bg-accent-green/10 text-accent-green"
      : state === "low"
        ? "bg-accent-amber/10 text-accent-amber"
        : "bg-accent-red/10 text-accent-red";

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-heading ${colorClass}`}>
        {formatCredits(balance)}
      </span>
      <DemoSummary {...props} />
      {showCta && state === "zero" && (
        <Link
          href={ctaHref ?? "/conta#creditos"}
          className="text-xs font-medium text-accent-green hover:underline"
        >
          Solicitar créditos
        </Link>
      )}
    </div>
  );
}

function CardVariant(props: BalanceDisplayProps) {
  const { balance, hasStore, showCta, ctaHref } = props;
  const state = getState(balance, hasStore ?? true);

  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-text-secondary">
        Créditos
      </p>
      <p className="text-3xl font-bold text-text-primary mt-1">
        {balance}
      </p>
      <DemoSummary {...props} />
      {showCta && state === "zero" && (
        <Link
          href={ctaHref ?? "/conta#creditos"}
          className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-accent-green hover:underline"
        >
          Solicitar créditos
        </Link>
      )}
    </Card>
  );
}

function InlineVariant(props: BalanceDisplayProps) {
  const { balance, hasStore } = props;
  const state = getState(balance, hasStore ?? true);

  const colorClass =
    state === "no_store" || state === "normal"
      ? "text-accent-green"
      : state === "low"
        ? "text-accent-amber"
        : "text-accent-red";

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${colorClass}`}>
      <Coins className="h-4 w-4" />
      {formatCredits(balance)}
      <DemoSummary {...props} />
    </span>
  );
}

export function BalanceDisplay(props: BalanceDisplayProps) {
  const displayBalance = props.availableBalance ?? props.balance;
  const displayProps = { ...props, balance: displayBalance };
  const { variant = "badge" } = props;

  switch (variant) {
    case "card":
      return <CardVariant {...displayProps} />;
    case "inline":
      return <InlineVariant {...displayProps} />;
    default:
      return <BadgeVariant {...displayProps} />;
  }
}
