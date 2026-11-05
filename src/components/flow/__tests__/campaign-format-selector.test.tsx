// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CAMPAIGN_FORMAT_HELPER,
  CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER,
  CampaignFormatSelector,
} from "../campaign-format-selector";

function renderSelector(overrides: Partial<React.ComponentProps<typeof CampaignFormatSelector>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <CampaignFormatSelector value="1:1" onChange={onChange} {...overrides} />,
  );
  return { ...utils, onChange };
}

describe("CampaignFormatSelector (F59/D-03)", () => {
  it("renderiza a estrutura, a legenda sr-only e os labels exatos", () => {
    renderSelector();

    const section = screen.getByTestId("flow-campaign-format-selector");
    expect(section).toHaveAttribute("aria-labelledby", "campaignFormat-legend");
    expect(screen.getByText("Selecione o formato da campanha")).toHaveClass("sr-only");
    expect(screen.getByRole("radio", { name: "Quadrado 1:1 - feed" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeInTheDocument();
  });

  it("default 1:1, helper sempre visível e aria-describedby nos dois radios", () => {
    renderSelector();

    const square = screen.getByRole("radio", { name: "Quadrado 1:1 - feed" });
    const vertical = screen.getByRole("radio", {
      name: "Vertical 9:16 - Stories e Reels (imagem estática)",
    });
    expect(square).toBeChecked();
    expect(vertical).not.toBeChecked();
    expect(screen.getByText(CAMPAIGN_FORMAT_HELPER)).toBeInTheDocument();
    expect(square).toHaveAttribute("aria-describedby", "campaignFormat-helper");
    expect(vertical).toHaveAttribute("aria-describedby", "campaignFormat-helper");
    expect(CAMPAIGN_FORMAT_HELPER).toBe(
      "Imagem estática, sem vídeo. As áreas seguras seguem a política do Vendeo e podem variar conforme a plataforma.",
    );
  });

  it("selecionar vertical dispara onChange com 9:16", () => {
    const { onChange } = renderSelector();
    fireEvent.click(
      screen.getByRole("radio", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    );
    expect(onChange).toHaveBeenCalledWith("9:16");
  });

  it("aplica o alvo de 44px e o anel de foco no container de cada opção", () => {
    renderSelector();
    const square = screen.getByRole("radio", { name: "Quadrado 1:1 - feed" });
    const label = square.closest("label");
    expect(label).toHaveClass("min-h-[44px]");
    expect(label).toHaveClass("focus-within:ring-2");
  });

  it("disabled desabilita ambos os radios e reduz a opacidade", () => {
    renderSelector({ disabled: true });
    expect(screen.getByRole("radio", { name: "Quadrado 1:1 - feed" })).toBeDisabled();
    expect(
      screen.getByRole("radio", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: "Quadrado 1:1 - feed" }).closest("label"),
    ).toHaveClass("cursor-not-allowed");
  });

  it("verticalEnabled=false mantém o seletor visível e desabilita só o 9:16", () => {
    renderSelector({ verticalEnabled: false });
    expect(
      screen.getByTestId("flow-campaign-format-selector"),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Quadrado 1:1 - feed" })).toBeEnabled();
    expect(
      screen.getByRole("radio", {
        name: "Vertical 9:16 - Stories e Reels (imagem estática)",
      }),
    ).toBeDisabled();
    expect(
      screen.getByTestId("flow-campaign-format-vertical-disabled"),
    ).toHaveTextContent(CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER);
  });

  it("verticalEnabled=true não exibe o aviso de indisponibilidade", () => {
    renderSelector({ verticalEnabled: true });
    expect(
      screen.queryByTestId("flow-campaign-format-vertical-disabled"),
    ).not.toBeInTheDocument();
  });
});
