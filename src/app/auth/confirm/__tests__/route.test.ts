import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      verifyOtp: mockVerifyOtp,
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

async function confirmHandler(url: string): Promise<Response> {
  const { GET } = await import("@/app/auth/confirm/route");
  return GET(createMockRequest(url));
}

async function confirmPost(fields: Record<string, string>): Promise<Response> {
  const { POST } = await import("@/app/auth/confirm/route");
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const req = new NextRequest("http://localhost/auth/confirm", {
    method: "POST",
    body: form,
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthConfirm GET handler — email/OTP verifyOtp (19.8 regressão, inalterado)", () => {
  it("19.8: confirma signup via token_hash + verifyOtp → redirect /", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await confirmHandler(
      "http://localhost/auth/confirm?token_hash=abc&type=signup",
    );

    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("19.8: confirma recovery via token_hash + verifyOtp → redirect safeNext", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await confirmHandler(
      "http://localhost/auth/confirm?token_hash=abc&type=recovery&next=/update-password",
    );

    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/update-password");
  });

  it("19.8: sem token_hash ou type inválido → /login?error=confirmation_failed", async () => {
    const res = await confirmHandler("http://localhost/auth/confirm");

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=confirmation_failed");
  });

  it("19.8: verifyOtp com erro → /login?error=confirmation_failed (genérico)", async () => {
    mockVerifyOtp.mockResolvedValue({ error: new Error("invalid token") });

    const res = await confirmHandler(
      "http://localhost/auth/confirm?token_hash=bad&type=signup",
    );

    expect(mockVerifyOtp).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=confirmation_failed");
  });
});

describe("Convite — GET não consome; POST consome após clique", () => {
  it("GET invite redireciona para /convite SEM chamar verifyOtp", async () => {
    const res = await confirmHandler(
      "http://localhost/auth/confirm?token_hash=invite-token&type=invite",
    );

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/convite");
    expect(location).toContain("token_hash=invite-token");
    expect(location).toContain("type=invite");
  });

  it("GET magiclink também redireciona para /convite sem consumir", async () => {
    const res = await confirmHandler(
      "http://localhost/auth/confirm?token_hash=magic-token&type=magiclink",
    );

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/convite");
  });

  it("POST invite consome token e redireciona para /update-password", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await confirmPost({ token_hash: "invite-token", type: "invite" });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "invite",
      token_hash: "invite-token",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/update-password");
  });

  it("POST magiclink consome token e redireciona para /update-password", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await confirmPost({ token_hash: "magic-token", type: "magiclink" });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "magiclink",
      token_hash: "magic-token",
    });
    expect(res.headers.get("location")).toBe("http://localhost/update-password");
  });

  it("POST com token inválido/expirado → /login?error=invite_failed", async () => {
    mockVerifyOtp.mockResolvedValue({ error: new Error("expired") });

    const res = await confirmPost({ token_hash: "bad", type: "invite" });

    expect(res.headers.get("location")).toContain("/login?error=invite_failed");
  });

  it("POST sem token ou tipo inválido → /login?error=invite_failed", async () => {
    const res = await confirmPost({ token_hash: "", type: "signup" });

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?error=invite_failed");
  });
});
