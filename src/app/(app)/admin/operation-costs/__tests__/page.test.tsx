// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockGetAllCosts = vi.fn();
class MockOperationCostUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao ler custos de operação");
    this.name = "OperationCostUnavailableError";
  }
}
vi.mock("@/lib/credit/operation-cost-service", () => ({
  OperationCostService: vi.fn(function () {
    return { getAllCosts: mockGetAllCosts };
  }),
  OperationCostUnavailableError: MockOperationCostUnavailableError,
}));

const mockGetAllParameters = vi.fn();
class MockEconomicParameterUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao ler parâmetros econômicos");
    this.name = "EconomicParameterUnavailableError";
  }
}
vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function () {
    return { getAll: mockGetAllParameters };
  }),
  EconomicParameterUnavailableError: MockEconomicParameterUnavailableError,
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("../operation-costs-form", () => ({
  OperationCostsForm: ({
    rows,
  }: {
    rows: Array<{
      operationKey: string;
      costCredits: number;
      source: string;
      updatedByEmail: string | null;
    }>;
  }) => (
    <div data-testid="form">
      {rows.map((r) => (
        <div key={r.operationKey}>
          <span>{r.operationKey}</span>
          <span>{r.costCredits}</span>
          <span>{r.source === "table" ? "tabela" : "fallback"}</span>
          <span>{r.updatedByEmail ?? "—"}</span>
        </div>
      ))}
    </div>
  ),
  ParamsForm: ({
    parameters,
  }: {
    parameters: Array<{ key: string; value: number; source: string }>;
  }) => (
    <div data-testid="params-form">
      {parameters.map((p) => (
        <div key={p.key}>
          <span>
            {p.key === "usd_brl_rate"
              ? "Taxa de conversão USD→BRL"
              : "Valor operacional do crédito em BRL"}
          </span>
          <span>{p.value}</span>
          <span>{p.source === "table" ? "tabela" : "fallback"}</span>
        </div>
      ))}
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [{ id: "admin-1", email: "admin@vendeo.com" }],
              error: null,
            }),
        }),
      };
    }
    return {};
  });
});

describe("AdminOperationCostsPage", () => {
  it("requireAdmin rejeita → Acesso negado", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("forbidden"));
    const { default: Page } = await import("../page");
    const html = renderToString(await Page());
    expect(html).toContain("Acesso negado");
  });

  it("renderiza operações com email e badges", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
    mockGetAllParameters.mockResolvedValue([
      { key: "usd_brl_rate", value: 1, source: "fallback" },
      { key: "credit_value_brl", value: 1, source: "fallback" },
    ]);
    mockGetAllCosts.mockResolvedValue([
      {
        operationKey: "campaign_generation",
        costCredits: 2,
        enabled: true,
        updatedByUserId: "admin-1",
        updatedAt: "2026-08-07T12:00:00.000Z",
        source: "table",
      },
      {
        operationKey: "visual_signature_generation",
        costCredits: 1,
        enabled: true,
        updatedByUserId: null,
        updatedAt: null,
        source: "fallback",
      },
    ]);

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());
    expect(html).toContain("campaign_generation");
    expect(html).toContain("visual_signature_generation");
    expect(html).toContain("tabela");
    expect(html).toContain("fallback");
    expect(html).toContain("admin@vendeo.com");
  });

  it("getAllCosts indisponível → estado de erro", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
    mockGetAllCosts.mockRejectedValue(
      new MockOperationCostUnavailableError("down"),
    );

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());
    expect(html).toContain("indisponível");
    expect(html).not.toContain("campaign_generation");
  });

  it("renderiza título Configurações Econômicas + seção Parâmetros Econômicos (2 inputs) + tabela Operações", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
    mockGetAllParameters.mockResolvedValue([
      { key: "usd_brl_rate", value: 1, source: "fallback" },
      { key: "credit_value_brl", value: 1, source: "fallback" },
    ]);
    mockGetAllCosts.mockResolvedValue([
      {
        operationKey: "campaign_generation",
        costCredits: 2,
        enabled: true,
        updatedByUserId: null,
        updatedAt: null,
        source: "table",
      },
    ]);

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());
    expect(html).toContain("Configurações Econômicas");
    expect(html).toContain("Parâmetros Econômicos");
    expect(html).toContain("Taxa de conversão USD→BRL");
    expect(html).toContain("Valor operacional do crédito em BRL");
    expect(html).toContain("Operações");
    expect(html).toContain("campaign_generation");
  });

  it("parâmetros indisponíveis (EconomicParameterUnavailableError) → 503 da seção SEM derrubar a tabela F38", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
    mockGetAllParameters.mockRejectedValue(
      new MockEconomicParameterUnavailableError("down"),
    );
    mockGetAllCosts.mockResolvedValue([
      {
        operationKey: "campaign_generation",
        costCredits: 2,
        enabled: true,
        updatedByUserId: null,
        updatedAt: null,
        source: "table",
      },
    ]);

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());
    expect(html).toContain("Serviço de parâmetros indisponível no momento");
    expect(html).toContain("campaign_generation");
  });
});
