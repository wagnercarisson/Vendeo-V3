import { describe, it, expect, vi, beforeEach } from "vitest";

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
