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

// Monta o mock da cadeia feature_flags com lista (GET via .in("key", ...)).
function mockFlags(featureFlags: unknown[]) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "feature_flags") {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() =>
            Promise.resolve({ data: featureFlags, error: null }),
          ),
        })),
      };
    }
    if (table === "users") {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() =>
            Promise.resolve({ data: [{ id: "u1", email: "admin@vendeo.com" }], error: null }),
          ),
        })),
      };
    }
    return {};
  });
}

describe("Admin FeatureFlags page (Controles operacionais — multi-flags QCW)", () => {
  it("renderiza as 4 flags com labels humanizados + keys mono + descrições", async () => {
    mockFlags([
      {
        id: "f1",
        key: "force_brief_vision_check",
        enabled: false,
        description: "Validação por IA das imagens após a revisão humana.",
        updated_by: null,
        updated_at: null,
      },
      {
        id: "f2",
        key: "captcha_enabled",
        enabled: true,
        description:
          "Nao altera a configuracao de CAPTCHA do Supabase Auth; se ela estiver ligada no Supabase, o Auth continuara exigindo token valido.",
        updated_by: null,
        updated_at: null,
      },
      {
        id: "f3",
        key: "campaign_generation_enabled",
        enabled: true,
        description: "Habilita a geracao de campanhas.",
        updated_by: null,
        updated_at: null,
      },
      {
        id: "f4",
        key: "visual_signature_generation_enabled",
        enabled: true,
        description: "Habilita a geracao de assinatura visual.",
        updated_by: null,
        updated_at: null,
      },
    ]);

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());

    expect(html).toContain("Controles operacionais");
    // Labels humanizados
    expect(html).toContain("Validação IA do brief (produto × imagem)");
    expect(html).toContain("Captcha (Turnstile) em login, cadastro e recuperação de senha");
    expect(html).toContain("Geração de campanhas");
    expect(html).toContain("Geração de assinatura visual");
    // Keys técnicas como subtexto mono
    expect(html).toContain("force_brief_vision_check");
    expect(html).toContain("captcha_enabled");
    expect(html).toContain("campaign_generation_enabled");
    expect(html).toContain("visual_signature_generation_enabled");
    // Descrição do banco (limite honesto do captcha sobre o Supabase Auth)
    expect(html).toContain("continuara exigindo token valido");
    // Badge genérico
    expect(html).toContain("Desligada");
    expect(html).toContain("Ligada");
  });

  it("flags ausentes (migration não aplicada) → aviso mantendo as encontradas", async () => {
    mockFlags([
      {
        id: "f1",
        key: "force_brief_vision_check",
        enabled: false,
        description: "Validação por IA das imagens após a revisão humana.",
        updated_by: null,
        updated_at: null,
      },
    ]);

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());

    expect(html).toContain("Controles operacionais");
    // Aviso de migration não aplicada cita as keys ausentes
    expect(html).toContain("migration de seeds não foi aplicada");
    expect(html).toContain("captcha_enabled");
    expect(html).toContain("campaign_generation_enabled");
    expect(html).toContain("visual_signature_generation_enabled");
    // A flag encontrada permanece renderizada
    expect(html).toContain("Validação IA do brief (produto × imagem)");
  });

  it("exibe erro claro quando a leitura falha", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({ data: null, error: { message: "db down" } }),
            ),
          })),
        };
      }
      return {};
    });

    const { default: Page } = await import("../page");
    const html = renderToString(await Page());

    expect(html).toContain("Controles operacionais");
    expect(html).toContain("Falha ao ler as flags");
  });
});