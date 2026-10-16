// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CampaignInputForm } from "../campaign-input-form";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 06 (correção): o formulário CONSOME a resolução do painel de
// resultado desconhecido. Em `refunded`, o estado do formulário (`unknownResult`)
// é LIMPO (via `resetUnknownResult`) e o terminal persistido é exibido — o usuário
// não fica preso na Superfície 3.
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const mockResetUnknownResult = vi.fn();
const mockInvalidateTerminalIdentity = vi.fn();

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
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
        backgroundDirection: "studio",
      },
      fieldErrors: {},
      touched: {},
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
      retrySubmit: vi.fn(),
      resetSubmit: vi.fn(),
      isValid: true,
      pendingConflict: null,
      handleConflictContinue: vi.fn(),
      handleConflictCorrect: vi.fn(),
      handleConflictCancel: vi.fn(),
      phases: [],
      onPhaseChange: vi.fn(),
      addImage: vi.fn(),
      removeImage: vi.fn(),
      reviewMode: false,
      preparing: false,
      preparedImages: null,
      reviewError: null,
      enterReview: vi.fn(async () => true),
      exitReview: vi.fn(),
      confirmReview: vi.fn(async () => {}),
      unknownResult: {
        supportReference: "IMG-001-abc",
        operationId: OPERATION_ID,
        campaignId: CAMPAIGN_ID,
      },
      resetUnknownResult: mockResetUnknownResult,
      invalidateTerminalIdentity: mockInvalidateTerminalIdentity,
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

vi.mock("@/components/flow/campaign-image-upload", () => ({
  CampaignImageUpload: () => null,
}));

vi.mock("@/components/flow/generation-progress", () => ({
  GenerationProgress: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CampaignInputForm — consumidor da resolução do resultado desconhecido", () => {
  it("`refunded` na reverificação ⇒ invalida a identidade terminal e NÃO renderiza a superfície antiga", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ operation: { state: "refunded" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<CampaignInputForm storeId="store-1" balance={5} supportEmail="suporte@vendeo.app" />);

    // Superfície 3 exibida (estado desconhecido).
    expect(
      screen.getByText("Não foi possível confirmar a conclusão desta geração"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Verificar novamente"));

    await waitFor(() => expect(mockResetUnknownResult).toHaveBeenCalled());
    expect(mockInvalidateTerminalIdentity).toHaveBeenCalled();
    // Recorte 2 (Plano 09): NÃO renderiza a superfície vermelha antiga — o painel
    // encaminha ao DETALHE, que reutiliza o `RefundedPanel`.
    expect(screen.queryByText("A geração falhou e o crédito foi devolvido.")).toBeNull();
  });
});
