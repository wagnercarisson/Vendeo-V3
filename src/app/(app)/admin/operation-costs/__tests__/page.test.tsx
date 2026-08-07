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

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("../operation-costs-form", () => ({
  OperationCostsForm: ({ rows }: { rows: Array<{ operationKey: string; costCredits: number; source: string; updatedByEmail: string | null }> }) => (
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
});
