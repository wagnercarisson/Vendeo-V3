// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * F49 (D2/D3/D8/D9/D10/D13/D14) — testes de orientação contextual,
 * acessibilidade e feedback dinâmico de preço dos campos da campanha.
 *
 * As asserções importam as strings e `priceFeedbackMessage` do módulo puro
 * `@/lib/campaign/field-guidance` (fonte única — T-49-02). O `CampaignImageUpload`
 * e o `MandatoryArtworkField` são renderizados REAIS (não stubs) para que
 * `role="group"`/`aria-labelledby`/`aria-describedby` e o valor multi-linha sejam
 * efetivamente verificados.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PRODUCT_DESCRIPTION_HINT,
  PRODUCT_DESCRIPTION_LABEL,
  PRODUCT_DESCRIPTION_PLACEHOLDER,
  ORIGINAL_PRICE_LABEL,
  DISCOUNTED_PRICE_LABEL,
  ORIGINAL_PRICE_HINT,
  DISCOUNTED_PRICE_HINT,
  PRICE_HELP_TITLE,
  PRICE_HELP_RULES,
  priceFeedbackMessage,
} from "@/lib/campaign/field-guidance";
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
  const actual = await importOriginal<typeof import("@/components/flow/use-campaign-form")>();
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
    offer: ["Promoção", "Oferta", "Queima de Estoque", "Últimas Unidades", "Imperdível"],
    spotlight: ["Novidade", "Lançamento", "Mais Vendido", "Top de Linha", "Destaque da Semana"],
    exclusive: ["Exclusivo", "Premium", "Sob Encomenda", "Edição Limitada"],
  },
}));

// NÃO mockamos `campaign-image-upload` nem `mandatory-artwork-field`: os
// componentes reais são necessários para as asserções de grupo acessível e de
// valor multi-linha.
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

// ── Helpers ────────────────────────────────────────────────────────────────

function makeHookState(
  fieldOverrides: Partial<CampaignFormFields> = {},
  extra: Record<string, unknown> = {},
) {
  return {
    fields: {
      productName: "Produto Teste",
      description: "",
      originalPriceCents: 0,
      discountedPriceCents: 0,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
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
    setSubmitError: vi.fn(),
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
    ...extra,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function describedByIds(el: HTMLElement): string[] {
  const describedBy = el.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const ids = describedBy!.split(" ").filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    expect(document.getElementById(id)).not.toBeNull();
  }
  return ids;
}

function renderForm() {
  return render(<CampaignInputForm storeId="store-1" balance={5} />);
}

/**
 * Lê o texto do feedback dinâmico pelo id referenciado em `aria-describedby` do
 * campo de preço — imune à normalização de espaços do `getByText` (o valor BRL
 * do `Intl` pt-BR usa espaço não separável U+00A0).
 */
function readPriceFeedback(): string {
  const originalPrice = document.getElementById("originalPrice")!;
  const ids = originalPrice.getAttribute("aria-describedby")!.split(" ").filter(Boolean);
  const feedbackId = ids.find((id) => id.endsWith("-feedback"))!;
  return document.getElementById(feedbackId)!.textContent ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseOperationCosts.mockReturnValue({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  });
  mockUseCampaignForm.mockReturnValue(makeHookState());
});

// ── Testes ─────────────────────────────────────────────────────────────────

describe("CampaignInputForm — orientação contextual (F49)", () => {
  it("7.1 exibe 'Descrição do produto' com microcopy/placeholder e labels de preço com hints", () => {
    renderForm();

    expect(
      screen.getByLabelText(new RegExp(escapeRegExp(PRODUCT_DESCRIPTION_LABEL))),
    ).toHaveAttribute("placeholder", PRODUCT_DESCRIPTION_PLACEHOLDER);
    expect(screen.getByText(PRODUCT_DESCRIPTION_HINT)).toBeInTheDocument();
    expect(screen.getByText(ORIGINAL_PRICE_LABEL, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(DISCOUNTED_PRICE_LABEL, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(ORIGINAL_PRICE_HINT)).toBeInTheDocument();
    expect(screen.getByText(DISCOUNTED_PRICE_HINT)).toBeInTheDocument();
  });

  it("7.2 associa hint/feedback/erro por aria-describedby e usa aria-required sem required nativo", () => {
    const state = makeHookState(
      {},
      {
        touched: { badge: true },
        fieldErrors: { badge: "Selecione um selo promocional" },
      },
    );
    mockUseCampaignForm.mockReturnValue(state);
    renderForm();

    const description = document.getElementById("description")!;
    const originalPrice = document.getElementById("originalPrice")!;
    const discountedPrice = document.getElementById("discountedPrice")!;

    // aria-describedby não vazio, ids resolvem, hint presente.
    const descIds = describedByIds(description);
    expect(
      descIds.map((id) => document.getElementById(id)!.textContent),
    ).toContain(PRODUCT_DESCRIPTION_HINT);

    const originalIds = describedByIds(originalPrice);
    expect(
      originalIds.map((id) => document.getElementById(id)!.textContent),
    ).toContain(ORIGINAL_PRICE_HINT);

    const discountedIds = describedByIds(discountedPrice);
    expect(
      discountedIds.map((id) => document.getElementById(id)!.textContent),
    ).toContain(DISCOUNTED_PRICE_HINT);

    // Obrigatórios (offer): aria-required sem required nativo.
    const productName = document.getElementById("productName")!;
    const badge = document.getElementById("badge")!;
    for (const el of [productName, discountedPrice, badge]) {
      expect(el).toHaveAttribute("aria-required", "true");
      expect(el).not.toHaveAttribute("required");
    }

    // Erro de #badge: aria-describedby aponta para o id do erro + aria-invalid.
    const badgeIds = describedByIds(badge);
    const badgeError = badgeIds
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("Selecione um selo promocional"));
    expect(badgeError).toBeTruthy();
    expect(badge).toHaveAttribute("aria-invalid", "true");
  });

  it("7.2 associa os erros de #description, #originalPrice e #discountedPrice e compartilha o feedback entre os preços", () => {
    mockUseCampaignForm.mockReturnValue(
      makeHookState(
        {},
        {
          touched: { description: true, originalPriceCents: true, discountedPriceCents: true },
          fieldErrors: {
            description: "Descreva o produto",
            originalPriceCents: "Preço anterior inválido",
            discountedPriceCents: "Preço de venda inválido",
          },
        },
      ),
    );
    renderForm();

    const description = document.getElementById("description")!;
    const originalPrice = document.getElementById("originalPrice")!;
    const discountedPrice = document.getElementById("discountedPrice")!;

    const descIds = describedByIds(description);
    const descError = descIds
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("Descreva o produto"));
    expect(descError).toBeTruthy();
    expect(description).toHaveAttribute("aria-invalid", "true");

    const originalIds = describedByIds(originalPrice);
    const originalError = originalIds
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("Preço anterior inválido"));
    expect(originalError).toBeTruthy();
    expect(originalPrice).toHaveAttribute("aria-invalid", "true");

    const discountedIds = describedByIds(discountedPrice);
    const discountedError = discountedIds
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("Preço de venda inválido"));
    expect(discountedError).toBeTruthy();
    expect(discountedPrice).toHaveAttribute("aria-invalid", "true");

    // Os dois campos de preço referenciam o MESMO elemento de feedback dinâmico.
    const originalFeedback = originalIds.find((id) => id.endsWith("-feedback"));
    const discountedFeedback = discountedIds.find((id) => id.endsWith("-feedback"));
    expect(originalFeedback).toBeTruthy();
    expect(discountedFeedback).toBe(originalFeedback);
  });

  it("7.2 o grupo da imagem primária expõe obrigatoriedade acessível (role=group, aria-labelledby/aria-describedby) sem aria-required/required", () => {
    renderForm();

    const group = screen.getByRole("group", { name: /Imagem do Produto/ });
    expect(group).toHaveAttribute("aria-labelledby", "productImages-label");
    const ids = describedByIds(group);
    expect(ids).toContain("productImages-required");
    expect(document.getElementById("productImages-required")).toHaveTextContent(
      "Imagem do produto obrigatória",
    );
    expect(group).not.toHaveAttribute("aria-required");
    expect(group.querySelectorAll("[required]")).toHaveLength(0);
  });

  it("7.2 o grupo da imagem inclui o erro em aria-describedby + aria-invalid quando ativo", () => {
    mockUseCampaignForm.mockReturnValue(
      makeHookState(
        {},
        {
          touched: { productImages: true },
          fieldErrors: { productImages: "Envie a imagem do produto" },
        },
      ),
    );
    renderForm();

    const group = screen.getByRole("group", { name: /Imagem do Produto/ });
    const ids = describedByIds(group);
    expect(ids).toContain("productImages-required");
    const errorId = ids.find((id) => id !== "productImages-required");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent("Envie a imagem do produto");
    expect(group).toHaveAttribute("aria-invalid", "true");
  });

  it("7.4 a ajuda expansível 'Como os preços mudam a campanha?' começa colapsada (hidden) e revela as 3 regras ao abrir", () => {
    renderForm();

    const trigger = screen.getByRole("button", { name: PRICE_HELP_TITLE });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const regionId = trigger.getAttribute("aria-controls");
    expect(regionId).toBeTruthy();
    expect(document.getElementById(regionId!)).not.toBeNull();

    for (const rule of PRICE_HELP_RULES) {
      expect(screen.getByText(rule)).not.toBeVisible();
    }

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(regionId!)).not.toBeNull();
    for (const rule of PRICE_HELP_RULES) {
      expect(screen.getByText(rule)).toBeVisible();
    }
  });

  it("7.5 dois preços: feedback de oferta com valores BRL", () => {
    mockUseCampaignForm.mockReturnValue(
      makeHookState({ originalPriceCents: 10000, discountedPriceCents: 1990 }),
    );
    renderForm();
    expect(readPriceFeedback()).toBe(priceFeedbackMessage(10000, 1990));
  });

  it("7.5 só preço de venda: feedback de Oferta ou Destaque", () => {
    mockUseCampaignForm.mockReturnValue(
      makeHookState({ originalPriceCents: 0, discountedPriceCents: 1990 }),
    );
    renderForm();
    expect(readPriceFeedback()).toBe(priceFeedbackMessage(0, 1990));
  });

  it("7.5 só preço anterior: feedback neutro, sem 'Sem preço'", () => {
    mockUseCampaignForm.mockReturnValue(
      makeHookState({ originalPriceCents: 10000, discountedPriceCents: undefined }),
    );
    renderForm();
    const feedback = readPriceFeedback();
    expect(feedback).toBe(priceFeedbackMessage(10000, undefined));
    expect(feedback).not.toContain("Sem preço");
    expect(screen.queryByText(/Sem preço/)).toBeNull();
  });

  it("7.5 sem preço: feedback de Destaque ou Exclusividade", () => {
    mockUseCampaignForm.mockReturnValue(
      makeHookState({ originalPriceCents: 0, discountedPriceCents: undefined }),
    );
    renderForm();
    expect(readPriceFeedback()).toBe(priceFeedbackMessage(0, undefined));
  });

  it("7.6 restaura os valores preenchidos e a orientação não provoca setField", () => {
    const state = makeHookState({
      description: "Tênis leve para corrida e uso diário",
      mandatoryArtworkTextFree: "Intensidade 8\nTorra clássica\nPeso líquido 500 g",
    });
    mockUseCampaignForm.mockReturnValue(state);
    renderForm();

    const description = document.getElementById("description") as HTMLTextAreaElement;
    expect(description).toHaveValue("Tênis leve para corrida e uso diário");

    const mandatory = document.getElementById(
      "mandatoryArtworkText",
    ) as HTMLTextAreaElement;
    expect(mandatory).toHaveValue("Intensidade 8\nTorra clássica\nPeso líquido 500 g");

    // A renderização da orientação não altera os valores.
    expect(state.setField).not.toHaveBeenCalled();
  });
});
