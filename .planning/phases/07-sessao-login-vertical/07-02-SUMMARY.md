# Plan 07-02: Auth Helpers — Summary

**Status:** ✅ Complete
**Completed:** 2026-07-04

## What Was Built

Two auth helper modules implementing authorization and redirect safety:

1. **`src/lib/auth/require-user.ts`**:
   - `UnauthorizedError` class extending `Error`
   - `requireUser()` — creates server client, calls `getUser()`, returns `{ userId, claims }` or throws `UnauthorizedError`
   - `requirePageUser()` — wrapper that catches `UnauthorizedError` and calls `redirect("/login")`
   - `requireApiUser()` — wrapper that throws `UnauthorizedError` (handler returns 401 JSON)

2. **`src/lib/auth/redirect.ts`**:
   - `sanitizeRedirectPath(path)` — validates against allowlist (`/`, `/store`, `/campaign/*`)
   - Rejects: absolute URLs, protocol-relative, backslashes, auth paths
   - Preserves query string, discards fragments
   - Fallback: `"/"`

## Key Decisions

- `requireUser()` uses `getUser()` (server-side verification), not local JWT parsing
- `requirePageUser()` is for Server Components; `requireApiUser()` for Route Handlers
- Allowlist-based validation for redirect safety (D5)
- Dupla validação: middleware produces the param, login validates before `router.replace()`

## Verification

- `npx tsc --noEmit` — zero errors
