// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrivacyRecovery } from "../privacy-recovery";

describe("PrivacyRecovery (D16 — coordenação com PrivacyGate, modelo real)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("processa privacyPending → POST /api/legal/acknowledge-privacy com communicationsOptIn e removeItem pós-ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    window.sessionStorage.setItem(
      "privacyPending",
      JSON.stringify({ privacyAcknowledged: true, communicationsOptIn: true }),
    );

    render(<PrivacyRecovery />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/legal/acknowledge-privacy",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ communicationsOptIn: true }),
        }),
      );
    });

    // pós-ok → registro removido
    expect(window.sessionStorage.getItem("privacyPending")).toBeNull();
  });

  it("não envia quando privacyAcknowledged é false (não processa pending não-reconhecido)", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    window.sessionStorage.setItem(
      "privacyPending",
      JSON.stringify({ privacyAcknowledged: false, communicationsOptIn: false }),
    );

    render(<PrivacyRecovery />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
    // registro permanece (não liquidado)
    expect(window.sessionStorage.getItem("privacyPending")).not.toBeNull();
  });

  it("erro no POST → mantém registro e mostra mensagem de erro", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal("fetch", mockFetch);

    window.sessionStorage.setItem(
      "privacyPending",
      JSON.stringify({ privacyAcknowledged: true, communicationsOptIn: false }),
    );

    render(<PrivacyRecovery />);

    await waitFor(() => {
      expect(
        screen.getByText(/Não foi possível registrar sua ciência da Política de Privacidade/),
      ).toBeInTheDocument();
    });

    // registro mantido em caso de erro
    expect(window.sessionStorage.getItem("privacyPending")).not.toBeNull();
  });
});