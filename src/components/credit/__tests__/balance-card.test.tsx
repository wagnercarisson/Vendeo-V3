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
    expect(html).toContain("Campanha: 1 crédito");
    expect(html).toContain("Assinatura visual: 1 crédito");
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

  it("loaded com custo 2 → plural", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 2, enabled: true },
        visual_signature_generation: { costCredits: 1, enabled: true },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).toContain("Campanha: 2 créditos");
  });

  it("loaded com visual_signature_generation desabilitada → indisponível", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 1, enabled: true },
        visual_signature_generation: { costCredits: 3, enabled: false },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).toContain("Assinatura visual: indisponível");
    expect(html).not.toContain("Assinatura visual: 3");
  });

  it("loaded com campaign_generation desabilitada → indisponível", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 5, enabled: false },
        visual_signature_generation: { costCredits: 1, enabled: true },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).toContain("Campanha: indisponível");
  });

  it("loading → texto neutro sem linhas de custo", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: null,
      status: "loading",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).toContain("Cada geração consome créditos.");
    expect(html).not.toContain("Campanha:");
    expect(html).not.toContain("Assinatura visual:");
  });

  it("loaded → sem texto ambíguo 'Cada geração consome'", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 1, enabled: true },
        visual_signature_generation: { costCredits: 1, enabled: true },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={42} hasStore={true} />);
    expect(html).not.toContain("Cada geração consome");
  });

  it("renders the materialized expired state and preserves post-demo balance", () => {
    mockUseOperationCosts.mockReturnValue({ costs: null, status: "loading", refetch: vi.fn() });
    const html = renderToString(<BalanceCard balance={3} availableBalance={3} demoBalance={0} demoExpiresAt={null} originDemoGrantTxId="grant-1" hasStore />);
    expect(html).toContain("Demonstração encerrada");
    expect(html).toContain("Há saldo utilizável além da demonstração.");
    expect(html).not.toMatch(/24h|Comprar|Adquirir/);
  });

  it("shows local and relative expiry for an active demo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T06:00:00.000Z"));
    try {
      mockUseOperationCosts.mockReturnValue({ costs: null, status: "loading", refetch: vi.fn() });
      const html = renderToString(<BalanceCard balance={10} demoBalance={10} demoExpiresAt="2026-09-23T12:00:00.000Z" originDemoGrantTxId="grant-1" hasStore />);
      expect(html).toContain("Expira em breve");
      expect(html).toContain("expira em");
    } finally {
      vi.useRealTimers();
    }
  });

  it("legacy account without demo or trial does not promise demo or free trial", () => {
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 1, enabled: true },
        visual_signature_generation: { costCredits: 1, enabled: true },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
    const html = renderToString(<BalanceCard balance={5} availableBalance={5} hasStore />);
    expect(html).toContain("5 créditos disponíveis");
    expect(html).toContain("Campanha: 1 crédito");
    expect(html).not.toContain("Demonstração não iniciada");
    expect(html).not.toContain("Demonstração ativa");
    expect(html).not.toContain("Demonstração legada");
    expect(html).not.toContain("Teste gratuito");
  });

  it("shows the trial start message only with explicit eligibility", () => {
    mockUseOperationCosts.mockReturnValue({ costs: null, status: "loading", refetch: vi.fn() });
    const html = renderToString(
      <BalanceCard balance={5} availableBalance={5} hasStore trialOfferEligibility="eligible" />,
    );
    expect(html).toContain("Teste gratuito: começa ao concluir o onboarding");
    expect(html).not.toContain("Demonstração não iniciada");
  });

  it("keeps active legacy demo status and relative expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T06:00:00.000Z"));
    try {
      mockUseOperationCosts.mockReturnValue({ costs: null, status: "loading", refetch: vi.fn() });
      const html = renderToString(
        <BalanceCard balance={10} demoBalance={10} demoExpiresAt="2026-10-02T06:00:00.000Z" originDemoGrantTxId="grant-1" hasStore />,
      );
      expect(html).toContain("Demonstração ativa");
      expect(html).toContain("expira em");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps active trial status, expiry and next installment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T12:00:00.000Z"));
    try {
      mockUseOperationCosts.mockReturnValue({ costs: null, status: "loading", refetch: vi.fn() });
      const html = renderToString(
        <BalanceCard
          balance={5}
          availableBalance={5}
          demoBalance={5}
          demoExpiresAt="2026-11-17T00:00:00.000Z"
          hasStore
          trialOfferEnrollment={{
            id: "enr-1",
            startedAt: "2026-10-20T00:00:00.000Z",
            expiresAt: "2026-11-17T00:00:00.000Z",
            grantedTotal: 5,
            lastGrantedSeq: 0,
          }}
        />,
      );
      expect(html).toContain("Teste gratuito de 28 dias ativo");
      expect(html).toContain("Vence em");
      expect(html).toContain("Próxima parcela");
      expect(html).not.toContain("Demonstração não iniciada");
    } finally {
      vi.useRealTimers();
    }
  });
});
