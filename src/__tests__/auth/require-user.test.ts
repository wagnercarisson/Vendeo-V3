import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/lib/auth/require-user";
import type { JwtPayload } from "@/types/auth";

const mockGetClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getClaims: mockGetClaims,
    },
  })),
}));

async function requireUser(): Promise<{ userId: string; claims: JwtPayload }> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();

  const claims = data?.claims as JwtPayload | undefined;

  if (error || !claims?.sub) {
    throw new UnauthorizedError();
  }

  return {
    userId: claims.sub,
    claims,
  };
}

async function requirePageUser(): Promise<{ userId: string; claims: JwtPayload }> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new Error("redirect:/login");
    }
    throw error;
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("requireUser", () => {
  it("returns AuthenticatedUser when getClaims returns valid claims", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-123", email: "test@test.com", role: "authenticated" } },
      error: null,
    });

    const result = await requireUser();
    expect(result.userId).toBe("user-123");
    expect(result.claims.sub).toBe("user-123");
    expect(result.claims.email).toBe("test@test.com");
  });

  it("throws UnauthorizedError when getClaims returns error", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("Auth error"),
    });

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when getClaims returns null claims", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: null,
    });

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when claims has no sub", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { email: "test@test.com" } },
      error: null,
    });

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });
});

describe("requirePageUser", () => {
  it("returns AuthenticatedUser when authenticated", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-456" } },
      error: null,
    });

    const result = await requirePageUser();
    expect(result.userId).toBe("user-456");
  });

  it("redirects to /login when not authenticated", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("Not authenticated"),
    });

    await expect(requirePageUser()).rejects.toThrow("redirect:/login");
  });
});
