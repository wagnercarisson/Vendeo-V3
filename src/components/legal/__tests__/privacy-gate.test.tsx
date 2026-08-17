// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/loja",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Modal verbatim — expõe onConfirm/onOpenChange para os testes
const modalMock = vi.hoisted(() => ({
  onConfirm: null as null | (() => Promise<boolean>),
  onOpenChange: null as null | ((open: boolean) => void),
}));

vi.mock("../privacy-acknowledge-modal", () => ({
  PrivacyAcknowledgeModal: ({
    open,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => Promise<boolean>;
    onOpenChange: (open: boolean) => void;
  }) => {
    modalMock.onConfirm = onConfirm;
    modalMock.onOpenChange = onOpenChange;
    if (!open) return null;
    return (
      <button
        type="button"
        onClick={() => onConfirm()}
        data-testid="privacy-modal-confirm"
      >
        Confirmar ciência
      </button>
    );
  },
}));

import { PrivacyGate } from "../privacy-gate";

const policyDoc = { label: "Política de Privacidade", version: "v1.3", url: "/docs/legal/privacy-policy-v1-3.md" };

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  modalMock.onConfirm = null;
  modalMock.onOpenChange = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PrivacyGate (D16 — post-OAuth, opt-in opcional + guard anti-flash)", () => {
  it("renderiza opt-in de comunicações + modal quando NÃO acknowledged", () => {
    render(<PrivacyGate acknowledged={false} policyDocument={policyDoc} />);
    expect(
      screen.getByLabelText(/Quero receber comunicações comerciais \(opcional\)/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("privacy-modal-confirm")).toBeInTheDocument();
  });

  it("retorna null quando acknowledged", () => {
    const { container } = render(
      <PrivacyGate acknowledged={true} policyDocument={policyDoc} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("guarda anti-flash: NÃO abre modal se privacyPending presente (PrivacyRecovery liquida)", () => {
    window.sessionStorage.setItem(
      "privacyPending",
      JSON.stringify({ privacyAcknowledged: true, communicationsOptIn: false }),
    );
    const { container } = render(
      <PrivacyGate acknowledged={false} policyDocument={policyDoc} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("handleConfirm envia communicationsOptIn no body (NUNCA user_metadata)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<PrivacyGate acknowledged={false} policyDocument={policyDoc} />);

    // marca opt-in
    fireEvent.click(
      screen.getByLabelText(/Quero receber comunicações comerciais \(opcional\)/),
    );

    // confirma
    await actAsync(() => modalMock.onConfirm?.());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/legal/acknowledge-privacy",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ communicationsOptIn: true }),
        }),
      );
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});

async function actAsync(fn: (() => Promise<boolean>) | null | undefined) {
  if (!fn) return;
  // não usa act explícito — waitFor cobre a asserção
  await fn();
}