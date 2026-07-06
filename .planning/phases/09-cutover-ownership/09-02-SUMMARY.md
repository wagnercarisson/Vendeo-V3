# 09-02 — API Routes — Ownership — Summary

**Status:** ✓ Complete
**Commits:**
- `07f97f0` — POST /api/store: requireUser + claims.sub; GET /api/store atalho: requireApiUser + getCurrentStore
- `dc02bee` — GET /api/store/:id: requireUser + requireOwnership; PATCH /api/store/:id: requireUser + requireOwnership

**Files modified:**
- `src/app/api/store/route.ts` — POST now receives `claims.sub`; new GET handler (atalho)
- `src/app/api/store/[id]/route.ts` — GET/PATCH with ownership validation

**Error contract:** 401 (unauthenticated) | 404 (store not found/unowned) | 409 (duplicate store)

**Verification:** Rotas mockáveis via `requireOwnership` (abstração testável em 09-04). Rotas existentes não quebradas.
