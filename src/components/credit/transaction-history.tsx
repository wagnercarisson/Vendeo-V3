"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Coins } from "lucide-react";
import type { CreditTransaction } from "@/lib/credit/types";

interface TransactionHistoryProps {
  transactions: CreditTransaction[];
  totalPages: number;
  currentPage: number;
}

const TYPE_LABEL: Record<string, string> = {
  grant: "Concessão",
  purchase: "Compra",
  deduction: "Geração",
  refund: "Estorno",
};

const TYPE_BADGE: Record<string, "ready" | "error"> = {
  grant: "ready",
  purchase: "ready",
  deduction: "error",
  refund: "ready",
};

function formatValue(type: string, amount: number): string {
  const prefix = type === "deduction" ? "-" : "+";
  return `${prefix}${Math.abs(amount)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TransactionHistory({
  transactions,
  totalPages,
  currentPage,
}: TransactionHistoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-text-primary font-heading">
        Extrato de Créditos
      </h3>

      {transactions.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="Nenhuma transação ainda"
          description="Seu extrato será preenchido conforme você usar seus créditos."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-text-muted font-medium font-heading text-xs uppercase tracking-wider">
                  Tipo
                </th>
                <th className="text-left py-2 pr-4 text-text-muted font-medium font-heading text-xs uppercase tracking-wider">
                  Valor
                </th>
                <th className="text-left py-2 pr-4 text-text-muted font-medium font-heading text-xs uppercase tracking-wider">
                  Saldo
                </th>
                <th className="text-left py-2 pr-4 text-text-muted font-medium font-heading text-xs uppercase tracking-wider">
                  Motivo
                </th>
                <th className="text-left py-2 text-text-muted font-medium font-heading text-xs uppercase tracking-wider">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-4">
                    <Badge
                      variant={TYPE_BADGE[tx.type] ?? "default"}
                    >
                      {TYPE_LABEL[tx.type] ?? tx.type}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-text-primary font-body tabular-nums">
                    {formatValue(tx.type, tx.amount)}
                  </td>
                  <td className="py-3 pr-4 text-text-primary font-body tabular-nums">
                    {tx.balanceAfter}
                  </td>
                  <td className="py-3 pr-4 text-text-secondary font-body max-w-[200px] truncate">
                    {tx.reason ?? "—"}
                  </td>
                  <td className="py-3 text-text-muted font-body whitespace-nowrap">
                    {formatDate(tx.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
