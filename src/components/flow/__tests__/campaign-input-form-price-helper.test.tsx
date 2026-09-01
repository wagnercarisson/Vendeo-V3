// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignInputForm } from "../campaign-input-form";
import { CampaignAdjustmentsPanel } from "@/components/campaign/campaign-adjustments-panel";
import type { CampaignSpec } from "@/lib/campaign-intelligence/schema";
import type { CampaignAdjustments } from "@/components/campaign/types";

const mockUseOperationCosts = vi.fn(() => ({
  costs: { campaign_generation: { costCredits: 1, enabled: true } },
  status: "loaded",
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/flow/use-campaign-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/flow/use-campaign-form")>();
  return {
    ...actual,
    inferIntent: vi.fn(() => "offer" as const),
    useCampaignForm: () => ({
      fields: {
        productName: "Produto Teste",
        productImages: [],
        originalPriceCents: 10000,
        discountedPriceCents: 1990,
        description: "",
        badge: "Oferta",
        campaignIntent: "offer",
        preserveImageContext: false,
        mandatoryArtworkText: "",
        showIllustrativeNotice: true,
        mandatoryArtworkTextFree: "",
        validityMode: "until-date",
        validityStartDate: "",
        validityEndDate: "",
        validityCustomText: "",
      },
      fieldErrors: {},
      touched: {},
      setField: vi.fn(),
      handleBlur: vi.fn(),
      displayPriceOriginal: "R$ 100,00",
      displayPriceDiscounted: "R$ 19,90",
      handlePriceOriginalChange: vi.fn(),
      handlePriceDiscountedChange: vi.fn(),
      imagePreviewUrl: null,
      isSubmitting: false,
      submitError: null,
      setSubmitError: vi.fn(),
      handleSubmit: vi.fn(),
      pendingConflict: null,
      handleConflictContinue: vi.fn(),
      handleConflictCorrect: vi.fn(),
      handleConflictCancel: vi.fn(),
      phases: [],
    }),
  };
});

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: ({ variant }: { variant: string }) =>
    variant !== "normal" ? <button>Solicitar créditos</button> : null,
}));

vi.mock("@/lib/constants", () => ({
  BADGE_OPTIONS: ["Oferta", "Lançamento", "Promoção"],
  BADGE_OPTIONS_BY_INTENT: {
    offer: ["Promoção", "Oferta", "Queima de Estoque", "Últimas Unidades", "Imperdível"],
    spotlight: ["Novidade", "Lançamento", "Mais Vendido", "Top de Linha", "Destaque da Semana"],
    exclusive: ["Exclusivo", "Premium", "Sob Encomenda", "Edição Limitada"],
  },
}));

vi.mock("@/components/campaign/mandatory-artwork-field", () => ({
  MandatoryArtworkField: () => null,
}));

vi.mock("@/components/campaign/illustrative-notice-field", () => ({
  IllustrativeNoticeField: () => null,
}));

vi.mock("@/components/campaign/validity-field", () => ({
  ValidityField: () => null,
}));

vi.mock("@/components/flow/campaign-image-upload", () => ({
  CampaignImageUpload: () => null,
}));

vi.mock("@/components/flow/generation-progress", () => ({
  GenerationProgress: () => null,
}));

describe("CampaignInputForm — seção Oferta: label 'Preço Final' e helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOperationCosts.mockReturnValue({
      costs: { campaign_generation: { costCredits: 1, enabled: true } },
      status: "loaded",
      refetch: vi.fn(),
    });
  });

  it("exibe o label 'Preço Final' para o campo de desconto", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} />);
    expect(screen.getByLabelText("Preço Final")).toBeInTheDocument();
  });

  it("label do campo de desconto NÃO contém asterisco fixo", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} />);
    const label = screen.getByText("Preço Final");
    expect(label.textContent).toBe("Preço Final");
    expect(label.textContent).not.toMatch(/Preço Final\s*\*/);
  });

  it("label do campo de desconto NÃO exibe '(opcional)' (escopo: só o label do campo discountedPrice, não a página inteira)", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} />);
    const label = screen.getByText("Preço Final");
    expect(label.textContent).toBe("Preço Final");
    expect(label.textContent).not.toContain("(opcional)");
  });

  it("helper sob 'Oferta' renderiza a microcopy de mapeamento preço → intenção", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} />);
    expect(screen.getByText("Os campos de preço definem a intenção da campanha:")).toBeInTheDocument();
    expect(screen.getByText("Preço original + preço final = Oferta")).toBeInTheDocument();
    expect(screen.getByText("Somente preço final = Oferta ou Destaque")).toBeInTheDocument();
    expect(screen.getByText("Sem nenhum preço preenchido = Destaque ou Exclusividade")).toBeInTheDocument();
  });
});

describe("CampaignAdjustmentsPanel — consistência de UI no painel pós-formulário", () => {
  const originalSpec: CampaignSpec = {
    commercial_copy: {
      title: "Título original",
      subtitle: "Subtítulo original",
      hook: "Chamada original",
      cta: "Comprar agora",
    },
    offer: {
      product_name: "Produto Teste",
      original_price_display: "R$ 100,00",
      discounted_price_display: "R$ 19,90",
      badge_text: "Oferta",
    },
    visual_parameters: {
      layout_preset: "top-banner",
      composition_type: "product-left",
      hierarchy_focus: "price",
      palette_accent: "#EC4899",
      badge_style: "rounded",
      background_style: "gradient",
    },
    generation_metadata: {
      provider: "mock",
      model: "test",
      generated_at: "2026-08-20T10:00:00.000Z",
    },
  };
  const adjustments: CampaignAdjustments = {};

  it("exibe 'Preço Final' no lugar de 'Preço com Desconto'", () => {
    render(
      <CampaignAdjustmentsPanel
        originalSpec={originalSpec}
        adjustments={adjustments}
        onAdjustmentChange={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    expect(screen.getByText("Preço Final")).toBeInTheDocument();
    expect(screen.queryByText("Preço com Desconto")).not.toBeInTheDocument();
  });
});
