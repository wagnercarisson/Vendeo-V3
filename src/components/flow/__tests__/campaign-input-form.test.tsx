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

const hookState = vi.hoisted(() => ({
  reviewMode: false,
  isSubmitting: false,
  preparing: false,
  unknownResult: null as null | {
    supportReference: string | null;
    operationId: string | null;
    campaignId: string | null;
  },
}));

vi.mock("../campaign-brief-review", () => ({
  CampaignBriefReview: () => <div>Revisão</div>,
}));

vi.mock("../unknown-result-panel", () => ({
  UnknownResultPanel: () => <div>Resultado desconhecido</div>,
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
        campaignFormat: "9:16",
        backgroundDirection: "studio",
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
      isSubmitting: hookState.isSubmitting,
      submitError: null,
      setSubmitError: vi.fn(),
      handleSubmit: vi.fn(),
      pendingConflict: null,
      handleConflictContinue: vi.fn(),
      handleConflictCorrect: vi.fn(),
      handleConflictCancel: vi.fn(),
      phases: [],
      reviewMode: hookState.reviewMode,
      preparing: hookState.preparing,
      preparedImages: null,
      reviewError: null,
      enterReview: vi.fn(),
      exitReview: vi.fn(),
      confirmReview: vi.fn(),
      unknownResult: hookState.unknownResult,
      resetUnknownResult: vi.fn(),
      invalidateTerminalIdentity: vi.fn(),
      restorationNotice: null,
      backgroundDirectionNotice: null,
      backgroundDirectionRequired: false,
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
    hookState.reviewMode = false;
    hookState.isSubmitting = false;
    hookState.preparing = false;
    hookState.unknownResult = null;
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

  it("F59/D-03: flag OFF mantém o seletor visível com 9:16 desabilitado", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} eligible />);
    expect(
      screen.getByTestId("flow-campaign-format-selector"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Quadrado 1:1 - feed" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("radio", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeDisabled();
    expect(
      screen.getByTestId("flow-campaign-format-vertical-disabled"),
    ).toBeInTheDocument();
  });

  it("F59/59-08: formato indisponível usa banner próprio, sem afirmar que o rascunho é vertical", () => {
    render(
      <CampaignInputForm
        storeId="store-1"
        balance={5}
        eligible
        campaignFormatPaused
        campaignFormatUnavailable
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Formato indisponível");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível confirmar o formato desta campanha. Nada foi cobrado.",
    );
    expect(screen.queryByText("Novo envio vertical pausado")).not.toBeInTheDocument();
  });

  it("F59/D-03: pausa via prop mantém vertical selecionado, radios desabilitados e subtítulo exato", () => {
    render(
      <CampaignInputForm
        storeId="store-1"
        balance={5}
        eligible
        campaignFormatPaused
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Novo envio vertical pausado");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este rascunho foi criado no formato Vertical 9:16. O envio de novas campanhas verticais está temporariamente indisponível. Sua escolha de formato foi preservada.",
    );
    const vertical = screen.getByRole("radio", {
      name: "Vertical 9:16 - Stories e Reels (imagem estática)",
    });
    const square = screen.getByRole("radio", { name: "Quadrado 1:1 - feed" });
    expect(vertical).toBeChecked();
    expect(vertical).toBeDisabled();
    expect(square).toBeDisabled();

    const submit = screen.getByRole("button", { name: /revisar|gerar/i });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toHaveAttribute(
      "title",
      "O envio de novas campanhas verticais está indisponível no momento.",
    );
  });

  it("edição normal: título/subtítulo e um único seletor, na ordem do cabeçalho", () => {
    render(<CampaignInputForm storeId="store-1" balance={5} eligible />);

    const title = screen.getByRole("heading", { level: 1, name: "Dados da Campanha" });
    const selector = screen.getByTestId("flow-campaign-format-selector");
    expect(screen.getByText("Informe os dados do produto e da oferta")).toBeInTheDocument();
    expect(screen.getAllByTestId("flow-campaign-format-selector")).toHaveLength(1);
    expect(
      title.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("revisão: mantém título/subtítulo, remove o seletor interativo", () => {
    hookState.reviewMode = true;
    render(<CampaignInputForm storeId="store-1" balance={5} eligible />);

    expect(screen.getByRole("heading", { level: 1, name: "Dados da Campanha" })).toBeInTheDocument();
    expect(screen.getByText("Informe os dados do produto e da oferta")).toBeInTheDocument();
    expect(screen.getByText("Revisão")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-campaign-format-selector")).not.toBeInTheDocument();
  });

  it("geração: mantém título/subtítulo, remove o seletor interativo", () => {
    hookState.isSubmitting = true;
    render(<CampaignInputForm storeId="store-1" balance={5} eligible />);

    expect(screen.getByRole("heading", { level: 1, name: "Dados da Campanha" })).toBeInTheDocument();
    expect(screen.getByText("Informe os dados do produto e da oferta")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-campaign-format-selector")).not.toBeInTheDocument();
  });

  it("resultado desconhecido: mantém título/subtítulo, remove o seletor interativo", () => {
    hookState.unknownResult = {
      supportReference: null,
      operationId: "op-1",
      campaignId: "campaign-1",
    };
    render(<CampaignInputForm storeId="store-1" balance={5} eligible />);

    expect(screen.getByRole("heading", { level: 1, name: "Dados da Campanha" })).toBeInTheDocument();
    expect(screen.getByText("Informe os dados do produto e da oferta")).toBeInTheDocument();
    expect(screen.getByText("Resultado desconhecido")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-campaign-format-selector")).not.toBeInTheDocument();
  });
});