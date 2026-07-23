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
  it("renders email, password, confirm password, privacy checkbox and submit button", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("shows error when password is too short", async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "123" },
    });
    const privacyCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(privacyCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(screen.getByText("A senha deve ter no mínimo 6 caracteres")).toBeInTheDocument();
    });
  });

  it("shows error when passwords do not match", async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "654321" },
    });
    const privacyCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(privacyCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(screen.getByText("As senhas não conferem")).toBeInTheDocument();
    });
  });

  it("calls signUp and redirects to /check-email on success", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "123" } }, error: null });

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
    const privacyCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(privacyCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
    });
  });

  it("redirects to /check-email even when signUp returns error (anti-enumeration)", async () => {
    mockSignUp.mockRejectedValue(new Error("server error"));

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
    const privacyCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(privacyCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
    });
  });

  it("disables button during submission", async () => {
    // Keep promise pending to test loading state
    mockSignUp.mockReturnValue(new Promise(() => {}));

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
    const privacyCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(privacyCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      const submitBtn = buttons.find(b => b.getAttribute("type") === "submit");
      expect(submitBtn).toBeDisabled();
    });
  });

  it("shows privacy error when privacy checkbox is unchecked", async () => {
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
