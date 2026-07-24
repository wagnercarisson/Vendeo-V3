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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SignupForm", () => {
  it("renders email, password, confirm password, privacy button and submit button", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ler e declarar ciência/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("shows privacy error when privacy is not acknowledged", async () => {
    render(<SignupForm />);

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
