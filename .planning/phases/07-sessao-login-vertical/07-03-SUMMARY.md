# Plan 07-03: Auth Middleware — Summary

**Status:** ✅ Complete
**Completed:** 2026-07-04

## What Was Built

Created `src/middleware.ts` with positive matcher for route protection:

- **Matcher:** `["/", "/login", "/store/:path*", "/campaign/:path*", "/api/:path*"]`
- **Unauthenticated pages:** Redirect to `/login?redirect=<path>` with sanitized redirect
- **Unauthenticated API:** Returns `401 { error: "Unauthorized" }`
- **Authenticated /login:** Redirect to `/`
- **Cookie/header propagation:** Every created response (redirect, 401) copies cookies and cache headers (`cache-control`, `expires`, `pragma`) from `updateSession()` response
- Does not query database — uses `getClaims()` for local JWT validation

## Key Decisions

- Middleware uses `getClaims()`, never `getSession()` (D2)
- `copySessionData()` helper centralizes cookie + header propagation
- Query string preserved in redirect URLs
- No database access in middleware (invariant)

## Verification

- `npx tsc --noEmit` — zero errors
- `npx next build` — build successful
