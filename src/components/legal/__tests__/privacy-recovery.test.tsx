// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrivacyRecovery } from "../privacy-recovery";

const mockRefresh = vi.fn();
const mockRouter = { refresh: mockRefresh };

vi.mock("next/navigation", () => ({
  // useRouter do Next.js retorna referência ESTÁVEL entre renders — o mock
  // precisa reproduzir isso ou o useCallback([router]) muda a cada render e o
  // useEffect([processPending]) entra em loop infinito (OOM no teste).
  useRouter: () => mockRouter,
}));

describe("PrivacyRecovery (D16 — coordenação com PrivacyGate, modelo real)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRefresh.mockClear();
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

    window.localStorage.setItem(
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
    expect(window.localStorage.getItem("privacyPending")).toBeNull();
    // D16: refresh para o layout recomputar acknowledged=true (gate não reabre)
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("não envia quando privacyAcknowledged é false (não processa pending não-reconhecido)", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    window.localStorage.setItem(
      "privacyPending",
      JSON.stringify({ privacyAcknowledged: false, communicationsOptIn: false }),
    );

    render(<PrivacyRecovery />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
    // registro permanece (não liquidado)
    expect(window.localStorage.getItem("privacyPending")).not.toBeNull();
  });

  it("erro no POST → mantém registro e mostra mensagem de erro", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal("fetch", mockFetch);

    window.localStorage.setItem(
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
    expect(window.localStorage.getItem("privacyPending")).not.toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("endpoint com HTTP 200 mas body.ok=false → NÃO remove registro nem dá refresh (bug da resposta 200-em-erro)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal("fetch", mockFetch);

    window.localStorage.setItem(
      "privacyPending",
      JSON.stringify({ privacyAcknowledged: true, communicationsOptIn: false }),
    );

    render(<PrivacyRecovery />);

    await waitFor(() => {
      expect(
        screen.getByText(/Não foi possível registrar sua ciência da Política de Privacidade/),
      ).toBeInTheDocument();
    });

    // HTTP 200 não é sucesso — o registro permanece e o layout NÃO é revalidado
    expect(window.localStorage.getItem("privacyPending")).not.toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});