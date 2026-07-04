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
  vi.restoreAllMocks();
});

describe("AuthConfirm GET handler", () => {
  it("redirects to / on valid signup token", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await confirmHandler("http://localhost/auth/confirm?token_hash=valid&type=signup");

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "valid",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects to /update-password on valid recovery token", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await confirmHandler(
      "http://localhost/auth/confirm?token_hash=valid&type=recovery&next=/update-password",
    );

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "valid",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/update-password");
  });

  it("uses default / when next is invalid (open redirect prevention)", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await confirmHandler(
      "http://localhost/auth/confirm?token_hash=valid&type=recovery&next=https://evil.com",
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects to /login?error=confirmation_failed on invalid signup token", async () => {
    mockVerifyOtp.mockResolvedValue({ error: new Error("Invalid token") });

    const res = await confirmHandler("http://localhost/auth/confirm?token_hash=invalid&type=signup");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=confirmation_failed");
  });

  it("redirects to /login?error=recovery_failed on invalid recovery token", async () => {
    mockVerifyOtp.mockResolvedValue({ error: new Error("Invalid token") });

    const res = await confirmHandler("http://localhost/auth/confirm?token_hash=invalid&type=recovery");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=recovery_failed");
  });

  it("redirects to /login?error=confirmation_failed when token_hash is missing", async () => {
    const res = await confirmHandler("http://localhost/auth/confirm?type=signup");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=confirmation_failed");
  });

  it("redirects to /login?error=confirmation_failed when type is invalid", async () => {
    const res = await confirmHandler("http://localhost/auth/confirm?token_hash=xxx&type=invalid");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=confirmation_failed");
  });

  it("redirects to /login?error=confirmation_failed when token_hash and type are missing", async () => {
    const res = await confirmHandler("http://localhost/auth/confirm");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=confirmation_failed");
  });
});
