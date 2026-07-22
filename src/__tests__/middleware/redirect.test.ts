// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { updateSession } from "@/lib/supabase/middleware";

function makeNextResponse() {
  const headers = new Headers();
  const cookies: Record<string, { name: string; value: string }> = {};
  return {
    status: 200,
    headers,
    cookies: {
      getAll: () => Object.values(cookies),
      set: (name: string, value: string) => { cookies[name] = { name, value }; },
    },
  };
}

function makeNextRequest(url: string) {
  const u = new URL(url);
  return {
    nextUrl: u,
    url: u.href,
    cookies: { getAll: () => [] },
    headers: new Headers(),
  };
}

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(() =>
    Promise.resolve({
      response: makeNextResponse(),
      claims: { sub: "user-123", email: "test@test.com" },
    }),
  ),
}));

describe("middleware redirect", () => {
  it("redirects authenticated user on /login to /dashboard", async () => {
    const mod = await import("@/middleware");
    const request = makeNextRequest("http://localhost:3000/login");
    const response = await mod.middleware(request as any);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("redirects authenticated user on /signup to /dashboard", async () => {
    const mod = await import("@/middleware");
    const request = makeNextRequest("http://localhost:3000/signup");
    const response = await mod.middleware(request as any);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("does not redirect authenticated user on /dashboard", async () => {
    const mod = await import("@/middleware");
    const request = makeNextRequest("http://localhost:3000/dashboard");
    const response = await mod.middleware(request as any);
    expect(response.status).toBe(200);
  });

  it("passes through cron API route without session", async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      response: makeNextResponse() as any,
      claims: null,
    });

    const mod = await import("@/middleware");
    const request = makeNextRequest("http://localhost:3000/api/cron/monthly-credits");
    const response = await mod.middleware(request as any);
    expect(response.status).toBe(200);
  });
});
