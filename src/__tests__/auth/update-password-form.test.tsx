// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateUser = vi.fn();
const mockReplace = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

import { UpdatePasswordForm } from "@/app/(auth)/update-password/update-password-form";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("UpdatePasswordForm", () => {
  it("renders password and confirm inputs and submit button", () => {
    render(<UpdatePasswordForm />);

    expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar nova senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar senha" })).toBeInTheDocument();
  });

  it("shows error when password is too short", async () => {
    render(<UpdatePasswordForm />);

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => {
      expect(screen.getByText("A senha deve ter no mínimo 6 caracteres")).toBeInTheDocument();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("shows error when passwords do not match", async () => {
    render(<UpdatePasswordForm />);

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => {
      expect(screen.getByText("As senhas não conferem")).toBeInTheDocument();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser and redirects to / on success", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    render(<UpdatePasswordForm />);

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpassword123" });
    });

    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows error message on updateUser failure", async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error("Update failed") });

    render(<UpdatePasswordForm />);

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => {
      expect(screen.getByText("Não foi possível atualizar a senha. Tente novamente.")).toBeInTheDocument();
    });

    // Error case: user stays on page (no redirect to /)
    expect(screen.getByRole("button", { name: "Atualizar senha" })).toBeInTheDocument();
  });

  it("disables button during loading", async () => {
    mockUpdateUser.mockImplementation(() => new Promise(() => {}));

    render(<UpdatePasswordForm />);

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});
