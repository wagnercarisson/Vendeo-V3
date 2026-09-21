// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { AccessRequestForm } from "../access-request-form";

describe("AccessRequestForm — máscara WhatsApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aplica máscara progressiva (11) 99999-9999 enquanto digita", () => {
    render(<AccessRequestForm />);
    const input = screen.getByLabelText("WhatsApp");
    fireEvent.change(input, { target: { value: "11999999999" } });
    expect(input).toHaveValue("(11) 99999-9999");
  });

  it("envia o valor mascarado no payload do submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccessRequestForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "loja@example.com" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "11999999999" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar acesso free" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/access-requests");
    expect(JSON.parse(init.body)).toMatchObject({
      whatsapp: "(11) 99999-9999",
    });
  });

  it("limita o campo WhatsApp a 15 caracteres (maxLength)", () => {
    render(<AccessRequestForm />);
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute(
      "maxLength",
      "15",
    );
  });

  it("paste de valor longo com não-dígitos e espaços é mascarado e truncado", () => {
    render(<AccessRequestForm />);
    const input = screen.getByLabelText("WhatsApp");
    fireEvent.change(input, { target: { value: "11999999999abc (00) " } });
    expect(input).toHaveValue("(11) 99999-9999");
  });

  it("sends the versioned privacy notice and does not require WhatsApp", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<AccessRequestForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "loja@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar acesso free" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ privacy_notice_version: "v1.4", whatsapp: "" });
    expect(screen.getByText("Campo opcional.")).toBeInTheDocument();
    expect(screen.getByText(/nunca para marketing/)).toBeInTheDocument();
  });

  it("does not collect birth date and exposes the legal acceptance links", () => {
    render(<AccessRequestForm />);
    expect(screen.queryByLabelText(/nascimento|data de nascimento/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Política de Privacidade v1.4/ })).toHaveAttribute("href", "/docs/legal/privacy-policy-v1-4.md");
    expect(screen.getByRole("link", { name: /Termos de Uso v1.5/ })).toHaveAttribute("href", "/docs/legal/terms-of-service-v1-5.md");
  });
});
