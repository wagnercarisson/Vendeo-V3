import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

function createMockRequest(url: string): any {
  const parsedUrl = new URL(url);
  return {
    nextUrl: {
      searchParams: parsedUrl.searchParams,
    },
    url,
  };
}

async function callbackHandler(url: string): Promise<Response> {
  const { GET } = await import("@/app/auth/callback/route");
  return GET(createMockRequest(url));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Teste 14 — callback code válido → exchangeCodeForSession → /dashboard → PrivacyGate (D16)", () => {
  it("troca o code e redireciona para next na allowlist", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await callbackHandler(
      "http://localhost/auth/callback?code=valid-code&next=/dashboard",
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redireciona para /dashboard por padrão no sucesso (sem next)", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await callbackHandler(
      "http://localhost/auth/callback?code=valid-code",
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });
});

describe("Teste 15 — callback code inválido/expirado → erro genérico /login?error=oauth_failed (D16)", () => {
  it("code ausente → erro genérico (anti-enumeração)", async () => {
    const res = await callbackHandler("http://localhost/auth/callback");

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=oauth_failed");
  });

  it("exchangeCodeForSession retorna erro (code inválido/expirado) → /login?error=oauth_failed", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });

    const res = await callbackHandler(
      "http://localhost/auth/callback?code=expired-code",
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("expired-code");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=oauth_failed");
  });
});

describe("Teste 16 — callback com next externo → bloqueado (allowlist) (D16)", () => {
  it("nunca redireciona para next externo (open redirect bloqueado)", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await callbackHandler(
      "http://localhost/auth/callback?code=valid-code&next=https://evil.com",
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("trata '/' como inválido → fallback /dashboard", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await callbackHandler(
      "http://localhost/auth/callback?code=valid-code&next=/",
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("trata /onboarding como inválido → fallback /dashboard", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await callbackHandler(
      "http://localhost/auth/callback?code=valid-code&next=/onboarding",
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });
});