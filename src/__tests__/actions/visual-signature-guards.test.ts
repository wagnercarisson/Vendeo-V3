// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetClaims = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
  createServerClient: vi.fn(async () => ({
    auth: {
      getClaims: mockGetClaims,
    },
    from: mockFrom,
  })),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) {
      const { UnauthorizedError } = await import("@/lib/auth/errors");
      throw new UnauthorizedError();
    }
    return { userId: data.claims.sub, claims: data.claims };
  }),
}));

vi.mock("@/lib/visual-signature/persistence", () => ({
  getActiveVisualSignature: vi.fn(async () => null),
}));

function createMockStoreQuery(result: unknown) {
  return vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: result, error: null })),
              maybeSingle: vi.fn(async () => ({ data: result, error: null })),
              order: vi.fn(() => ({
                order: vi.fn(async () => ({ data: result ? [result] : [], error: null })),
              })),
            })),
          })),
          single: vi.fn(async () => ({ data: result, error: null })),
          maybeSingle: vi.fn(async () => ({ data: result, error: null })),
        })),
      })),
    })),
  }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("generateVariations guards", () => {
  it("throws UnauthorizedError when no session", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("No session"),
    });

    const { generateVariations } = await import(
      "@/lib/visual-signature/server-actions"
    );
    await expect(generateVariations("store-1")).rejects.toThrow();
  });

  it("throws StoreNotFoundError for alien store", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            single: vi.fn(async () => {
              const { StoreNotFoundError } = await import("@/lib/auth/errors");
              throw new StoreNotFoundError();
            }),
          })),
        })),
      })),
    });

    const { generateVariations } = await import(
      "@/lib/visual-signature/server-actions"
    );
    await expect(generateVariations("alien-store")).rejects.toThrow();
  });
});

describe("generateAutomatic guards", () => {
  it("throws UnauthorizedError when no session", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("No session"),
    });

    const { generateAutomatic } = await import(
      "@/lib/visual-signature/server-actions"
    );
    await expect(generateAutomatic("store-1")).rejects.toThrow();
  });
});

describe("activateSignature guards", () => {
  it("throws UnauthorizedError when no session", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("No session"),
    });

    const { activateSignature } = await import(
      "@/lib/visual-signature/server-actions"
    );
    // requireOwnership fails first (no session) -> requireOwnership calls requireUser which throws
    await expect(activateSignature("store-1", "sig-1")).rejects.toThrow();
  });
});

describe("listSignatures guards", () => {
  it("throws UnauthorizedError when no session", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("No session"),
    });

    const { listSignatures } = await import(
      "@/lib/visual-signature/server-actions"
    );
    await expect(listSignatures("store-1")).rejects.toThrow();
  });
});
