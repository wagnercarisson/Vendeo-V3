// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CAMPAIGN_FORMAT_HELPER,
  CAMPAIGN_FORMAT_REQUIRES_ONE,
  CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER,
  CampaignFormatSelector,
} from "../campaign-format-selector";
import type { CampaignFormatValue } from "../use-campaign-form";

const SQUARE = "Quadrado 1:1 - feed";
const VERTICAL = "Vertical 9:16 - Stories e Reels (imagem estática)";

function renderSelector(
  value: CampaignFormatValue = "1:1",
  overrides: Partial<React.ComponentProps<typeof CampaignFormatSelector>> = {},
) {
  const onChange = vi.fn();
  const utils = render(
    <CampaignFormatSelector value={value} onChange={onChange} {...overrides} />,
  );
  return { ...utils, onChange };
}

describe("CampaignFormatSelector (F59/D-03 / F60.7 C2)", () => {
  it("renderiza estrutura, rótulos e dois checkboxes nativos", () => {
    renderSelector();

    const section = screen.getByTestId("flow-campaign-format-selector");
    expect(section).toHaveAttribute("aria-labelledby", "campaignFormat-heading");
    expect(
      screen.getByRole("heading", { name: "Formato da campanha" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Selecione o formato da campanha")).toHaveClass("sr-only");
    expect(screen.getByRole("checkbox", { name: SQUARE })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: VERTICAL })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("default 1:1 marca somente o quadrado e mantém o helper nos dois checkboxes", () => {
    renderSelector();

    const square = screen.getByRole("checkbox", { name: SQUARE });
    const vertical = screen.getByRole("checkbox", { name: VERTICAL });
    expect(square).toBeChecked();
    expect(vertical).not.toBeChecked();
    expect(screen.getByText(CAMPAIGN_FORMAT_HELPER)).toBeInTheDocument();
    expect(square).toHaveAttribute("aria-describedby", "campaignFormat-helper");
    expect(vertical).toHaveAttribute("aria-describedby", "campaignFormat-helper");
  });

  it("deriva ambos os checkboxes de cada CampaignFormatValue", () => {
    const { rerender } = renderSelector("9:16");
    expect(screen.getByRole("checkbox", { name: SQUARE })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: VERTICAL })).toBeChecked();

    rerender(<CampaignFormatSelector value="1:1+9:16" onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: SQUARE })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: VERTICAL })).toBeChecked();
    expect(
      screen.getByTestId("flow-campaign-format-joint-helper"),
    ).toBeInTheDocument();
  });

  it("1:1 + marcar vertical ⇒ conjunto", () => {
    const { onChange } = renderSelector("1:1");
    fireEvent.click(screen.getByRole("checkbox", { name: VERTICAL }));
    expect(onChange).toHaveBeenCalledWith("1:1+9:16");
  });

  it("9:16 + marcar quadrado ⇒ conjunto", () => {
    const { onChange } = renderSelector("9:16");
    fireEvent.click(screen.getByRole("checkbox", { name: SQUARE }));
    expect(onChange).toHaveBeenCalledWith("1:1+9:16");
  });

  it("conjunto + desmarcar quadrado ⇒ 9:16", () => {
    const { onChange } = renderSelector("1:1+9:16");
    fireEvent.click(screen.getByRole("checkbox", { name: SQUARE }));
    expect(onChange).toHaveBeenCalledWith("9:16");
  });

  it("conjunto + desmarcar vertical ⇒ 1:1", () => {
    const { onChange } = renderSelector("1:1+9:16");
    fireEvent.click(screen.getByRole("checkbox", { name: VERTICAL }));
    expect(onChange).toHaveBeenCalledWith("1:1");
  });

  it("tentar desmarcar o último formato não chama onChange e exibe aviso acessível", () => {
    const { onChange } = renderSelector("1:1");
    fireEvent.click(screen.getByRole("checkbox", { name: SQUARE }));

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("flow-campaign-format-requires-one"),
    ).toHaveTextContent(CAMPAIGN_FORMAT_REQUIRES_ONE);
    expect(screen.getByRole("checkbox", { name: SQUARE })).toBeChecked();
  });

  it("tentar desmarcar o último vertical também preserva o valor", () => {
    const { onChange } = renderSelector("9:16");
    fireEvent.click(screen.getByRole("checkbox", { name: VERTICAL }));

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("flow-campaign-format-requires-one"),
    ).toHaveTextContent(CAMPAIGN_FORMAT_REQUIRES_ONE);
    expect(screen.getByRole("checkbox", { name: VERTICAL })).toBeChecked();
  });

  it("aplica o alvo de 44px e o anel de foco no container de cada opção", () => {
    renderSelector();
    const square = screen.getByRole("checkbox", { name: SQUARE });
    const label = square.closest("label");
    expect(label).toHaveClass("min-h-[44px]");
    expect(label).toHaveClass("focus-within:ring-2");
  });

  it("disabled desabilita ambos os checkboxes e reduz a opacidade", () => {
    renderSelector("1:1", { disabled: true });
    expect(screen.getByRole("checkbox", { name: SQUARE })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: VERTICAL })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: SQUARE }).closest("label"),
    ).toHaveClass("cursor-not-allowed");
  });

  it("verticalEnabled=false mantém o seletor visível e desabilita só o 9:16", () => {
    renderSelector("1:1", { verticalEnabled: false });
    expect(
      screen.getByTestId("flow-campaign-format-selector"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: SQUARE })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: VERTICAL })).toBeDisabled();
    expect(
      screen.getByTestId("flow-campaign-format-vertical-disabled"),
    ).toHaveTextContent(CAMPAIGN_FORMAT_VERTICAL_DISABLED_HELPER);
    expect(
      screen.getByRole("checkbox", { name: VERTICAL }),
    ).toHaveAttribute(
      "aria-describedby",
      "campaignFormat-helper campaignFormat-vertical-disabled",
    );
  });

  it("verticalEnabled=true não exibe o aviso de indisponibilidade", () => {
    renderSelector("1:1", { verticalEnabled: true });
    expect(
      screen.queryByTestId("flow-campaign-format-vertical-disabled"),
    ).not.toBeInTheDocument();
  });
});
