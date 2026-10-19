// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductActivationPanel } from "./product-activation-panel";
import type { ProductActivationState } from "@/lib/product-1-1/activation/activation-state";

const STATE: ProductActivationState = {
  mode: "off",
  flags: {
    testStores: false,
    allStores: false,
    testStoresStatus: "valid",
    allStoresStatus: "valid",
  },
  authorizations: { testStores: "off", allStores: "off" },
  instanceIdentity: "127.0.0.1:56321",
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("F56.2e - painel de ativacao", () => {
  it("mostra o estado atual e exige motivo", async () => {
    render(<ProductActivationPanel initialState={STATE} />);
    expect(screen.getByTestId("activation-current-mode")).toHaveTextContent("Desligado");
    fireEvent.click(screen.getByRole("button", { name: /Somente lojas de teste/ }));
    expect(await screen.findByText("Motivo obrigatorio")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("exige confirm ALL_STORES para abertura geral", async () => {
    render(<ProductActivationPanel initialState={STATE} />);
    fireEvent.change(screen.getByPlaceholderText(/janela de validacao/), {
      target: { value: "abertura" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Todas as lojas/ }));
    expect(await screen.findByText(/Digite ALL_STORES/)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("envia confirm e exibe currentMode relido, nao o modo historico", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { mode: "all_stores", idempotent: true },
        currentMode: "test_stores",
        currentState: {
          ...STATE,
          mode: "test_stores",
          flags: { ...STATE.flags, testStores: true },
          authorizations: { testStores: "test_stores", allStores: "off" },
        },
      }),
    });

    render(<ProductActivationPanel initialState={STATE} />);
    fireEvent.change(screen.getByPlaceholderText(/janela de validacao/), {
      target: { value: "abertura" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Digite ALL_STORES/), {
      target: { value: "ALL_STORES" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Todas as lojas/ }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ mode: "all_stores", confirm: "ALL_STORES" });
    await waitFor(() =>
      expect(screen.getByTestId("activation-current-mode")).toHaveTextContent(
        "Somente lojas de teste",
      ),
    );
  });
});
