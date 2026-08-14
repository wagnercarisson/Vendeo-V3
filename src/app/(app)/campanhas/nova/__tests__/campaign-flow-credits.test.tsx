// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignInputForm } from "@/components/flow/campaign-input-form";

const mockUseOperationCosts = vi.fn(() => ({
  costs: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
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

vi.mock("@/components/flow/use-campaign-form", () => {
  const inferIntent = vi.fn(() => "offer" as const);
  return {
    inferIntent,
    useCampaignForm: () => ({
      fields: {
        productName: "",
        imageFile: null,
        originalPriceCents: 0,
        discountedPriceCents: undefined,
        description: "",
        badge: "",
        campaignIntent: "offer",
        preserveImageContext: false,
        mandatoryArtworkText: "",
        showIllustrativeNotice: true,
        mandatoryArtworkTextFree: "",
        validityMode: "",
        validityStartDate: "",
        validityEndDate: "",
        validityCustomText: "",
      },
      fieldErrors: {},
      touched: {},
      setField: vi.fn(),
      handleBlur: vi.fn(),
      displayPriceOriginal: "",
      displayPriceDiscounted: "",
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

describe("Campaign Flow — Credit Balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOperationCosts.mockReturnValue({
      costs: {
        campaign_generation: { costCredits: 1, enabled: true },
        visual_signature_generation: { costCredits: 1, enabled: true },
      },
      status: "loaded",
      refetch: vi.fn(),
    });
  });

  it("shows balance indicator and enables submit when balance >= 1", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} />);

    expect(screen.getByText("Criar Campanha")).toBeEnabled();
    expect(screen.getByText(/Saldo/)).toBeInTheDocument();
    expect(screen.getByText(/Custo: 1/)).toBeInTheDocument();
  });

  it("disables submit and shows CTA when balance is zero", () => {
    render(<CampaignInputForm storeId="store-1" balance={0} />);

    expect(screen.getByText("Criar Campanha")).toBeDisabled();
    expect(screen.getByText("Solicitar créditos")).toBeInTheDocument();
  });

  it("shows distinct error message when balance is null (error state)", () => {
    render(<CampaignInputForm storeId="store-1" balance={null} />);

    expect(screen.getByText("Criar Campanha")).toBeDisabled();
    expect(screen.getByText(/não foi possível confirmar/i)).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    expect(screen.queryByText("Solicitar créditos")).not.toBeInTheDocument();
  });
});
