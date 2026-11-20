// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampaignFormatSelector } from "../campaign-format-selector";
import { CampaignBriefReview } from "../campaign-brief-review";
import type { CampaignFormFields } from "../use-campaign-form";

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
}));
vi.mock("@/components/credit/credit-cta", () => ({ CreditCta: () => null }));

const fields: CampaignFormFields = {
  productName: "Produto conjunto",
  description: "",
  originalPriceCents: 10000,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer",
  preserveImageContext: false,
  productImages: [],
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkTextFree: "",
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
  campaignFormat: "1:1+9:16",
};

describe("F60.7 C2 — seletor conjunto", () => {
  it("conjunto deriva os dois checkboxes marcados e o helper de dois créditos", () => {
    render(
      <CampaignFormatSelector
        value="1:1+9:16"
        onChange={vi.fn()}
        verticalEnabled
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeChecked();
    expect(screen.getByTestId("flow-campaign-format-joint-helper")).toBeInTheDocument();
  });

  it("flag OFF preserva o conjunto visível, desabilita só o vertical e não converte", () => {
    render(
      <CampaignFormatSelector
        value="1:1+9:16"
        onChange={vi.fn()}
        verticalEnabled={false}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeDisabled();
    expect(
      screen.getByTestId("flow-campaign-format-vertical-disabled"),
    ).toBeInTheDocument();
  });
});

describe("F60.7 C2 — review conjunto", () => {
  const renderReview = (balance: number) =>
    render(
      <CampaignBriefReview
        fields={fields}
        preparedImages={[
          {
            id: "img",
            role: "primary",
            source: "upload",
            mimeType: "image/jpeg",
            dataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          },
        ]}
        preparing={false}
        error={null}
        eligible
        campaignFormat="1:1+9:16"
        balance={balance}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

  it("renderizar o review não chama geração/continuação", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderReview(5);
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();
    vi.unstubAllGlobals();
  });

  it("mostra dois formatos e 2 créditos; saldo < 2 bloqueia", () => {
    const { unmount } = renderReview(1);
    expect(screen.getByText(/Quadrado 1:1 \+ Vertical 9:16/)).toBeInTheDocument();
    expect(screen.getByText(/2 créditos/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar e gerar campanha" }),
    ).toBeDisabled();
    unmount();
  });

  it("saldo >= 2 libera a confirmação", () => {
    renderReview(2);
    expect(
      screen.getByRole("button", { name: "Confirmar e gerar campanha" }),
    ).toBeEnabled();
  });
});
