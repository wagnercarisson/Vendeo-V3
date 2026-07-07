# Plan 10-02: Route Handlers — requireAuthorizedStore + CSRF — Summary

**Status:** Complete
**Date:** 2026-07-07

## Files Modified

### Logo (2 arquivos)
- `src/app/api/store/[id]/logo/route.ts` — GET: requireAuthorizedStore; POST/DELETE: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/logo/retry-brand-director/route.ts` — POST: requireSameOrigin + requireAuthorizedStore

### Brand Profile (5 arquivos)
- `src/app/api/store/[id]/brand-profile/route.ts` — GET: requireAuthorizedStore; POST/PATCH: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/brand-profile/infer/route.ts` — POST: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/brand-profile/realign/route.ts` — POST: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/brand-profile/metadata/route.ts` — PATCH: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts` — POST: requireSameOrigin + requireAuthorizedStore

### Visual Signature (6 arquivos)
- `src/app/api/store/[id]/visual-signature/route.ts` — GET: requireAuthorizedStore; DELETE: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/visual-signature/approve/route.ts` — POST: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/visual-signature/reject/route.ts` — POST: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/visual-signature/restore/route.ts` — POST: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts` — POST/DELETE: requireSameOrigin + requireAuthorizedStore
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — POST: requireSameOrigin + requireAuthorizedStore

### Campaign (2 arquivos)
- `src/app/api/campaign/generate/route.ts` — requireSameOrigin + requireApiUser + getCurrentStore; storeId do body ignorado
- `src/app/api/campaign/generate-image/route.ts` — requireSameOrigin + requireApiUser + requireOwnership(body.storeId)

### CSRF-only (3 arquivos)
- `src/app/api/store/[id]/route.ts` — PATCH: requireSameOrigin before requireUser
- `src/app/api/store/route.ts` — POST: requireSameOrigin before requireUser
- `src/app/auth/signout/route.ts` — POST: requireSameOrigin before signOut

## Quality

- `npx tsc --noEmit` — zero errors
- Precedência dos guards: CSRF (403) → Auth (401) → Ownership (404)
- ~18 route handlers com guards aplicados
