// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { BalanceCard } from "@/components/credit/balance-card";

describe("BalanceCard", () => {
  it("renders formatted balance with description for normal balance", () => {
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).toContain("42");
    expect(html).toContain("Cada geração consome 1 crédito");
  });

  it("shows CTA when balance is zero", () => {
    const html = renderToString(<BalanceCard balance={0} hasStore={true} />);
    expect(html).toContain("Créditos insuficientes");
    expect(html).toContain("Solicitar créditos");
  });

  it("shows onboarding CTA when no store", () => {
    const html = renderToString(<BalanceCard hasStore={false} />);
    expect(html).toContain("Você ainda não tem uma loja");
    expect(html).toContain("Criar loja");
    expect(html).toContain("/loja");
  });
});
