import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

const mockRequireApiUser = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: (...args: unknown[]) => mockRequireApiUser(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

async function requireAdmin(): Promise<{ userId: string }> {
  const { requireApiUser } = await import("@/lib/auth/require-user");
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const { userId } = await requireApiUser();

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    throw new ForbiddenError("Acesso restrito a administradores");
  }

  return { userId };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("requireAdmin", () => {
  it("returns userId when user is admin", async () => {
    mockRequireApiUser.mockResolvedValue({ userId: "admin-1" });
    mockSelect.mockReturnValue({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() =>
          Promise.resolve({ data: { user_id: "admin-1" }, error: null }),
        ),
      })),
    });

    const result = await requireAdmin();
    expect(result.userId).toBe("admin-1");
  });

  it("throws ForbiddenError when user is not admin", async () => {
    mockRequireApiUser.mockResolvedValue({ userId: "user-1" });
    mockSelect.mockReturnValue({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    });

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
    await expect(requireAdmin()).rejects.toThrow("Acesso restrito a administradores");
  });

  it("propagates UnauthorizedError when not authenticated", async () => {
    mockRequireApiUser.mockRejectedValue(new UnauthorizedError());

    await expect(requireAdmin()).rejects.toThrow(UnauthorizedError);
  });
});
