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
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("Admin FeatureFlags page (Teste 24 — Controles operacionais)", () => {
  it("exibe a flag force_brief_vision_check com descrição quando a leitura retorna dados", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "flag-id-1",
                    key: "force_brief_vision_check",
                    enabled: false,
                    description: "Quando ligada, o Vendeo executa novamente a validacao por IA das imagens.",
                    updated_by: null,
                    updated_at: null,
                  },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      if (table === "users") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) };
      }
      return {};
    });

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());

    expect(html).toContain("Controles operacionais");
    expect(html).toContain("force_brief_vision_check");
    expect(html).toContain("Quando ligada");
  });

  it("exibe erro claro quando a migration não está aplicada (flag não encontrada)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        };
      }
      return {};
    });

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());

    expect(html).toContain("Controles operacionais");
    expect(html).toContain("não encontrada");
  });
});