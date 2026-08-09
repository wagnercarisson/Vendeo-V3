// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "@/app/page";

describe("Landing page (/)", () => {
  it("renders hero headline", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /Campanhas profissionais/ }),
    ).toBeInTheDocument();
  });

  it("renders primary CTA to request access (anchor to form)", () => {
    render(<Home />);
    const cta = screen.getByRole("link", { name: "Solicitar acesso free" });
    expect(cta).toHaveAttribute("href", "#acesso");
  });

  it("renders secondary CTA Entrar pointing to /login", () => {
    render(<Home />);
    const loginLinks = screen.getAllByRole("link", { name: "Entrar" });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute("href", "/login");
  });

  it("renders the access request form (email input)", () => {
    render(<Home />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Solicitar acesso free" }),
    ).toBeInTheDocument();
  });
});
