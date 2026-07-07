// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/lib/auth/errors";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { unauthorized, notFound, forbidden } from "@/lib/api-error-response";

const mockGetClaims = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getClaims: mockGetClaims,
    },
    from: mockFrom,
  })),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("requireAuthorizedStore", () => {
  it("returns context when auth and ownership succeed", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: "store-1", user_id: "user-123", name: "Minha Loja" },
              error: null,
            })),
          })),
        })),
      })),
    });

    const { requireAuthorizedStore } = await import("@/lib/auth/store-ownership");
    const ctx = await requireAuthorizedStore("store-1");
    expect(ctx.userId).toBe("user-123");
    expect(ctx.storeId).toBe("store-1");
    expect(ctx.store.name).toBe("Minha Loja");
  });

  it("throws UnauthorizedError when auth fails", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("No session"),
    });

    const { UnauthorizedError } = await import("@/lib/auth/errors");
    const { requireAuthorizedStore } = await import("@/lib/auth/store-ownership");
    await expect(requireAuthorizedStore("store-1")).rejects.toThrow(UnauthorizedError);
  });

  it("throws StoreNotFoundError when store is not owned by user", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    });

    const { requireAuthorizedStore, StoreNotFoundError } = await import("@/lib/auth/store-ownership");
    await expect(requireAuthorizedStore("alien-store")).rejects.toThrow(StoreNotFoundError);
  });
});

describe("requireSameOrigin", () => {
  it("passes when origin matches host", () => {
    const request = new Request("http://localhost:3000/api/store/1", {
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    });
    expect(() => requireSameOrigin(request)).not.toThrow();
  });

  it("throws ForbiddenError when origin does not match host", () => {
    const request = new Request("http://localhost:3000/api/store/1", {
      headers: { origin: "http://evil.com", host: "localhost:3000" },
    });
    expect(() => requireSameOrigin(request)).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when origin is missing", () => {
    const request = new Request("http://localhost:3000/api/store/1");
    expect(() => requireSameOrigin(request)).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when origin is invalid URL", () => {
    const request = new Request("http://localhost:3000/api/store/1", {
      headers: { origin: "not-a-url", host: "localhost:3000" },
    });
    expect(() => requireSameOrigin(request)).toThrow(ForbiddenError);
  });

  it("respects x-forwarded-host over host", () => {
    const request = new Request("http://localhost:3000/api/store/1", {
      headers: {
        origin: "https://vendeo.tech",
        host: "localhost:3000",
        "x-forwarded-host": "vendeo.tech",
      },
    });
    expect(() => requireSameOrigin(request)).not.toThrow();
  });
});

describe("JsonErrorResponse", () => {
  it("unauthorized returns 401 with default message", () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
  });

  it("unauthorized returns custom message", async () => {
    const res = unauthorized("Custom auth error");
    const body = await res.json();
    expect(body.error).toBe("Custom auth error");
  });

  it("notFound returns 404 with default message", () => {
    const res = notFound();
    expect(res.status).toBe(404);
  });

  it("notFound returns custom message", async () => {
    const res = notFound("Store not found");
    const body = await res.json();
    expect(body.error).toBe("Store not found");
  });

  it("forbidden returns 403 with default message", () => {
    const res = forbidden();
    expect(res.status).toBe(403);
  });

  it("forbidden returns custom message", async () => {
    const res = forbidden("CSRF blocked");
    const body = await res.json();
    expect(body.error).toBe("CSRF blocked");
  });
});
