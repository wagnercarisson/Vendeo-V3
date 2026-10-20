// @vitest-environment jsdom
/**
 * Regressão de UI: "Preservar imagem original" é exclusiva do fluxo legado.
 *
 * No novo fluxo elegível, `backgroundDirection` (Estúdio/Ambientado/Original) é
 * o único controle dessa escolha. A checkbox permanece intacta no legado,
 * inclusive em Destaque/Exclusivo, e ausente em Oferta.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CampaignFormFields } from "../use-campaign-form";

const { mockUseCampaignForm, mockUseOperationCosts } = vi.hoisted(() => ({
  mockUseCampaignForm: vi.fn(),
  mockUseOperationCosts: vi.fn(),
}));

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/flow/use-campaign-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../use-campaign-form")>();
  return {
    ...actual,
    inferIntent: vi.fn(() => "offer" as const),
    useCampaignForm: () => mockUseCampaignForm(),
  };
});

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: () => null,
}));

vi.mock("@/lib/constants", () => ({
  BADGE_OPTIONS: ["Oferta", "Lançamento", "Promoção"],
  BADGE_OPTIONS_BY_INTENT: {
    offer: ["Promoção", "Oferta"],
    spotlight: ["Novidade", "Lançamento"],
    exclusive: ["Exclusivo", "Premium"],
  },
}));

vi.mock("@/components/campaign/illustrative-notice-field", () => ({
  IllustrativeNoticeField: () => null,
}));

vi.mock("@/components/campaign/validity-field", () => ({
  ValidityField: () => null,
}));

vi.mock("@/components/flow/generation-progress", () => ({
  GenerationProgress: () => null,
}));

import { CampaignInputForm } from "../campaign-input-form";

function makeHookState(fieldOverrides: Partial<CampaignFormFields> = {}) {
  return {
    fields: {
      productName: "Produto Teste",
      description: "",
      originalPriceCents: 0,
      discountedPriceCents: 0,
      badge: "",
      campaignIntent: "spotlight",
      preserveImageContext: false,
      backgroundDirection: "studio",
      productImages: [],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "until-date",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
      ...fieldOverrides,
    } as CampaignFormFields,
    fieldErrors: {} as Record<string, string | undefined>,
    touched: {} as Record<string, boolean>,
    setField: vi.fn(),
    handleBlur: vi.fn(),
    displayPriceOriginal: "",
    displayPriceDiscounted: "",
    handlePriceOriginalChange: vi.fn(),
    handlePriceDiscountedChange: vi.fn(),
    imagePreviewUrl: null,
    isSubmitting: false,
    submitError: null,
    retrySubmit: vi.fn(),
    pendingConflict: null,
    handleConflictContinue: vi.fn(),
    handleConflictCorrect: vi.fn(),
    handleConflictCancel: vi.fn(),
    phases: [],
    addImage: vi.fn(),
    removeImage: vi.fn(),
    reviewMode: false,
    preparing: false,
    preparedImages: [],
    reviewError: null,
    enterReview: vi.fn(),
    exitReview: vi.fn(),
    confirmReview: vi.fn(),
    unknownResult: null,
    resetUnknownResult: vi.fn(),
    invalidateTerminalIdentity: vi.fn(),
    restorationNotice: null,
    backgroundDirectionNotice: null,
    backgroundDirectionRequired: false,
  };
}

const PRESERVE_LABEL = "Preservar imagem original";

function renderForm(eligible: boolean) {
  return render(<CampaignInputForm storeId="store-1" balance={5} eligible={eligible} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseOperationCosts.mockReturnValue({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  });
});

describe("CampaignInputForm — Preservar imagem original × direção de fundo", () => {
  it.each(["spotlight", "exclusive", "offer"] as const)(
    "novo fluxo elegível (%s): exibe o seletor de cenários e oculta a checkbox",
    (campaignIntent) => {
      mockUseCampaignForm.mockReturnValue(makeHookState({ campaignIntent }));
      renderForm(true);

      expect(screen.getByTestId("flow-background-direction-selector")).toBeInTheDocument();
      expect(screen.queryByLabelText(PRESERVE_LABEL)).toBeNull();
      expect(screen.queryByText(PRESERVE_LABEL)).toBeNull();
    },
  );

  it.each(["spotlight", "exclusive"] as const)(
    "legado (%s): preserva a checkbox e não monta o seletor de cenários",
    (campaignIntent) => {
      mockUseCampaignForm.mockReturnValue(makeHookState({ campaignIntent }));
      renderForm(false);

      expect(screen.getByLabelText(PRESERVE_LABEL)).toBeInTheDocument();
      expect(screen.queryByTestId("flow-background-direction-selector")).toBeNull();
    },
  );

  it("legado (offer): mantém a checkbox oculta", () => {
    mockUseCampaignForm.mockReturnValue(makeHookState({ campaignIntent: "offer" }));
    renderForm(false);

    expect(screen.queryByLabelText(PRESERVE_LABEL)).toBeNull();
    expect(screen.queryByTestId("flow-background-direction-selector")).toBeNull();
  });
});

function expectBefore(first: Element, second: Element) {
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

describe("CampaignInputForm — ordem visual das seções", () => {
  it("novo fluxo elegível: preços → intenção → selo → direção de fundo", () => {
    mockUseCampaignForm.mockReturnValue(makeHookState({ campaignIntent: "spotlight" }));
    renderForm(true);

    const originalPrice = document.getElementById("originalPrice")!;
    const discountedPrice = document.getElementById("discountedPrice")!;
    const intent = screen.getByText("Intenção da campanha");
    const badge = document.getElementById("badge")!;
    const direction = screen.getByTestId("flow-background-direction-selector");

    expectBefore(originalPrice, intent);
    expectBefore(discountedPrice, intent);
    expectBefore(intent, badge);
    expectBefore(badge, direction);
  });

  it("legado: preços → intenção → selo (sem direção de fundo)", () => {
    mockUseCampaignForm.mockReturnValue(makeHookState({ campaignIntent: "spotlight" }));
    renderForm(false);

    const originalPrice = document.getElementById("originalPrice")!;
    const discountedPrice = document.getElementById("discountedPrice")!;
    const intent = screen.getByText("Intenção da campanha");
    const badge = document.getElementById("badge")!;

    expectBefore(originalPrice, intent);
    expectBefore(discountedPrice, intent);
    expectBefore(intent, badge);
    expect(screen.queryByTestId("flow-background-direction-selector")).toBeNull();
  });
});
