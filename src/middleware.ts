import { updateSession } from "@/lib/supabase/middleware";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { response, claims } = await updateSession(request);

  const redirectPath = request.nextUrl.pathname + request.nextUrl.search;
  const safeRedirect = sanitizeRedirectPath(redirectPath);
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", safeRedirect);

  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!claims?.sub) {
    if (isApiRoute) {
      const unauthorizedResponse = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
      copySessionData(unauthorizedResponse, response);
      return unauthorizedResponse;
    }

    if (isLoginPage) {
      return response;
    }

    const redirectResponse = NextResponse.redirect(loginUrl, { status: 302 });
    copySessionData(redirectResponse, response);
    return redirectResponse;
  }

  if (isLoginPage) {
    const redirectResponse = NextResponse.redirect(
      new URL("/", request.url),
      { status: 302 },
    );
    copySessionData(redirectResponse, response);
    return redirectResponse;
  }

  return response;
}

function copySessionData(
  target: NextResponse,
  source: NextResponse,
): void {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });

  const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;
  for (const key of CACHE_HEADERS) {
    const value = source.headers.get(key);
    if (value) target.headers.set(key, value);
  }
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/store/:path*",
    "/campaign/:path*",
    "/api/:path*",
  ],
};
