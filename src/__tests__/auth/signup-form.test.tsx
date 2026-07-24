// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignUp = vi.fn();
const mockReplace = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signUp: mockSignUp,
    },
  })),
}));

vi.mock("@/lib/supabase/site-url", () => ({
  getSiteUrl: () => "http://localhost:3000",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

import { SignupForm } from "@/app/(auth)/signup/signup-form";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      versions: {
        privacy_policy: { version: "v1.0", label: "Política de Privacidade", url: "/docs/legal/privacy-policy-v1.md" },
        terms_of_service: { version: "v1.0", label: "Termos de Uso", url: "/docs/legal/terms-of-service-v1.md" },
        acceptable_use: { version: "v1.0", label: "Política de Uso Aceitável", url: "/docs/legal/acceptable-use-v1.md" },
      },
    }),
  });
  vi.stubGlobal("fetch", mockFetch);
});

describe("SignupForm", () => {
  it("renders email, password, confirm password, privacy button and submit button", async () => {
    render(<SignupForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ler e declarar ciência/ })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("shows privacy error when privacy is not acknowledged", async () => {
    render(<SignupForm />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ler e declarar ciência/ })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(screen.getByText("Você precisa declarar ciência da Política de Privacidade.")).toBeInTheDocument();
    });
  });
});
