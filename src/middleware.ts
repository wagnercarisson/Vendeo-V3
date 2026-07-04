import { updateSession } from "@/lib/supabase/middleware";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set([
  "/login", "/signup", "/check-email", "/forgot-password",
]);

const ALWAYS_PASSTHROUGH = new Set(["/auth/confirm"]);

export async function middleware(request: NextRequest) {
  const { response, claims } = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const redirectPath = pathname + request.nextUrl.search;
  const safeRedirect = sanitizeRedirectPath(redirectPath);
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", safeRedirect);

  const isApiRoute = pathname.startsWith("/api/");
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isAlwaysPassthrough = ALWAYS_PASSTHROUGH.has(pathname);

  if (isAlwaysPassthrough) return response;

  if (!claims?.sub) {
    if (isApiRoute) {
      const unauthorizedResponse = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
      copySessionData(unauthorizedResponse, response);
      return unauthorizedResponse;
    }

    if (isPublicRoute) return response;

    const redirectResponse = NextResponse.redirect(loginUrl, { status: 302 });
    copySessionData(redirectResponse, response);
    return redirectResponse;
  }

  if (isPublicRoute || pathname === "/login") {
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
    "/signup",
    "/check-email",
    "/forgot-password",
    "/update-password",
    "/auth/confirm",
    "/store/:path*",
    "/campaign/:path*",
    "/api/:path*",
  ],
};
