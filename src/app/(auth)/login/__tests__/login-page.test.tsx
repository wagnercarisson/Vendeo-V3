// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("@/lib/auth/redirect", () => ({
  sanitizeRedirectPath: (p: string) => p || "",
}));

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => <button type="button">Continuar com Google</button>,
}));

vi.mock("../login-form", () => ({
  LoginForm: ({ redirect, captchaEnabled }: { redirect: string; captchaEnabled: boolean }) => (
    <form data-testid="login-form" data-redirect={redirect} data-captcha-enabled={String(captchaEnabled)} />
  ),
}));

import LoginPage from "@/app/(auth)/login/page";

describe("Teste 13a - LoginPage flag off", () => {
  beforeEach(() => {
    flagMock.publicSignupEnabled = false;
  });

  afterEach(() => {
    flagMock.publicSignupEnabled = false;
  });

  it("renderiza GoogleButton SEMPRE (D15) mesmo com flag off", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("button", { name: "Continuar com Google" }),
    ).toBeInTheDocument();
  });

  it("exibe o divisor 'ou' entre Google e email/senha", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("ou")).toBeInTheDocument();
  });

  it("flag off preserva link 'Solicitar acesso free' → / (sem Criar uma conta)", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    const link = screen.getByRole("link", { name: /Solicitar acesso free/ });
    expect(link).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /Criar uma conta/i })).not.toBeInTheDocument();
  });
});

describe("Teste 13b - LoginPage flag on", () => {
  beforeEach(() => {
    flagMock.publicSignupEnabled = true;
  });

  afterEach(() => {
    flagMock.publicSignupEnabled = false;
    flagMock.captchaEnabled = false;
  });

  it("renderiza GoogleButton + link 'Criar uma conta' → /signup", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("button", { name: "Continuar com Google" }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Criar uma conta/i });
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("flag on NÃO exibe 'Solicitar acesso free'", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.queryByRole("link", { name: /Solicitar acesso free/ }),
    ).not.toBeInTheDocument();
  });

  it("captchaEnabled=false: LoginForm recebe data-captcha-enabled=false", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("login-form")).toHaveAttribute(
      "data-captcha-enabled",
      "false",
    );
  });

  it("captchaEnabled=true: LoginForm recebe data-captcha-enabled=true", async () => {
    flagMock.captchaEnabled = true;
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("login-form")).toHaveAttribute(
      "data-captcha-enabled",
      "true",
    );
  });
});