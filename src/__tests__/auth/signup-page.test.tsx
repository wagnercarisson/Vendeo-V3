// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Flag controlável: default false (Beta fechado). Testes de flag on sobrescrevem.
const flagMock = vi.hoisted(() => ({
  publicSignupEnabled: false,
  captchaEnabled: false,
}));

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: vi.fn(() => ({
    publicSignupEnabled: flagMock.publicSignupEnabled,
  })),
}));

// captchaEnabled agora vem da flag operacional (QCW) — serviço mockado.
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCaptchaEnabled: vi.fn(() => Promise.resolve(flagMock.captchaEnabled)),
}));

// getCurrentVersion consulta o Supabase (server) — mock para o teste de página.
vi.mock("@/lib/legal/document-versions", () => ({
  getCurrentVersion: vi.fn(async () => ({ version: "v1.3" })),
}));

// Componentes client são renderizados no servidor apenas como referência —
// mock leve para os testes de flag on.
vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: ({ fullWidth }: { fullWidth?: boolean }) => (
    <button type="button" data-testid="google-button">
      Continuar com Google
    </button>
  ),
}));

vi.mock("@/components/auth/signup-form", () => ({
  SignupForm: ({
    captchaEnabled,
    policyDocument,
  }: {
    captchaEnabled: boolean;
    policyDocument?: { label: string; version: string; url: string } | null;
  }) => (
    <form
      data-testid="signup-form"
      data-captcha-enabled={String(captchaEnabled)}
      data-policy-url={policyDocument?.url ?? ""}
    >
      <input aria-label="Email" />
      <input aria-label="Senha" />
    </form>
  ),
}));

import SignupPage from "@/app/(auth)/signup/page";

describe("SignupPage (beta fechado — flag off)", () => {
  it("renders beta fechado title", async () => {
    render(await SignupPage());
    expect(
      screen.getByRole("heading", { name: "Beta fechado" }),
    ).toBeInTheDocument();
  });

  it("includes link to request access pointing to /", async () => {
    render(await SignupPage());
    const link = screen.getByRole("link", { name: "Solicitar acesso free" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("includes link to login", async () => {
    render(await SignupPage());
    const link = screen.getByRole("link", { name: /Entrar/ });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("does NOT render an open signup form (no password input, no Criar conta)", async () => {
    render(await SignupPage());
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Criar conta/i }),
    ).not.toBeInTheDocument();
  });

  it("reads publicSignupEnabled server-side (flag exposed via data attribute)", async () => {
    render(await SignupPage());
    expect(
      document.querySelector("[data-public-signup-enabled]"),
    ).toHaveAttribute("data-public-signup-enabled", "false");
  });
});

describe("SignupPage (flag on — formulário + Google)", () => {
  beforeEach(() => {
    flagMock.publicSignupEnabled = true;
  });

  afterEach(() => {
    flagMock.publicSignupEnabled = false;
    flagMock.captchaEnabled = false;
  });

  it("renders Criar sua conta heading + Google button + form", async () => {
    render(await SignupPage());
    expect(
      screen.getByRole("heading", { name: "Criar sua conta" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("google-button")).toBeInTheDocument();
    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
  });

  it("shows data-public-signup-enabled=true", async () => {
    render(await SignupPage());
    expect(
      document.querySelector("[data-public-signup-enabled]"),
    ).toHaveAttribute("data-public-signup-enabled", "true");
  });

  it("does NOT render the Beta fechado content", async () => {
    render(await SignupPage());
    expect(
      screen.queryByRole("heading", { name: "Beta fechado" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Solicitar acesso free" }),
    ).not.toBeInTheDocument();
  });

  it("includes link to login (Já tenho uma conta — Entrar)", async () => {
    render(await SignupPage());
    const link = screen.getByRole("link", { name: /Entrar/ });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("captchaEnabled=false: SignupForm recebe data-captcha-enabled=false", async () => {
    render(await SignupPage());
    expect(screen.getByTestId("signup-form")).toHaveAttribute(
      "data-captcha-enabled",
      "false",
    );
  });

  it("captchaEnabled=true: SignupForm recebe data-captcha-enabled=true", async () => {
    flagMock.captchaEnabled = true;
    render(await SignupPage());
    expect(screen.getByTestId("signup-form")).toHaveAttribute(
      "data-captcha-enabled",
      "true",
    );
  });

  it("policyDocument aponta para o arquivo markdown oficial (não /privacidade)", async () => {
    render(await SignupPage());
    expect(screen.getByTestId("signup-form")).toHaveAttribute(
      "data-policy-url",
      "/docs/legal/privacy-policy-v1-3.md",
    );
  });
});