// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
}));

const metrics = vi.hoisted(() => ({
  getSuccessRate: vi.fn(),
  getErrorRate: vi.fn(),
  getAvgCost: vi.fn(),
  getAvgCostBrl: vi.fn(),
  getAvgDuration: vi.fn(),
  getCreditsGranted: vi.fn(),
  getRefundRate: vi.fn(),
  getActiveUsers: vi.fn(),
  getVsSuccessRate: vi.fn(),
  getVsErrorRate: vi.fn(),
  getVsAvgDuration: vi.fn(),
  getVsCreditsConsumed: vi.fn(),
  getVsRefundRate: vi.fn(),
  getVsCreditsRefunded: vi.fn(),
}));

vi.mock("@/lib/metrics/pipeline-metrics", () => ({
  getSuccessRate: (...a: unknown[]) => metrics.getSuccessRate(...a),
  getErrorRate: (...a: unknown[]) => metrics.getErrorRate(...a),
  getAvgCost: (...a: unknown[]) => metrics.getAvgCost(...a),
  getAvgCostBrl: (...a: unknown[]) => metrics.getAvgCostBrl(...a),
  getAvgDuration: (...a: unknown[]) => metrics.getAvgDuration(...a),
  getCreditsGranted: (...a: unknown[]) => metrics.getCreditsGranted(...a),
  getRefundRate: (...a: unknown[]) => metrics.getRefundRate(...a),
  getActiveUsers: (...a: unknown[]) => metrics.getActiveUsers(...a),
  getVsSuccessRate: (...a: unknown[]) => metrics.getVsSuccessRate(...a),
  getVsErrorRate: (...a: unknown[]) => metrics.getVsErrorRate(...a),
  getVsAvgDuration: (...a: unknown[]) => metrics.getVsAvgDuration(...a),
  getVsCreditsConsumed: (...a: unknown[]) => metrics.getVsCreditsConsumed(...a),
  getVsRefundRate: (...a: unknown[]) => metrics.getVsRefundRate(...a),
  getVsCreditsRefunded: (...a: unknown[]) => metrics.getVsCreditsRefunded(...a),
}));

vi.mock("@/lib/metrics/health", () => ({
  computeHealthState: () => "healthy" as const,
}));

const DEFAULT_METRICS: Record<keyof typeof metrics, number | null> = {
  getSuccessRate: 80,
  getErrorRate: 20,
  getAvgCost: 0.1,
  getAvgCostBrl: 0.5,
  getAvgDuration: 12000,
  getCreditsGranted: 500,
  getRefundRate: 10,
  getActiveUsers: 5,
  getVsSuccessRate: 75,
  getVsErrorRate: 25,
  getVsAvgDuration: 15000,
  getVsCreditsConsumed: 20,
  getVsRefundRate: 10,
  getVsCreditsRefunded: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  for (const key of Object.keys(metrics) as Array<keyof typeof metrics>) {
    metrics[key].mockResolvedValue(DEFAULT_METRICS[key]);
  }
});

describe("AdminMetricsPage (F38.2.1 D7 — card Custo Médio IA em BRL snapshotado)", () => {
  it("requireAdmin rejeita → Acesso negado", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("forbidden"));
    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Acesso negado");
  });

  it("renderiza card 'Custo Médio IA' com o valor BRL vindo de getAvgCostBrl (sem re-conversão na página)", async () => {
    metrics.getAvgCostBrl.mockResolvedValue(0.5); // média BRL (snapshot por evento)
    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Custo Médio IA");
    expect(html).toContain("R$ 0,50"); // valor pré-formatado — a página NÃO multiplica
    expect(metrics.getAvgCostBrl).toHaveBeenCalled();
  });

  it("card 'Custo Médio IA' exibe exatamente o retorno de getAvgCostBrl — nenhuma conversão na página", async () => {
    metrics.getAvgCostBrl.mockResolvedValue(4.8);
    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));

    // 4.8 (média BRL) → "R$ 4,80" direto; se a página ainda convertesse
    // (ex.: × taxa), o valor exibido seria diferente.
    expect(html).toContain("R$ 4,80");
    expect(html).not.toContain("R$ 0,50"); // default 0.5 não pode aparecer
  });

  it("demais cards sem regressão (campaign + VS + wallet)", async () => {
    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));

    // Campaign
    expect(html).toContain("Taxa de Sucesso");
    expect(html).toContain("Taxa de Erro");
    expect(html).toContain("Tempo Médio");
    expect(html).toContain("Taxa de Estorno Campanhas");
    expect(html).toContain("Usuários Ativos");
    // VS
    expect(html).toContain("Taxa de Sucesso VS");
    expect(html).toContain("Taxa de Erro VS");
    expect(html).toContain("Créditos Consumidos VS");
    expect(html).toContain("Créditos Estornados VS");
    // Wallet
    expect(html).toContain("Créditos Concedidos");
  });

  it("card 'Custo Médio IA' sem dados → null preservado (sem R$)", async () => {
    metrics.getAvgCostBrl.mockResolvedValue(null);
    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Custo Médio IA");
    expect(html).not.toContain("R$");
  });
});
