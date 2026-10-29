// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import { ptBRMessages } from "@/lib/i18n/catalogs/pt-BR";
import { es419Messages } from "@/lib/i18n/catalogs/es-419";

const { refreshMock, navState } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  navState: { searchParams: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
  useSearchParams: () => navState.searchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { SettingsLanguageForm } from "@/components/settings/settings-language-form";

const messages = ptBRMessages.settings;
const common = ptBRMessages.common;

type FormProps = React.ComponentProps<typeof SettingsLanguageForm>;

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function renderForm(overrides: Partial<FormProps> = {}) {
  return render(
    <SettingsLanguageForm
      initialLocale="pt-BR"
      initialVersion={0}
      messages={messages}
      common={common}
      {...overrides}
    />,
  );
}

function saveButton() {
  return screen.getByRole("button", {
    name: new RegExp(`^(${common.save}|${messages.saving})$`),
  });
}

beforeEach(() => {
  refreshMock.mockReset();
  fetchMock.mockReset();
  navState.searchParams = new URLSearchParams();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsLanguageForm — seleção e salvamento", () => {
  it("não faz fetch no mount, marca a preferência persistida e mantém Salvar desabilitado", () => {
    renderForm();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: messages.optionPtBr })).toBeChecked();
    expect(screen.getByRole("radio", { name: messages.optionEs419 })).not.toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it("selecionar es-419 habilita Salvar e envia um único PATCH com Content-Type e expectedVersion", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ uiLocale: "es-419", source: "explicit", version: 1 }),
    );

    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: messages.optionEs419 }));
    expect(saveButton()).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveButton());
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/preferences");
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      uiLocale: "es-419",
      expectedVersion: 0,
    });
  });

  it("200 atualiza versão, confirma em role=status, chama refresh uma vez e desabilita Salvar", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: messages.optionEs419 }));
    fireEvent.click(saveButton());

    // Enquanto o PATCH está em voo: estado salvando, sem confirmação.
    expect(screen.getByText(messages.saving)).toBeTruthy();
    expect(screen.queryByText(messages.saved)).toBeNull();
    expect(saveButton()).toBeDisabled();

    await act(async () => {
      resolveFetch?.(
        jsonResponse({ uiLocale: "es-419", source: "explicit", version: 1 }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(messages.saved);
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(saveButton()).toBeDisabled();

    // Segundo clique não dispara novo PATCH (baseline atualizado no 200).
    fireEvent.click(saveButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sobrevive ao refresh com novas props e suporta troca repetida es-419 → pt-BR", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ uiLocale: "es-419", source: "explicit", version: 1 }),
    );

    const view = renderForm();
    fireEvent.click(screen.getByRole("radio", { name: messages.optionEs419 }));
    await act(async () => {
      fireEvent.click(saveButton());
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(messages.saved);
    });

    // Novas props do servidor após router.refresh() — confirmação continua visível.
    view.rerender(
      <SettingsLanguageForm
        initialLocale="es-419"
        initialVersion={1}
        messages={messages}
        common={common}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(messages.saved);
    expect(screen.getByRole("radio", { name: messages.optionEs419 })).toBeChecked();
    expect(saveButton()).toBeDisabled();

    // Troca repetida: volta para pt-BR. A confirmação some durante o envio.
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        setTimeout(
          () =>
            resolve(
              jsonResponse({
                uiLocale: "pt-BR",
                source: "explicit",
                version: 2,
              }),
            ),
          0,
        );
      }),
    );

    fireEvent.click(screen.getByRole("radio", { name: messages.optionPtBr }));
    expect(saveButton()).not.toBeDisabled();
    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toHaveTextContent(messages.saved);
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(messages.saved);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(second[1].body as string)).toEqual({
      uiLocale: "pt-BR",
      expectedVersion: 1,
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);
    expect(saveButton()).toBeDisabled();
  });

  it("expõe controles nativos acessíveis, sem opção de limpar preferência", () => {
    renderForm();

    expect(
      screen.getByRole("group", { name: messages.languageSection }),
    ).toBeTruthy();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    expect(radios.every((radio) => radio.name === "uiLocale")).toBe(true);
    expect(radios.map((radio) => radio.value)).toEqual(["pt-BR", "es-419"]);
    expect(screen.queryByRole("button", { name: /limpar|clear|restablecer/i })).toBeNull();
  });

  it("não exibe confirmação vinda de ?saved=1", () => {
    navState.searchParams = new URLSearchParams("saved=1");

    renderForm();

    expect(screen.queryByText(messages.saved)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renderiza rótulos es-419 a partir das mensagens vigentes", () => {
    renderForm({
      initialLocale: "es-419",
      initialVersion: 2,
      messages: es419Messages.settings,
      common: es419Messages.common,
      lang: "es-419",
    });

    expect(screen.getByRole("group", { name: "Idioma de la aplicación" })).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "Español (Latinoamérica)" }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: es419Messages.common.save }),
    ).toBeDisabled();
  });
});
