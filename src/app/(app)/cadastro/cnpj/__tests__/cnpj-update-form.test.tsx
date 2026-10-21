// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, createEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CnpjUpdateForm } from "../cnpj-update-form";

const VALID_MASKED = "12.ABC.345/01DE-35";
const VALID_CANONICAL = "12ABC34501DE35";

let fetchMock: ReturnType<typeof vi.fn>;

function renderForm(props: Partial<Parameters<typeof CnpjUpdateForm>[0]> = {}) {
  return render(
    <CnpjUpdateForm
      storeId="store-1"
      existingRazaoSocial="Loja Teste"
      {...props}
    />,
  );
}

function getCnpjInput(): HTMLInputElement {
  return screen.getByLabelText(/CNPJ/) as HTMLInputElement;
}

function getForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector("form");
  if (!form) throw new Error("form not found");
  return form;
}

beforeEach(() => {
  pushMock.mockReset();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("CnpjUpdateForm — CNPJ alfanumérico fail-closed", () => {
  it("colagem alfanumérica preserva letras e envia o canônico", async () => {
    const { container } = renderForm();

    fireEvent.change(getCnpjInput(), { target: { value: "12.abc.345/01de-35" } });

    expect(getCnpjInput()).toHaveValue(VALID_MASKED);

    fireEvent.submit(getForm(container));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/update-cnpj",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.cnpjNormalized).toBe(VALID_CANONICAL);
    expect(body.cnpj).toBeUndefined();
  });

  it("emoji mantém o último valor válido, exibe erro local e não envia", async () => {
    const { container } = renderForm();
    const input = getCnpjInput();

    fireEvent.change(input, { target: { value: VALID_MASKED } });
    expect(input).toHaveValue(VALID_MASKED);

    fireEvent.change(input, { target: { value: `${VALID_MASKED}😀` } });

    expect(input).toHaveValue(VALID_MASKED);
    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();

    fireEvent.submit(getForm(container));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DV inválido exibe erro e não envia", async () => {
    const { container } = renderForm();
    const input = getCnpjInput();

    fireEvent.change(input, { target: { value: "12.ABC.345/01DE-34" } });
    expect(input).toHaveValue("12.ABC.345/01DE-34");

    fireEvent.submit(getForm(container));

    expect(
      screen.getByText(/CNPJ inválido\. Verifique os dígitos e tente novamente\./),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exibe o CNPJ existente formatado (alfanumérico)", () => {
    renderForm({ existingCnpj: VALID_CANONICAL });

    expect(screen.getByText(VALID_MASKED)).toBeInTheDocument();
    expect(screen.queryByText(VALID_CANONICAL)).not.toBeInTheDocument();
  });

  it("paste com conteúdo maior que 18 e inválido após a posição 18 é bloqueado antes do maxLength", () => {
    const { container } = renderForm();
    const input = getCnpjInput();

    fireEvent.change(input, { target: { value: VALID_MASKED } });
    expect(input).toHaveValue(VALID_MASKED);

    const longPaste = `${VALID_MASKED}${"0".repeat(20)}😀`;
    const pasteEvent = createEvent.paste(input, {
      clipboardData: { getData: () => longPaste },
    });
    fireEvent(input, pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(input).toHaveValue(VALID_MASKED);
    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();

    fireEvent.submit(getForm(container));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("esvaziar o campo após erro mantém erro e bloqueio até entrada completa válida", async () => {
    const { container } = renderForm();
    const input = getCnpjInput();

    fireEvent.change(input, { target: { value: `${VALID_MASKED}😀` } });
    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();

    fireEvent.submit(getForm(container));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: VALID_MASKED } });
    expect(screen.queryByText("CNPJ inválido")).not.toBeInTheDocument();

    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
