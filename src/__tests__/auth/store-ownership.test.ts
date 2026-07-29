// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StoreNotFoundError } from "@/lib/auth/store-ownership";
import type { Store } from "@/lib/store";

const mockFrom = vi.fn();
const mockGetClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
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
      const { UnauthorizedError } = await import("@/lib/auth/require-user");
      throw new UnauthorizedError();
    }
    return { userId: data.claims.sub, claims: data.claims };
  }),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

const mockStore: Store = {
  id: "store-1",
  user_id: "user-123",
  name: "Minha Loja",
  segment: "variedades",
  city: "São Paulo",
  state: "SP",
  brand_color: "#FF0000",
  logo_url: null,
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  logo_status: null,
  identity_state: null,
  text_only_origin: null,
  manual_color_override: false,
  previous_identity_snapshot: null,
  visual_signature_attempts: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  cnpj_normalized: null,
  cnpj_root_hash: "",
  razao_social: null,
  nome_fantasia: null,
  cnpj_validation_score: null,
  verification_status: "unverified",
  verification_data: null,
  cnpj_official_data: null,
  cnpj_lookup_hash: null,
  verification_requested_at: null,
  verification_decided_at: null,
  verification_reasons: null,
  is_test_store: false,
};

function createMockQuery(result: unknown) {
  return vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: result, error: null })),
      })),
      maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    })),
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
  }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("StoreNotFoundError", () => {
  it("has correct name and default message", () => {
    const error = new StoreNotFoundError();
    expect(error.name).toBe("StoreNotFoundError");
    expect(error.message).toBe("Store not found or access denied");
  });

  it("accepts custom message", () => {
    const error = new StoreNotFoundError("Custom error");
    expect(error.message).toBe("Custom error");
  });

  it("is catchable and distinguishable from generic Error", () => {
    const error = new StoreNotFoundError();
    expect(error instanceof StoreNotFoundError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe("getCurrentStore", () => {
  it("returns store when found with userId", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockStore, error: null })),
        })),
      })),
    });

    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    const result = await getCurrentStore("user-123");
    expect(result).toEqual(mockStore);
  });

  it("returns null when store not found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    });

    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    const result = await getCurrentStore("user-456");
    expect(result).toBeNull();
  });

  it("calls requireUser when userId is omitted", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockStore, error: null })),
        })),
      })),
    });

    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    const result = await getCurrentStore();
    expect(result).toEqual(mockStore);
    expect(mockGetClaims).toHaveBeenCalled();
  });

  it("returns null when called without userId and no store", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-999" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    });

    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    const result = await getCurrentStore();
    expect(result).toBeNull();
  });
});

describe("requireOwnership", () => {
  it("returns store when found and belongs to user", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: mockStore, error: null })),
          })),
        })),
      })),
    });

    const { requireOwnership } = await import("@/lib/auth/store-ownership");
    const result = await requireOwnership("store-1", "user-123");
    expect(result).toEqual(mockStore);
  });

  it("throws StoreNotFoundError when store does not exist", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    });

    const { requireOwnership } = await import("@/lib/auth/store-ownership");
    await expect(requireOwnership("nonexistent", "user-123")).rejects.toThrow(StoreNotFoundError);
  });

  it("throws StoreNotFoundError when store belongs to another user", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    });

    const { requireOwnership } = await import("@/lib/auth/store-ownership");
    await expect(requireOwnership("store-1", "user-999")).rejects.toThrow(StoreNotFoundError);
  });

  it("calls requireUser when userId is omitted", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: mockStore, error: null })),
          })),
        })),
      })),
    });

    const { requireOwnership } = await import("@/lib/auth/store-ownership");
    const result = await requireOwnership("store-1");
    expect(result).toEqual(mockStore);
    expect(mockGetClaims).toHaveBeenCalled();
  });
});
