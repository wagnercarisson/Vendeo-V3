// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessRequestSection } from "../access-request-section";
import { CURRENT_PRIVACY_NOTICE_VERSION } from "@/lib/legal/current-versions";

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "loja@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Nome da loja"), {
    target: { value: "Loja Exemplo" },
  });
  fireEvent.change(screen.getByLabelText("Segmento"), {
    target: { value: "moda-calcados-acessorios" },
  });
  fireEvent.change(screen.getByLabelText("WhatsApp"), {
    target: { value: "11999999999" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Solicitar acesso free" }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AccessRequestSection + AccessRequestForm real — integração de envio", () => {
  it("preenche, envia o formulário real e faz POST para /api/access-requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccessRequestSection publicSignupEnabled={false} />);
    fillAndSubmit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/access-requests");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual({
      email: "loja@example.com",
      store_name: "Loja Exemplo",
      segment: "moda-calcados-acessorios",
      whatsapp: "(11) 99999-9999",
      privacy_notice_version: CURRENT_PRIVACY_NOTICE_VERSION,
    });
  });

  it("2xx exibe o cartão de sucesso com convite por e-mail e caixa de spam", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<AccessRequestSection publicSignupEnabled={false} />);
    fillAndSubmit();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Solicitação enviada");
    expect(status).toHaveTextContent(/receberá um convite por e-mail/i);
    expect(status).toHaveTextContent(/caixa de spam/i);
  });

  it("remove o formulário após o sucesso, impedindo novo envio por ele", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<AccessRequestSection publicSignupEnabled={false} />);
    fillAndSubmit();

    await screen.findByRole("status");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Solicitar acesso free" }),
    ).not.toBeInTheDocument();
  });

  it("resposta de erro mantém o formulário e não mostra sucesso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<AccessRequestSection publicSignupEnabled={false} />);
    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível registrar sua solicitação/i,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Solicitar acesso free" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Solicitação enviada")).not.toBeInTheDocument();
  });
});
