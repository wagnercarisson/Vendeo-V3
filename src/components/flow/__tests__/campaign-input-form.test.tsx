// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignInputForm } from "../campaign-input-form";

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

// useCampaignForm é mockado com estado de erro de data, mas o MÓDULO real é
// preservado (importOriginal) para que o ValidityField REAL renderize com seus
// helpers de máscara — valida o wiring hook → UI sem mockar o componente.
vi.mock("@/components/flow/use-campaign-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/flow/use-campaign-form")>();
  return {
    ...actual,
    inferIntent: vi.fn(() => "offer" as const),
    useCampaignForm: () => ({
      fields: {
        productName: "Produto Teste",
        productImages: [],
        originalPriceCents: 0,
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
      fieldErrors: {
        validityEndDate: "Informe uma data válida (dd/mm/aaaa)",
      },
      touched: {
        validityEndDate: true,
      },
      setField: vi.fn(),
      handleBlur: vi.fn(),
      displayPriceOriginal: "",
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

// ValidityField NÃO é mockado — este teste prova que o erro do hook
// (fieldErrors + touched) chega à UI através do componente real.

vi.mock("@/components/flow/campaign-image-upload", () => ({
  CampaignImageUpload: () => null,
}));

vi.mock("@/components/flow/generation-progress", () => ({
  GenerationProgress: () => null,
}));

describe("CampaignInputForm — erro de data chega à UI via ValidityField real", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOperationCosts.mockReturnValue({
      costs: { campaign_generation: { costCredits: 1, enabled: true } },
      status: "loaded",
      refetch: vi.fn(),
    });
  });

  it("renderiza 'Informe uma data válida (dd/mm/aaaa)' vindo de fieldErrors/touched", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} />);
    expect(screen.getByText("Informe uma data válida (dd/mm/aaaa)")).toBeInTheDocument();
  });
});