// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue(undefined),
}));

// Mock do supabaseAdmin — chain .from().select().eq().order().range()
const storesData = [
  {
    id: "store-1",
    name: "Loja Deferida",
    user_id: "user-1",
    created_at: "2026-08-10T00:00:00Z",
    verification_status: "defer",
    verification_reasons: ["dados_oficiais_incompletos"],
    verification_data: null,
    cnpj_normalized: "12345678000190",
    cnpj_official_data: null,
    cnpj_root_hash: "abc123",
    city: "São Paulo",
    state: "SP",
    segment: "outros",
  },
  {
    id: "store-2",
    name: "Loja Situacao",
    user_id: "user-1",
    created_at: "2026-08-11T00:00:00Z",
    verification_status: "review",
    verification_reasons: ["situacao_nao_ativa"],
    verification_data: null,
    cnpj_normalized: "12345678000191",
    cnpj_official_data: null,
    cnpj_root_hash: "def456",
    city: "São Paulo",
    state: "SP",
    segment: "outros",
  },
];

function makeFrom(table: string) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    contains: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    in: vi.fn(),
    then: async (resolve: (v: unknown) => unknown) => {
      if (table === "stores") {
        return resolve({ data: storesData, error: null, count: storesData.length });
      }
      return resolve({ data: [], error: null });
    },
  };
  // Encadeia: cada método retorna a própria query
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.contains.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.in.mockReturnValue(query);
  return query;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (table: string) => makeFrom(table),
  },
}));

// Mock de ReviewActions e ReviewDetail (children renderizados)
vi.mock("@/components/admin/review-actions", () => ({
  ReviewActions: () => <div data-testid="review-actions" />,
}));

vi.mock("../review-detail", () => ({
  ReviewDetail: () => <div data-testid="review-detail" />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/lib/formatters", () => ({
  formatDateBR: () => "10/08/2026",
}));

vi.mock("@/lib/cnpj/mask", () => ({
  maskCnpj: () => "12345678000190",
}));

import AdminReviewsPage from "@/app/(app)/admin/reviews/page";

describe("AdminReviewsPage (D11 — filtro + defer label)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Teste 51: filtro ?reason=situacao_nao_ativa renderiza sem quebra", async () => {
    const { container } = render(
      await AdminReviewsPage({ searchParams: Promise.resolve({ reason: "situacao_nao_ativa" }) }),
    );
    // Não quebra — página renderiza a tabela com as lojas
    expect(screen.getByRole("heading", { name: "Revisão Cadastral" })).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(1);
  });

  it("Teste 52: defer com dados_oficiais_incompletos exibe label 'Dados oficiais incompletos' (sem cru)", async () => {
    render(
      await AdminReviewsPage({ searchParams: Promise.resolve({ tab: "defer" }) }),
    );
    // Label legível (não o motivo cru)
    expect(screen.getByText("Dados oficiais incompletos")).toBeInTheDocument();
    expect(screen.queryByText("dados_oficiais_incompletos")).not.toBeInTheDocument();
  });

  it("Teste 51b: renderiza badges dos novos motivos via label (não cru)", async () => {
    render(
      await AdminReviewsPage({ searchParams: Promise.resolve({ tab: "review" }) }),
    );
    expect(screen.getByText("Situação cadastral não ativa")).toBeInTheDocument();
    expect(screen.queryByText("situacao_nao_ativa")).not.toBeInTheDocument();
  });
});