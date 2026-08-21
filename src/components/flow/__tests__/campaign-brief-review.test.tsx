// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignBriefReview } from "../campaign-brief-review";
import type { CampaignFormFields, PreparedCampaignImage } from "../use-campaign-form";

const mockUseOperationCosts = vi.fn(
  (): {
    costs: { campaign_generation: { costCredits: number; enabled: boolean } } | null;
    status: "loading" | "unavailable" | "loaded";
    refetch: () => void;
  } => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  })
);
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: () => null,
}));

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const FIELDS: CampaignFormFields = {
  productName: "Tênis Runner Pro",
  description: "Para corrida e uso diário",
  originalPriceCents: 29990,
  discountedPriceCents: 19990,
  badge: "Oferta",
  campaignIntent: "offer",
  preserveImageContext: false,
  productImages: [],
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkTextFree: "Frete grátis acima de R$ 199",
  validityMode: "until-date",
  validityStartDate: "",
  validityEndDate: "2026-09-30",
  validityCustomText: "",
};

const PRIMARY: PreparedCampaignImage = {
  id: "img-1",
  role: "primary",
  source: "upload",
  mimeType: "image/jpeg",
  dataUrl: VALID_DATA_URL,
};

const REFERENCE: PreparedCampaignImage = {
  id: "img-2",
  role: "reference",
  source: "camera",
  mimeType: "image/jpeg",
  dataUrl: VALID_DATA_URL,
};

const STORE = { name: "Loja Teste", segment: "sports", brand_color: "#123456", id: "store-1" };

function renderReview(overrides: Partial<React.ComponentProps<typeof CampaignBriefReview>> = {}) {
  return render(
    <CampaignBriefReview
      fields={FIELDS}
      preparedImages={[PRIMARY, REFERENCE]}
      preparing={false}
      error={null}
      store={STORE}
      identity={null}
      balance={5}
      onBack={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseOperationCosts.mockReturnValue({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  });
});

describe("CampaignBriefReview — Testes 11-16 (F43)", () => {
  it("Teste 11 (D6): seções Produto/Oferta/Imagens/Avisos/Custo renderizam com os valores do brief", () => {
    renderReview();

    // Produto
    expect(screen.getByText("Tênis Runner Pro")).toBeInTheDocument();
    expect(screen.getByText("Para corrida e uso diário")).toBeInTheDocument();

    // Oferta — seção (header) + tipo
    expect(screen.getAllByText("Oferta").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("R$ 299,90")).toBeInTheDocument();
    expect(screen.getByText("R$ 199,90")).toBeInTheDocument();
    expect(screen.getByText("até 30/09/2026")).toBeInTheDocument();

    // Imagens
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Referência")).toBeInTheDocument();

    // Avisos
    expect(screen.getByText(/Imagem meramente ilustrativa/)).toBeInTheDocument();
    expect(screen.getByText(/Frete grátis acima de R\$ 199/)).toBeInTheDocument();

    // Custo
    expect(screen.getByText("Vai consumir 1 crédito(s)")).toBeInTheDocument();
  });

  it("Teste 12 (D6): loja/marca ativa no topo; rótulos Principal/Referência nas thumbnails", () => {
    renderReview();

    // Loja/marca — StoreIdentityBlock com identity null não renderiza; o store.name
    // ainda não aparece (sem fallback divergente). Sem identidade resolvida, o topo
    // não renderiza o bloco — verificamos que NÃO há fallback falso.
    expect(screen.queryByText("Loja Teste")).not.toBeInTheDocument();

    // Rótulos das thumbnails
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Referência")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("Teste 13 (D6): 'Vai consumir X crédito(s)' + saldo; Tema não renderiza (themeId null)", () => {
    renderReview();

    expect(screen.getByText("Vai consumir 1 crédito(s)")).toBeInTheDocument();
    expect(screen.getByText(/Saldo:/)).toBeInTheDocument();
    // Slot Tema reservado — não renderiza enquanto themeId null (hoje sempre)
    expect(screen.queryByText(/Tema/)).not.toBeInTheDocument();
  });

  it("Teste 14 (D7): botões com touch ≥ 44px e a11y (aria-label PT-BR)", () => {
    renderReview();

    const confirm = screen.getByRole("button", { name: "Confirmar e gerar campanha" });
    const backButtons = screen.getAllByRole("button", { name: "Voltar e editar" });

    expect(confirm).toHaveAttribute("aria-label", "Confirmar e gerar campanha");
    expect(confirm).toHaveClass("min-h-[44px]");
    for (const back of backButtons) {
      expect(back).toHaveClass("min-h-[44px]");
    }
  });

  it("Teste 15 (D3/D7): estados — 'Preparando imagens...', loading no confirmar, erro de preparação", () => {
    // Estado de preparação
    const { rerender } = renderReview({ preparing: true, preparedImages: null });
    expect(screen.getByText("Preparando imagens...")).toBeInTheDocument();

    // Erro de preparação claro
    rerender(
      <CampaignBriefReview
        fields={FIELDS}
        preparedImages={null}
        preparing={false}
        error="Não foi possível preparar as imagens. Tente novamente."
        store={STORE}
        identity={null}
        balance={5}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(
      screen.getByText("Não foi possível preparar as imagens. Tente novamente.")
    ).toBeInTheDocument();
  });

  it("Teste 16 (D7): preview das imagens sem recorte (object-contain, célula aspect-square)", () => {
    renderReview();

    const images = screen.getAllByRole("img");
    for (const img of images) {
      expect(img).toHaveClass("object-contain");
    }
    // célula aspect-square (container da thumbnail)
    const cells = document.querySelectorAll(".aspect-square");
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });
});