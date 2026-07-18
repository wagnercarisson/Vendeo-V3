// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionHistory } from "@/components/credit/transaction-history";
import type { CreditTransaction } from "@/lib/credit/types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("page=1"),
}));

function makeTx(overrides: Partial<CreditTransaction> = {}): CreditTransaction {
  return {
    id: "tx-1",
    storeId: "store-1",
    type: "grant",
    amount: 10,
    balanceBefore: 0,
    balanceAfter: 10,
    campaignId: null,
    reason: "onboarding",
    reference: null,
    idempotencyKey: null,
    metadata: null,
    createdAt: "2026-07-16T12:00:00Z",
    ...overrides,
  };
}

describe("TransactionHistory", () => {
  it("renders table with transaction columns and type mapping", () => {
    const txs = [
      makeTx({ type: "deduction", amount: -1, reason: "reserva" }),
      makeTx({ id: "tx-2", type: "grant", amount: 5, reason: "bonus" }),
    ];

    render(
      <TransactionHistory
        transactions={txs}
        totalPages={2}
        currentPage={1}
      />,
    );

    expect(screen.getByText("Geração")).toBeInTheDocument();
    expect(screen.getByText("Concessão")).toBeInTheDocument();
    expect(screen.getByText("reserva")).toBeInTheDocument();
    expect(screen.getByText("bonus")).toBeInTheDocument();
    expect(screen.getByText("Extrato de Créditos")).toBeInTheDocument();
  });

  it("renders empty state when no transactions", () => {
    render(
      <TransactionHistory
        transactions={[]}
        totalPages={0}
        currentPage={1}
      />,
    );

    expect(screen.getByText("Nenhuma transação encontrada")).toBeInTheDocument();
  });

  it("renders pagination controls when totalPages > 1", () => {
    const txs = [makeTx()];

    render(
      <TransactionHistory
        transactions={txs}
        totalPages={3}
        currentPage={2}
      />,
    );

    expect(screen.getByText(/Anterior/)).toBeInTheDocument();
    expect(screen.getByText(/Próximo/)).toBeInTheDocument();
  });
});
