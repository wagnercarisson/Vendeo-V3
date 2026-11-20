// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignInputForm } from "../campaign-input-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const BASE_DRAFT = {
  productName: "Produto local",
  description: "",
  originalPriceCents: 1000,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer",
  preserveImageContext: false,
  productImages: [
    {
      id: "img-1",
      role: "primary",
      source: "upload",
      mimeType: "image/jpeg",
      dataUrl: VALID_DATA_URL,
    },
  ],
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkTextFree: "",
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
  backgroundDirection: "studio",
};

const state = vi.hoisted(() => ({
  draft: null as Record<string, unknown> | null,
  costStatus: "loaded" as "loaded" | "loading" | "unavailable",
  costCredits: 1,
  costEnabled: true,
}));

vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: vi.fn(),
    restoreFormState: () => state.draft,
    clearFormState: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: {
      campaign_generation: {
        costCredits: state.costCredits,
        enabled: state.costEnabled,
      },
    },
    status: state.costStatus,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: () => null,
}));

function setDraft(campaignFormat: "1:1" | "9:16" | "1:1+9:16") {
  state.draft = { ...BASE_DRAFT, campaignFormat };
}

beforeEach(() => {
  state.costStatus = "loaded";
  state.costCredits = 1;
  state.costEnabled = true;
  setDraft("1:1+9:16");
});

describe("F60.7 C2 — formulário montado/pausado", () => {
  it("draft conjunto com flag OFF: pausa, vertical bloqueado e saída explícita visível", () => {
    render(
      <CampaignInputForm
        storeId="store-1"
        balance={5}
        eligible
        verticalEnabled={false}
      />,
    );

    expect(screen.getByText("Envio de dois formatos pausado")).toBeInTheDocument();
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
      screen.getByRole("button", { name: "Usar somente Quadrado" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });

  it("draft conjunto: 'Usar somente Quadrado' converte explicitamente para 1:1 e remove a pausa", () => {
    render(
      <CampaignInputForm
        storeId="store-1"
        balance={5}
        eligible
        verticalEnabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Usar somente Quadrado" }));

    expect(screen.queryByText("Envio de dois formatos pausado")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Usar somente Quadrado" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).not.toBeChecked();
    expect(screen.getByText("Revisar e gerar")).toBeEnabled();
  });

  it("draft vertical: 'Usar somente Quadrado' converte explicitamente para 1:1", () => {
    setDraft("9:16");
    render(
      <CampaignInputForm
        storeId="store-1"
        balance={5}
        eligible
        verticalEnabled={false}
      />,
    );

    expect(screen.getByText("Novo envio vertical pausado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar somente Quadrado" }));

    expect(screen.queryByText("Novo envio vertical pausado")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).not.toBeChecked();
    expect(screen.getByText("Revisar e gerar")).toBeEnabled();
  });

  it("formato indisponível continua pausado e não oferece a ação de conversão", () => {
    setDraft("1:1");
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
    expect(
      screen.queryByRole("button", { name: "Usar somente Quadrado" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });
});

describe("F60.7 C2 — custo/saldo no formulário montado", () => {
  it("conjunto exibe 2 créditos e saldo 1 bloqueia", () => {
    render(
      <CampaignInputForm storeId="store-1" balance={1} eligible verticalEnabled />,
    );

    expect(screen.getByText("Custo: 2")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });

  it("conjunto exibe 2 créditos e saldo 2 permite prosseguir", () => {
    render(
      <CampaignInputForm storeId="store-1" balance={2} eligible verticalEnabled />,
    );

    expect(screen.getByText("Custo: 2")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeEnabled();
  });

  it("individual mantém o custo atual e saldo 1 permite", () => {
    setDraft("9:16");
    render(
      <CampaignInputForm storeId="store-1" balance={1} eligible verticalEnabled />,
    );

    expect(screen.getByText("Custo: 1")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeEnabled();
  });

  it("costStatus loading continua bloqueando, mesmo no conjunto", () => {
    state.costStatus = "loading";
    render(
      <CampaignInputForm storeId="store-1" balance={5} eligible verticalEnabled />,
    );

    expect(screen.getByText("Custo: …")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });

  it("costStatus unavailable continua bloqueando, mesmo no conjunto", () => {
    state.costStatus = "unavailable";
    render(
      <CampaignInputForm storeId="store-1" balance={5} eligible verticalEnabled />,
    );

    expect(screen.getByText("Serviço indisponível no momento")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });

  it("operação desabilitada continua bloqueando, mesmo no conjunto", () => {
    state.costEnabled = false;
    render(
      <CampaignInputForm storeId="store-1" balance={5} eligible verticalEnabled />,
    );

    expect(screen.getByText("Operação desativada")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });

  it("saldo desconhecido continua bloqueando, mesmo no conjunto", () => {
    render(
      <CampaignInputForm storeId="store-1" balance={null} eligible verticalEnabled />,
    );

    expect(
      screen.getByText("Não foi possível confirmar seu saldo. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });
});

describe("F60.7 C2 — jornada montada seleção → custo/saldo → revisão → voltar", () => {
  it("transição vertical → conjunto → 1:1 atualiza o custo e o bloqueio por saldo", () => {
    setDraft("9:16");
    render(
      <CampaignInputForm storeId="store-1" balance={1} eligible verticalEnabled />,
    );

    expect(screen.getByText("Custo: 1")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" }));
    expect(screen.getByText("Custo: 2")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    );
    expect(screen.getByText("Custo: 1")).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeEnabled();
  });

  it("entra na revisão com 2 créditos e volta preservando o conjunto", async () => {
    render(
      <CampaignInputForm storeId="store-1" balance={2} eligible verticalEnabled />,
    );

    fireEvent.click(screen.getByText("Revisar e gerar"));

    expect(await screen.findByText("Vai consumir 2 créditos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar e gerar campanha" }),
    ).toBeEnabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Voltar e editar" })[0]);

    expect(
      screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeChecked();
    expect(screen.getByText("Custo: 2")).toBeInTheDocument();
  });
});
