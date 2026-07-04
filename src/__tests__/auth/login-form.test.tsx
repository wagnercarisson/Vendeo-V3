// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignInWithPassword = vi.fn();
const mockReplace = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

import { LoginForm } from "@/app/(auth)/login/login-form";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("LoginForm", () => {
  it("includes link to /signup", () => {
    render(<LoginForm redirect="/" />);
    const link = screen.getByRole("link", { name: "Criar conta" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("includes link to /forgot-password", () => {
    render(<LoginForm redirect="/" />);
    const link = screen.getByRole("link", { name: "Esqueci minha senha" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
  it("renders email input, password input and submit button", () => {
    render(<LoginForm redirect="/" />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("calls signInWithPassword and redirects on success", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    render(<LoginForm redirect="/store" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
      });
    });

    expect(mockReplace).toHaveBeenCalledWith("/store");
  });

  it("shows error message on failed login", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: new Error("Invalid credentials"),
    });

    render(<LoginForm redirect="/" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(screen.getByText("Email ou senha inválidos")).toBeInTheDocument();
    });
  });

  it("disables button and shows loading state during submission", async () => {
    mockSignInWithPassword.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    render(<LoginForm redirect="/" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
