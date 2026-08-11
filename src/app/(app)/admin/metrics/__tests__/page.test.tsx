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

const mockGetParameter = vi.fn();
vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: mockGetParameter };
  }),
}));

vi.mock("@/lib/metrics/health", () => ({
  computeHealthState: () => "healthy" as const,
}));

const DEFAULT_METRICS: Record<keyof typeof metrics, number | null> = {
  getSuccessRate: 80,
  getErrorRate: 20,
  getAvgCost: 0.1,
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
  mockGetParameter.mockResolvedValue({
    key: "usd_brl_rate",
    value: 5,
    source: "table",
  });
  for (const key of Object.keys(metrics) as Array<keyof typeof metrics>) {
    metrics[key].mockResolvedValue(DEFAULT_METRICS[key]);
  }
});

describe("AdminMetricsPage (F38.2 D6 — card Custo Médio IA + usd_brl_rate)", () => {
  it("requireAdmin rejeita → Acesso negado", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("forbidden"));
    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Acesso negado");
  });

  it("renderiza card 'Custo Médio IA' com a média por entrega convertida via usd_brl_rate", async () => {
    metrics.getAvgCost.mockResolvedValue(0.1); // média USD por entrega (apuração call-level)
    mockGetParameter.mockResolvedValue({ key: "usd_brl_rate", value: 5, source: "table" });

    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Custo Médio IA");
    expect(html).toContain("R$ 0,50"); // 0.10 USD × 5.00
    expect(mockGetParameter).toHaveBeenCalledWith("usd_brl_rate");
  });

  it("USD→BRL usa economic_parameters.usd_brl_rate — NÃO o env VENDEO_USD_BRL_RATE", async () => {
    process.env.VENDEO_USD_BRL_RATE = "9.99"; // env deprecada presente — não deve ser usada
    metrics.getAvgCost.mockResolvedValue(0.1);
    mockGetParameter.mockResolvedValue({ key: "usd_brl_rate", value: 4.8, source: "table" });

    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("R$ 0,48"); // 0.10 × 4.80 (parâmetro econômico)
    expect(html).not.toContain("R$ 1,00"); // 0.10 × 9.99 ≈ 1.00 (env) — inativo
    expect(mockGetParameter).toHaveBeenCalledWith("usd_brl_rate");
    delete process.env.VENDEO_USD_BRL_RATE;
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
});
