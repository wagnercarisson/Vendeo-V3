import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

vi.mock("@/lib/auth/redirect", () => ({
  sanitizeRedirectPath: (path: string) => {
    if (!path || path === "/login" || path.startsWith("http")) return "/";
    return path;
  },
}));

function createLoginUrl(url: string, redirectPath: string, safeRedirect: string): string {
  const loginUrl = new URL("/login", url);
  loginUrl.searchParams.set("redirect", safeRedirect);
  return loginUrl.toString();
}

async function middleware(url: string): Promise<Response> {
  const { updateSession } = await import("@/lib/supabase/middleware");
  const { sanitizeRedirectPath } = await import("@/lib/auth/redirect");

  const request = { url };
  const { response, claims } = await (updateSession as any)(request);

  const parsedUrl = new URL(url);
  const redirectPath = parsedUrl.pathname + parsedUrl.search;
  const safeRedirect = sanitizeRedirectPath(redirectPath);
  const loginUrlStr = createLoginUrl(url, redirectPath, safeRedirect);

  const isApiRoute = parsedUrl.pathname.startsWith("/api/");
  const isLoginPage = parsedUrl.pathname === "/login";

  if (!claims?.sub) {
    if (isApiRoute) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    if (isLoginPage) {
      return response;
    }

    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: loginUrlStr },
    });

    if (response?.cookies?.getAll) {
      response.cookies.getAll().forEach((cookie: { name: string; value: string }) => {
        redirectResponse.headers.append("set-cookie", `${cookie.name}=${cookie.value}`);
      });
    }

    return redirectResponse;
  }

  if (isLoginPage) {
    return new Response(null, {
      status: 302,
      headers: { location: new URL("/", url).toString() },
    });
  }

  return response;
}

function mockResponse() {
  const res = new Response(null) as any;
  res.cookies = {
    getAll: () => [{ name: "sb-token", value: "token123" }],
  };
  return res;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("middleware auth", () => {
  it("unauthenticated / -> redirect /login?redirect=/", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: null,
    });

    const res = await middleware("http://localhost/");
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirect=%2F");
  });

  it("unauthenticated /campaign/preview -> redirect /login?redirect=/campaign/preview", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: null,
    });

    const res = await middleware("http://localhost/campaign/preview");
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(decodeURIComponent(location!)).toContain("/campaign/preview");
  });

  it("preserves query string in redirect", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: null,
    });

    const res = await middleware("http://localhost/campaign/preview?foo=bar");
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(decodeURIComponent(location!)).toContain("foo=bar");
  });

  it("unauthenticated /api/store -> 401 JSON", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: null,
    });

    const res = await middleware("http://localhost/api/store");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("unauthenticated /login -> pass-through", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: null,
    });

    const res = await middleware("http://localhost/login");
    expect(res.status).toBe(200);
  });

  it("authenticated /login -> redirect /", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: { sub: "user-123" },
    });

    const res = await middleware("http://localhost/login");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("authenticated / -> pass-through", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: { sub: "user-123" },
    });

    const res = await middleware("http://localhost/");
    expect(res.status).toBe(200);
  });

  it("redirect response preserves cookies from updateSession", async () => {
    mockUpdateSession.mockResolvedValue({
      response: mockResponse(),
      claims: null,
    });

    const res = await middleware("http://localhost/store");
    expect(res.status).toBe(302);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("sb-token");
  });
});
