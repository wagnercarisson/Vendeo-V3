// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SignupPage from "@/app/(auth)/signup/page";

describe("SignupPage (beta fechado)", () => {
  it("renders beta fechado title", () => {
    render(<SignupPage />);
    expect(
      screen.getByRole("heading", { name: "Beta fechado" }),
    ).toBeInTheDocument();
  });

  it("includes link to request access pointing to /", () => {
    render(<SignupPage />);
    const link = screen.getByRole("link", { name: "Solicitar acesso free" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("includes link to login", () => {
    render(<SignupPage />);
    const link = screen.getByRole("link", { name: /Entrar/ });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("does NOT render an open signup form (no password input, no Criar conta)", () => {
    render(<SignupPage />);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Criar conta/i }),
    ).not.toBeInTheDocument();
  });
});
