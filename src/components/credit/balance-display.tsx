import Link from "next/link";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCredits } from "@/lib/credit/format";

interface BalanceDisplayProps {
  balance: number;
  hasStore?: boolean;
  variant?: "badge" | "card" | "inline";
  showCta?: boolean;
  ctaHref?: string;
}

function getState(balance: number, hasStore: boolean) {
  if (!hasStore) return "no_store";
  if (balance >= 3) return "normal";
  if (balance > 0) return "low";
  return "zero";
}

function BadgeVariant({ balance, hasStore, showCta, ctaHref }: BalanceDisplayProps) {
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

function CardVariant({ balance, hasStore, showCta, ctaHref }: BalanceDisplayProps) {
  const state = getState(balance, hasStore ?? true);

  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-text-secondary">
        Créditos
      </p>
      <p className="text-3xl font-bold text-text-primary mt-1">
        {balance}
      </p>
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

function InlineVariant({ balance, hasStore }: BalanceDisplayProps) {
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
    </span>
  );
}

export function BalanceDisplay(props: BalanceDisplayProps) {
  const { variant = "badge" } = props;

  switch (variant) {
    case "card":
      return <CardVariant {...props} />;
    case "inline":
      return <InlineVariant {...props} />;
    default:
      return <BadgeVariant {...props} />;
  }
}
