// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreditCta } from "@/components/credit/credit-cta";

describe("CreditCta", () => {
  it("renders button and opens modal with mailto link", () => {
    render(<CreditCta variant="zero" supportEmail="suporte@vendeo.app" />);

    const button = screen.getByText("Solicitar créditos");
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByText("Enviar email")).toBeInTheDocument();
    expect(screen.getByText("Fechar")).toBeInTheDocument();

    const mailtoLink = screen.getByText("suporte@vendeo.app");
    expect(mailtoLink).toHaveAttribute("href", "mailto:suporte@vendeo.app");
  });
});
