// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  LegalAcceptancePanel,
  type LegalAcceptanceState,
} from "../legal-acceptance-panel";

function renderPanel({
  acceptance = "pending",
  onOpenModal = vi.fn(),
  variant = "desktop-sticky-column",
  open,
}: {
  acceptance?: LegalAcceptanceState;
  onOpenModal?: () => void;
  variant?: "desktop-sticky-column" | "mobile-compact";
  open?: boolean;
} = {}) {
  const utils = render(
    <LegalAcceptancePanel
      acceptance={acceptance}
      onOpenModal={onOpenModal}
      variant={variant}
      open={open}
    />,
  );
  return { onOpenModal, ...utils };
}

describe("LegalAcceptancePanel — estados (F36-LEGAL-01)", () => {
  it("pending renderiza label 'Pendente' + CTA 'Revisar e aceitar'", () => {
    renderPanel({ acceptance: "pending" });
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revisar e aceitar" }),
    ).toBeInTheDocument();
  });

  it("accepted renderiza label 'Aceito' e NÃO mostra CTA", () => {
    renderPanel({ acceptance: "accepted" });
    expect(screen.getByText("Aceito")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Revisar/ }),
    ).not.toBeInTheDocument();
  });

  it("needs_reacceptance renderiza label 'Reaceite necessário' + CTA 'Revisar aceite'", () => {
    renderPanel({ acceptance: "needs_reacceptance" });
    expect(screen.getByText("Reaceite necessário")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revisar aceite" }),
    ).toBeInTheDocument();
  });

  it("section expõe aria-label com o estado (estado nunca é cor sozinha)", () => {
    renderPanel({ acceptance: "pending" });
    expect(
      screen.getByRole("region", { name: "Aceite legal — Pendente" }),
    ).toBeInTheDocument();
  });
});

describe("LegalAcceptancePanel — variantes (F36-LEGAL-02)", () => {
  it("desktop: container usa lg:sticky top-6 (coluna participa do grid)", () => {
    renderPanel({ variant: "desktop-sticky-column" });
    const wrapper = screen.getByRole("region", { name: /Aceite legal/ })
      .parentElement;
    expect(wrapper).toHaveClass("lg:sticky");
    expect(wrapper).toHaveClass("lg:top-6");
  });

  it("mobile: sem classes sticky (bloco compacto no topo do painel)", () => {
    renderPanel({ variant: "mobile-compact" });
    const wrapper = screen.getByRole("region", { name: /Aceite legal/ })
      .parentElement;
    expect(wrapper).not.toHaveClass("lg:sticky");
    expect(wrapper).not.toHaveClass("lg:top-6");
  });

  it("mobile: CTA compacto com min-h-[44px] (F22) e layout em linha", () => {
    renderPanel({ variant: "mobile-compact", acceptance: "pending" });
    const cta = screen.getByRole("button", { name: "Revisar e aceitar" });
    expect(cta).toHaveClass("min-h-[44px]");
  });
});

describe("LegalAcceptancePanel — CTA e a11y (F36-LEGAL-01/02)", () => {
  it("clique no CTA 'Revisar e aceitar' chama onOpenModal (abre ContractAcceptanceModal no form)", () => {
    const { onOpenModal } = renderPanel({ acceptance: "pending" });
    fireEvent.click(screen.getByRole("button", { name: "Revisar e aceitar" }));
    expect(onOpenModal).toHaveBeenCalledTimes(1);
  });

  it("CTA expõe aria-haspopup dialog e aria-expanded refletindo o estado aberto do modal", () => {
    const { rerender } = render(
      <LegalAcceptancePanel
        acceptance="pending"
        onOpenModal={vi.fn()}
        variant="desktop-sticky-column"
        open={false}
      />,
    );
    const cta = screen.getByRole("button", { name: "Revisar e aceitar" });
    expect(cta).toHaveAttribute("aria-haspopup", "dialog");
    expect(cta).toHaveAttribute("aria-expanded", "false");

    rerender(
      <LegalAcceptancePanel
        acceptance="pending"
        onOpenModal={vi.fn()}
        variant="desktop-sticky-column"
        open
      />,
    );
    expect(cta).toHaveAttribute("aria-expanded", "true");
  });

  it("sem open prop, aria-expanded padrão false", () => {
    renderPanel({ acceptance: "pending" });
    expect(
      screen.getByRole("button", { name: "Revisar e aceitar" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
