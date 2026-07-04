import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/lib/auth/require-user";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

async function requireUser(): Promise<{ userId: string; claims: Record<string, unknown> }> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id) {
    throw new UnauthorizedError();
  }

  return {
    userId: data.user.id,
    claims: data.user.app_metadata ?? {},
  };
}

async function requirePageUser(): Promise<{ userId: string; claims: Record<string, unknown> }> {
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
  it("returns AuthenticatedUser when getUser returns valid user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", app_metadata: { role: "authenticated" } } },
      error: null,
    });

    const result = await requireUser();
    expect(result.userId).toBe("user-123");
    expect(result.claims).toEqual({ role: "authenticated" });
  });

  it("throws UnauthorizedError when getUser returns error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Auth error"),
    });

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when getUser returns null user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when user has no id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: undefined, app_metadata: {} } },
      error: null,
    });

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });
});

describe("requirePageUser", () => {
  it("returns AuthenticatedUser when authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-456", app_metadata: {} } },
      error: null,
    });

    const result = await requirePageUser();
    expect(result.userId).toBe("user-456");
  });

  it("redirects to /login when not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    await expect(requirePageUser()).rejects.toThrow("redirect:/login");
  });
});
