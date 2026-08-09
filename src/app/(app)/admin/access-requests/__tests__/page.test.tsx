// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
  createServerClient: vi.fn(),
}));

vi.mock("@/components/admin/access-request-actions", () => ({
  AccessRequestActions: ({
    requestId,
    status,
  }: {
    requestId: string;
    status: string;
  }) => (
    <div data-testid={`actions-${requestId}`}>
      <button>Aprovar</button>
      <button>Recusar</button>
      <span>{status}</span>
    </div>
  ),
}));

function setupQuery(rows: Array<Record<string, unknown>>, count?: number) {
  const range = vi.fn().mockResolvedValue({ data: rows, error: null, count: count ?? rows.length });
  const order = vi.fn().mockReturnValue({ range });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select, eq, order, range });
  return { select, eq, order, range };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminAccessRequestsPage", () => {
  it("requireAdmin rejeita → Acesso negado", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("forbidden"));
    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Acesso negado");
  });

  it("renderiza emails, status e botões de ação; tab default pending", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
    const { eq } = setupQuery([
      {
        id: "req-1",
        email: "loja@example.com",
        name: "Maria",
        store_name: "Loja da Maria",
        segment: "padaria-confeitaria-doces",
        whatsapp: "(11) 99999-9999",
        source: "landing",
        status: "pending",
        created_at: "2026-08-08T12:00:00.000Z",
      },
      {
        id: "req-2",
        email: "outra@example.com",
        name: null,
        store_name: null,
        segment: null,
        whatsapp: null,
        source: "landing",
        status: "pending",
        created_at: "2026-08-08T11:00:00.000Z",
      },
    ]);

    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));

    // Tab default = pending (query sem ?tab=)
    expect(eq).toHaveBeenCalledWith("status", "pending");

    expect(html).toContain("loja@example.com");
    expect(html).toContain("outra@example.com");
    expect(html).toContain("Pendente");
    expect(html).toContain("Padaria, Confeitaria e Doces");
    expect(html).toContain("Aprovar");
    expect(html).toContain("Recusar");
  });

  it("respeita ?tab=approved na query", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
    const { eq } = setupQuery([]);

    const { default: Page } = await import("../page");
    await Page({ searchParams: Promise.resolve({ tab: "approved" }) });

    expect(eq).toHaveBeenCalledWith("status", "approved");
  });

  it("erro de query → mensagem de erro", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
    const range = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
      count: 0,
    });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select, eq, order, range });

    const { default: Page } = await import("../page");
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Erro ao carregar solicitações");
  });
});
