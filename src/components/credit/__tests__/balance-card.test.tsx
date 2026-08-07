// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

const mockUseOperationCosts = vi.fn();
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));

import { BalanceCard } from "@/components/credit/balance-card";

describe("BalanceCard", () => {
  it("renders formatted balance with description for normal balance", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 1, enabled: true },
        visual_signature_generation: { costCredits: 1, enabled: true },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).toContain("42");
    expect(html).toContain("Cada geração consome 1 crédito");
  });

  it("shows CTA when balance is zero", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 1, enabled: true },
        visual_signature_generation: { costCredits: 1, enabled: true },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={0} hasStore={true} />);
    expect(html).toContain("Créditos insuficientes");
    expect(html).toContain("Solicitar créditos");
  });

  it("shows onboarding CTA when no store", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: null,
      status: "loading",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard hasStore={false} />);
    expect(html).toContain("Você ainda não tem uma loja");
    expect(html).toContain("Criar loja");
    expect(html).toContain("/loja");
  });

  it("unavailable → description without assumed cost number", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: null,
      status: "unavailable",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).toContain("Cada geração consome créditos.");
    expect(html).not.toContain("Cada geração consome 1 crédito");
  });
});
