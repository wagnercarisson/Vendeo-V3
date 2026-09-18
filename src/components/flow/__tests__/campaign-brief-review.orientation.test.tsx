// @vitest-environment jsdom
//
// F49 (D11/D12) — categorias separáveis da revisão do brief (item OpenSpec 7.8).
// Prova que a seção Avisos apresenta o aviso ilustrativo e as informações
// obrigatórias como itens distintos e rotulados (nunca um bloco concatenado),
// cobre os quatro casos de presença e confirma os rótulos de preço/validade.
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignBriefReview } from "../campaign-brief-review";
import type { CampaignFormFields, PreparedCampaignImage } from "../use-campaign-form";
import { MANDATORY_ARTWORK_LABEL } from "@/lib/campaign/field-guidance";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";

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

const STORE = { name: "Loja Teste", segment: "sports", brand_color: "#123456", id: "store-1" };

function renderReview(fieldOverrides: Partial<CampaignFormFields> = {}) {
  return render(
    <CampaignBriefReview
      fields={{ ...FIELDS, ...fieldOverrides }}
      preparedImages={[PRIMARY]}
      preparing={false}
      error={null}
      store={STORE}
      identity={null}
      balance={5}
      onBack={vi.fn()}
      onConfirm={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetOperationCostsMock();
});

function resetOperationCostsMock() {
  mockUseOperationCosts.mockReturnValue({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  });
}

describe("CampaignBriefReview — categorias separáveis (7.8 / D11/D12)", () => {
  it("caso 'ambos': aviso ilustrativo e informações obrigatórias são itens rotulados distintos", () => {
    renderReview({
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "Frete grátis acima de R$ 199",
    });

    // Os dois itens existem, com seus rótulos canônicos.
    const noticeParagraph = screen.getByText(ILLUSTRATIVE_NOTICE_TEXT).closest("p");
    const mandatoryLabel = screen.getByText(MANDATORY_ARTWORK_LABEL);
    const mandatoryParagraph = mandatoryLabel.closest("p");

    expect(noticeParagraph).not.toBeNull();
    expect(mandatoryParagraph).not.toBeNull();
    expect(screen.getByText("Frete grátis acima de R$ 199")).toBeInTheDocument();

    // Não há concatenação: cada natureza vive no seu próprio parágrafo.
    expect(mandatoryParagraph?.textContent).not.toContain(ILLUSTRATIVE_NOTICE_TEXT);
    expect(noticeParagraph?.textContent).not.toContain(MANDATORY_ARTWORK_LABEL);
  });

  it("caso 'só aviso': apenas o aviso ilustrativo é exibido", () => {
    renderReview({ showIllustrativeNotice: true, mandatoryArtworkTextFree: "" });

    expect(screen.getByText(ILLUSTRATIVE_NOTICE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(MANDATORY_ARTWORK_LABEL)).not.toBeInTheDocument();
  });

  it("caso 'só informações obrigatórias': sem aviso e com quebras de linha preservadas", () => {
    const freeText = "Intensidade 8\nTorra clássica\nPeso líquido 500 g";
    renderReview({ showIllustrativeNotice: false, mandatoryArtworkTextFree: freeText });

    // O aviso ilustrativo NÃO aparece.
    expect(screen.queryByText(ILLUSTRATIVE_NOTICE_TEXT)).not.toBeInTheDocument();

    // O item rotulado aparece com o texto livre.
    const label = screen.getByText(MANDATORY_ARTWORK_LABEL);
    const block = label.parentElement;
    const textEl = block?.querySelector("p.whitespace-pre-line") as HTMLElement | null;

    expect(textEl).not.toBeNull();
    expect(textEl?.className).toContain("whitespace-pre-line");
    expect(textEl?.textContent).toBe(freeText);
    expect(textEl?.textContent?.split("\n")).toEqual([
      "Intensidade 8",
      "Torra clássica",
      "Peso líquido 500 g",
    ]);
  });

  it("caso 'nenhum': exibe 'Sem avisos adicionais.'", () => {
    renderReview({ showIllustrativeNotice: false, mandatoryArtworkTextFree: "" });

    expect(screen.getByText("Sem avisos adicionais.")).toBeInTheDocument();
    expect(screen.queryByText(ILLUSTRATIVE_NOTICE_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(MANDATORY_ARTWORK_LABEL)).not.toBeInTheDocument();
  });

  it("seção Oferta usa 'Preço anterior'/'Preço de venda' e mantém a validade em item próprio", () => {
    renderReview();

    expect(screen.getByText("Preço anterior")).toBeInTheDocument();
    expect(screen.getByText("Preço de venda")).toBeInTheDocument();
    expect(screen.getByText("R$ 299,90")).toBeInTheDocument();
    expect(screen.getByText("R$ 199,90")).toBeInTheDocument();

    expect(screen.getByText("Validade")).toBeInTheDocument();
    expect(screen.getByText("até 30/09/2026")).toBeInTheDocument();
  });
});
