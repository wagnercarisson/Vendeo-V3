// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, createEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import CreateTestStorePage from "../page";

const VALID_MASKED = "12.ABC.345/01DE-35";
const VALID_CANONICAL = "12ABC34501DE35";

let fetchMock: ReturnType<typeof vi.fn>;

async function renderPage() {
  const view = render(
    <CreateTestStorePage params={Promise.resolve({ id: "user-1" })} />,
  );
  await screen.findByRole("heading", { name: /Criar Store de Teste/i });
  return view;
}

function getCnpjInput(): HTMLInputElement {
  return screen.getByPlaceholderText("XX.XXX.XXX/XXXX-DV") as HTMLInputElement;
}

function getForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector("form");
  if (!form) throw new Error("form not found");
  return form;
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText("Loja de Teste"), {
    target: { value: "Loja Alfa" },
  });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "outros" },
  });
}

beforeEach(() => {
  pushMock.mockReset();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("CreateTestStorePage — CNPJ alfanumérico fail-closed", () => {
  it("digitação alfanumérica progressiva preserva letras", async () => {
    await renderPage();

    fireEvent.change(getCnpjInput(), { target: { value: "12abc" } });

    expect(getCnpjInput()).toHaveValue("12.ABC");
  });

  it("colagem alfanumérica completa envia o CNPJ canônico", async () => {
    const { container } = await renderPage();

    fireEvent.change(getCnpjInput(), { target: { value: VALID_MASKED } });
    expect(getCnpjInput()).toHaveValue(VALID_MASKED);

    fillRequiredFields();
    fireEvent.submit(getForm(container));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/stores/create-test",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.cnpj).toBe(VALID_CANONICAL);
    expect(body.userId).toBe("user-1");
  });

  it("emoji mantém o último valor válido, exibe erro local e não envia", async () => {
    const { container } = await renderPage();
    const input = getCnpjInput();

    fireEvent.change(input, { target: { value: VALID_MASKED } });
    fireEvent.change(input, { target: { value: `${VALID_MASKED}😀` } });

    expect(input).toHaveValue(VALID_MASKED);
    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();

    fillRequiredFields();
    fireEvent.submit(getForm(container));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("paste maior que 18 com inválido após a posição 18 é bloqueado antes do maxLength", async () => {
    const { container } = await renderPage();
    const input = getCnpjInput();

    fireEvent.change(input, { target: { value: VALID_MASKED } });

    const longPaste = `${VALID_MASKED}${"0".repeat(20)}😀`;
    const pasteEvent = createEvent.paste(input, {
      clipboardData: { getData: () => longPaste },
    });
    fireEvent(input, pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(input).toHaveValue(VALID_MASKED);
    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();

    fillRequiredFields();
    fireEvent.submit(getForm(container));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
