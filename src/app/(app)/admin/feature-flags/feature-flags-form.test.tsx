// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeatureFlagsForm, type FeatureFlagRow } from "./feature-flags-form";

const ROW: FeatureFlagRow = {
  id: "flag-id-1",
  key: "force_brief_vision_check",
  enabled: false,
  description: "Quando ligada, o Vendeo executa novamente a validação por IA das imagens.",
  updatedByEmail: null,
  updatedAt: null,
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FeatureFlagsForm — Testes 24-25 (F43)", () => {
  it("Teste 24 (D5): exibe a flag com descrição e estados; alteração com motivo persiste via PUT", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "flag-id-1", key: "force_brief_vision_check", enabled: true }),
    });

    render(<FeatureFlagsForm rows={[ROW]} />);

    // descrição e chave exibidas
    expect(screen.getByText("force_brief_vision_check")).toBeInTheDocument();
    expect(
      screen.getByText(/Quando ligada, o Vendeo executa novamente/)
    ).toBeInTheDocument();
    // estado atual — padrão recomendado (Desligada)
    expect(screen.getByText(/Desligada — padrão recomendado/)).toBeInTheDocument();

    // liga e informa motivo
    fireEvent.click(screen.getByRole("button", { name: "Desligada" }));
    fireEvent.change(screen.getByPlaceholderText("Motivo da alteração (obrigatório)"), {
      target: { value: "Diagnóstico" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/feature-flags",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"enabled":true'),
        })
      );
    });
  });

  it("Teste 24b (D5): alteração sem motivo é bloqueada (Motivo obrigatório), sem PUT", async () => {
    render(<FeatureFlagsForm rows={[ROW]} />);

    fireEvent.click(screen.getByRole("button", { name: "Desligada" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("Motivo obrigatório")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Teste 25 (D5): alteração envia operationId (idempotência) para auditoria via RPC", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "flag-id-1", key: "force_brief_vision_check", enabled: true }),
    });

    render(<FeatureFlagsForm rows={[ROW]} />);

    fireEvent.click(screen.getByRole("button", { name: "Desligada" }));
    fireEvent.change(screen.getByPlaceholderText("Motivo da alteração (obrigatório)"), {
      target: { value: "Auditoria de diagnóstico" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse((call[1] as RequestInit).body as string);
      expect(body.operationId).toBeDefined();
      expect(body.reason).toBe("Auditoria de diagnóstico");
    });
  });
});