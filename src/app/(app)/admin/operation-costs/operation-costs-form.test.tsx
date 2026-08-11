// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { ParamsForm } from "./operation-costs-form";
import type { EconomicParameterResolution } from "@/lib/economic/types";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", { randomUUID: () => "test-operation-id" });
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ParamsForm", () => {
  it("renderiza os 2 inputs com labels e badge source correto (tabela/fallback)", () => {
    const params: EconomicParameterResolution[] = [
      { key: "usd_brl_rate", value: 5.5, source: "table" },
      { key: "credit_value_brl", value: 1, source: "fallback" },
    ];
    render(<ParamsForm parameters={params} />);

    const rateInput = screen.getByLabelText("Taxa de conversão");
    expect(rateInput).toHaveValue(5.5);
    const creditInput = screen.getByLabelText(
      "Valor operacional do crédito",
    );
    expect(creditInput).toHaveValue(1);

    // Badge source por parâmetro: "tabela" para valor do banco, "fallback"
    // para default 1.00 (admin ainda não configurou).
    const usdBlock = screen.getByTestId("param-usd_brl_rate");
    expect(within(usdBlock).getByText("tabela")).toBeInTheDocument();

    const creditBlock = screen.getByTestId("param-credit_value_brl");
    expect(within(creditBlock).getByText("fallback")).toBeInTheDocument();
  });

  it("salvar sem motivo → erro inline 'Motivo obrigatório' e PUT não chamado; com motivo → PUT com { key, value, reason, operationId } e audit_id exibido", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        parameter: { key: "usd_brl_rate", value: 5.5 },
        auditId: "audit-123",
        updatedAt: "2026-08-11T00:00:00.000Z",
        idempotent: false,
      }),
    });
    render(
      <ParamsForm
        parameters={[{ key: "usd_brl_rate", value: 1, source: "fallback" }]}
      />,
    );

    // Sem motivo → erro inline, fetch NÃO chamado.
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText("Motivo obrigatório")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    // Com motivo → PUT /api/admin/economic-parameters com operationId.
    fireEvent.change(screen.getByLabelText("Taxa de conversão"), {
      target: { value: "5.5" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Motivo da alteração (obrigatório)"),
      { target: { value: "Ajuste de câmbio" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/economic-parameters");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      key: "usd_brl_rate",
      value: 5.5,
      reason: "Ajuste de câmbio",
      operationId: "test-operation-id",
    });

    // Feedback com audit_id retornado.
    expect(
      await screen.findByText(/auditoria: audit-123/),
    ).toBeInTheDocument();
  });

  it("PUT falha → erro inline (sem exibir audit_id)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Dados inválidos" }),
    });
    render(
      <ParamsForm
        parameters={[
          { key: "credit_value_brl", value: 1, source: "fallback" },
        ]}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Valor operacional do crédito"),
      { target: { value: "2" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Motivo da alteração (obrigatório)"),
      { target: { value: "Revisão do valor" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Dados inválidos")).toBeInTheDocument();
    expect(screen.queryByText(/auditoria:/)).not.toBeInTheDocument();
  });
});
