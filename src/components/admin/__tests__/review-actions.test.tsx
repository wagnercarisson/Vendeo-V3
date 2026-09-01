// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    replace: vi.fn(),
  }),
}));

import { ReviewActions } from "../review-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReviewActions (D6/D11 — ações admin)", () => {
  it("Teste 53: aprovar com exceção chama POST /exception com admin_exception (auditável)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", mockFetch);

    render(<ReviewActions storeId="store-1" tab="defer" />);

    // Abre o input de exceção
    fireEvent.click(screen.getByRole("button", { name: "Exceção" }));
    fireEvent.change(screen.getByPlaceholderText("Motivo da exceção"), {
      target: { value: "loja legítima" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/reviews/store-1/exception",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "loja legítima" }),
        }),
      );
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("não envia exceção com motivo menor que 3 caracteres", () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    render(<ReviewActions storeId="store-1" tab="defer" />);
    fireEvent.click(screen.getByRole("button", { name: "Exceção" }));
    fireEvent.change(screen.getByPlaceholderText("Motivo da exceção"), {
      target: { value: "ab" },
    });

    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Teste 53b: aprovação idempotente — aprovar envia POST /approve", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", mockFetch);

    render(<ReviewActions storeId="store-1" tab="review" />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/reviews/store-1/approve",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});