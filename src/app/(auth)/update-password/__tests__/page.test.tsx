// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("../update-password-form", () => ({
  UpdatePasswordForm: () => <div data-testid="update-password-form" />,
}));

import UpdatePasswordPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UpdatePasswordPage — link de convite/recuperação", () => {
  it("sem sessão → orientação de link inválido/expirado com suporte", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(await UpdatePasswordPage());

    expect(screen.getByText("Link indisponível")).toBeInTheDocument();
    expect(screen.getByText(/inválido, expirou ou já foi usado/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /suporte@vendeo\.tech/ }).getAttribute("href")).toContain(
      "mailto:",
    );
    expect(screen.queryByTestId("update-password-form")).not.toBeInTheDocument();
  });

  it("com sessão do convite → formulário de definição de senha", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    render(await UpdatePasswordPage());

    expect(screen.getByTestId("update-password-form")).toBeInTheDocument();
    expect(screen.queryByText("Link indisponível")).not.toBeInTheDocument();
  });
});
