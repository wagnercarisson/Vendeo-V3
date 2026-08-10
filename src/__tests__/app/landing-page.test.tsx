// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import Home from "@/app/page";

describe("Landing page (/)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("hides hero CTA and shows 'Solicitação enviada' card after submitting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<Home />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "loja@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar acesso free" }));

    await waitFor(() => {
      expect(screen.getByText("Solicitação enviada")).toBeInTheDocument();
    });

    // Hero CTA some — usuário já enviou; não deve permitir re-envio
    expect(
      screen.queryByRole("link", { name: "Solicitar acesso free" }),
    ).not.toBeInTheDocument();
    // Card mantém a sequência "recebemos sua solicitação..." + "em breve entraremos em contato"
    expect(screen.getByText(/Recebemos sua solicitação/)).toBeInTheDocument();
    expect(screen.getByText(/Em breve entraremos em contato/)).toBeInTheDocument();
  });
});
