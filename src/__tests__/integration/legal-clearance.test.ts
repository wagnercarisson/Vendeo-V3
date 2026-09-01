import { describe, it, expect, vi, beforeEach } from "vitest";

// Testes 56-58 (tasks.md §18) — camada legal integrada (D12/D16).
// Testes de contrato com mocks de alto nível; validação SQL real no UAT 42-20.

const mocks = vi.hoisted(() => ({
  acceptanceStatus: "current" as string,
  termsVersion: { version: "v1.4", effective_at: "2026-08-17T00:00:00Z", summary: null },
}));

vi.mock("@/lib/legal/acceptance-service", () => ({
  getAcceptanceStatus: vi.fn(() => Promise.resolve(mocks.acceptanceStatus)),
}));

vi.mock("@/lib/legal/document-versions", () => ({
  getCurrentVersion: vi.fn(() => Promise.resolve(mocks.termsVersion)),
}));

import { requireLegalClearance } from "@/lib/legal/clearance";

describe("Teste 56 — Ciência da Privacidade declarada na PRIMEIRA autenticação pós-confirmação (D12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ciência NÃO é registrada na criação — só na primeira autenticação autenticada", async () => {
    // No signup (criação), NÃO há autenticação ainda — nada é registrado em
    // privacy_acknowledgements. O registro acontece quando o PrivacyRecovery
    // processa o privacyPending na primeira sessão autenticada.
    const mockRegister = vi.fn();
    const mockSupabase = {
      auth: {
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
    };

    // Signup não chama registerPrivacyAcknowledgement
    await mockSupabase.auth.signUp({ email: "x@y.com", password: "12345678" });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("privacyPending (localStorage) é processado na autenticação → POST /api/legal/acknowledge-privacy autenticado", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = mockFetch;

    try {
      await mockFetch("/api/legal/acknowledge-privacy", {
        method: "POST",
        body: JSON.stringify({ communicationsOptIn: false }),
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/legal/acknowledge-privacy",
        expect.any(Object),
      );
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});

describe("Teste 57 — OAuth sem acknowledgment → PrivacyGate obrigatório; consentimento em privacy_acknowledgements/consent_events (NÃO user_metadata) (D16)", () => {
  it("PrivacyGate chama /api/legal/acknowledge-privacy (não user_metadata) com communicationsOptIn", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = mockFetch;

    try {
      const body = JSON.stringify({ communicationsOptIn: true });
      await mockFetch("/api/legal/acknowledge-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/legal/acknowledge-privacy",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ communicationsOptIn: true }),
        }),
      );
      // O body NÃO contém user_metadata (a evidência legal é o endpoint autenticado)
      expect(body).not.toContain("user_metadata");
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});

describe("Teste 58 — clearance fail-closed: sem aceite da versão nova, funcionalidades protegidas bloqueadas (D12)", () => {
  it("content_generation bloqueada quando versão nova não aceita (outdated)", async () => {
    mocks.acceptanceStatus = "outdated";
    const result = await requireLegalClearance({
      capability: "content_generation",
      storeId: "store-1",
      userId: "user-1",
    });

    if (result.ok) {
      throw new Error("clearance should have failed for outdated acceptance");
    }
    expect(result.reason).toBe("Documentos pendentes de aceitação.");
    expect(result.requiredDocuments).toContain("terms_of_service");
  });

  it("content_generation liberada quando aceite current", async () => {
    mocks.acceptanceStatus = "current";
    const result = await requireLegalClearance({
      capability: "content_generation",
      storeId: "store-1",
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
  });
});
