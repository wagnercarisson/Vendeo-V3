# Security Audit — Phase 10: Perímetro Multi-tenant

**Date:** 2026-07-08
**Auditor:** GSD Security Auditor
**Status:** VERIFIED — 14/14 threats closed

---

## Summary

| Metric | Count |
|--------|-------|
| Threats Identified | 14 |
| Threats Closed (PASS) | 14 |
| Threats Open (FAIL) | 0 |
| Unregistered Flags | 0 |
| ASVS Level | 2 |

---

## Threat Verification Matrix

### T01 — CSRF (Cross-Site Request Forgery) in mutation endpoints
| Field | Value |
|-------|-------|
| **ID** | T01 |
| **Category** | CSRF / Request Forgery |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** `requireSameOrigin(request)` em todas as mutações POST/PATCH/DELETE com precedência (403 antes de auth/ownership). Verificação origin vs host/forwarded-host.

**Code evidence:**
| File | Line(s) | Guard | Method |
|------|---------|-------|--------|
| `src/lib/auth/csrf.ts` | 1-24 | `requireSameOrigin()` — core implementation | All |
| `src/app/api/store/[id]/logo/route.ts` | 516, 541 | `requireSameOrigin(request)` | POST, DELETE |
| `src/app/api/store/[id]/brand-profile/route.ts` | 61, 110 | `requireSameOrigin(request)` | PATCH, POST |
| `src/app/api/store/[id]/brand-profile/infer/route.ts` | 17 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/brand-profile/realign/route.ts` | 32 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/brand-profile/metadata/route.ts` | 11 | `requireSameOrigin(request)` | PATCH |
| `src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts` | 15 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/visual-signature/route.ts` | 164 | `requireSameOrigin(request)` | DELETE |
| `src/app/api/store/[id]/visual-signature/approve/route.ts` | 321 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/visual-signature/reject/route.ts` | 14 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/visual-signature/restore/route.ts` | 19 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts` | 13, 83 | `requireSameOrigin(request)` | POST, DELETE |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | 46 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/logo/retry-brand-director/route.ts` | 20 | `requireSameOrigin(request)` | POST |
| `src/app/api/store/[id]/route.ts` | 55 | `requireSameOrigin(request)` | PATCH |
| `src/app/api/store/route.ts` | 31 | `requireSameOrigin(request)` | POST |
| `src/app/api/campaign/generate/route.ts` | 14 | `requireSameOrigin(request)` | POST |
| `src/app/api/campaign/generate-image/route.ts` | 16 | `requireSameOrigin(request)` | POST |
| `src/app/auth/signout/route.ts` | 8 | `requireSameOrigin(request)` | POST |

**Bug fix verified:** csrf.ts try-catch properly scoped to `new URL()` only (line 13-16), does not catch intentional `ForbiddenError` throws.

**Unit tests:** `src/__tests__/auth/authorized-store.test.ts` lines 80-117 — 5 test cases covering same-origin, cross-origin, missing origin, invalid origin, x-forwarded-host.

---

### T02 — Multi-tenant data leakage via store-scoped endpoints
| Field | Value |
|-------|-------|
| **ID** | T02 |
| **Category** | Authorization / Data Leakage |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** `requireAuthorizedStore(storeId)` em todos os store-scoped route handlers, que chama `requireApiUser()` + `requireOwnership(storeId, userId)` e retorna `AuthorizedStoreContext`.

**Code evidence:**
| File | Line(s) | Method |
|------|---------|--------|
| `src/lib/auth/store-ownership.ts` | 57-61 | `requireAuthorizedStore()` — core implementation |
| `src/lib/auth/store-ownership.ts` | 33-55 | `requireOwnership()` — DB-level ownership check |
| `src/lib/auth/store-ownership.ts` | 8-12 | `AuthorizedStoreContext` type |
| All 14 store-scoped route handlers | — | Applied in all GET/POST/PATCH/DELETE |

**Invariant #4 verified:** Alien store / non-existent store → 404 (StoreNotFoundError), never 403.

**Unit tests:** `src/__tests__/auth/authorized-store.test.ts` lines 23-78 — 3 test cases (success, no session → 401, alien store → 404).
**Matrix tests:** `src/__tests__/api/store-scoped-matrix.test.ts` — ~20 endpoints × 4 scenarios each.

---

### T03 — Direct database access via Supabase (RLS bypass)
| Field | Value |
|-------|-------|
| **ID** | T03 |
| **Category** | Database / Row Level Security |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** RLS habilitado em 4 tabelas filhas com SELECT policies baseadas em owner subquery.

**Code evidence:**
- Migration: `supabase/migrations/20260707000001_enable_rls_child_tables.sql`
- 4x `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (lines 2, 8, 14, 20)
- 3x `CREATE POLICY ... FOR SELECT TO authenticated` (lines 3-5, 9-11, 15-17)
- `generation_events`: RLS enabled but NO policy (default-deny, lines 19-22)
- 3x `GRANT SELECT TO authenticated` (lines 25-27) — no grant on `generation_events`
- Policy pattern: `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))`

**Migration tests:** `src/__tests__/migrations/rls-policies.test.ts` — 8 test cases (4 ENABLE RLS, 3+2 policies, 3 GRANT SELECT, REVERT block, store-logos exception).

---

### T04 — Storage bucket cross-tenant access
| Field | Value |
|-------|-------|
| **ID** | T04 |
| **Category** | Storage / Data Isolation |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** Storage policies com `storage.foldername(name)` path prefix isolation. Buckets mantêm `public = true` (download por URL conhecida), mas listagem/discovery isoladas por tenant.

**Code evidence:**
- Migration lines 30-50
- `DROP POLICY IF EXISTS "brand_assets_public_read"` (line 31)
- `CREATE POLICY "tenant_isolation_brand_assets"` (lines 32-39)
- `DROP POLICY IF EXISTS "visual_signatures_public_read"` (line 42)
- `CREATE POLICY "tenant_isolation_visual_signatures"` (lines 43-50)
- Path prefix check: `(storage.foldername(name))[1] IN (SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid()))`
- `store-logos` exception documented (lines 52-56)

**Tests:** `src/__tests__/migrations/rls-policies.test.ts` line 57-60 — verifies 2 `storage.foldername(name)` occurrences.

---

### T05 — Server Action unauthorized execution
| Field | Value |
|-------|-------|
| **ID** | T05 |
| **Category** | Authorization / Server Actions |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** `requireUser()` + `requireOwnership(storeId)` em todas as 4 Server Actions de visual-signature.

**Code evidence:**
| File | Function | Line(s) |
|------|----------|---------|
| `src/lib/visual-signature/server-actions.ts` | `generateVariations(storeId)` | 105-106 |
| `src/lib/visual-signature/server-actions.ts` | `generateAutomatic(storeId)` | 199-200 |
| `src/lib/visual-signature/server-actions.ts` | `activateSignature(storeId, signatureId)` | 343-344 |
| `src/lib/visual-signature/server-actions.ts` | `listSignatures(storeId)` | 399-400 |

All four call `const user = await requireUser(); await requireOwnership(storeId, user.userId);` before any data access.

---

### T06 — Campaign generation with arbitrary storeId
| Field | Value |
|-------|-------|
| **ID** | T06 |
| **Category** | Authorization / Campaign |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** `POST /api/campaign/generate` must ignore `storeId` from body and use `getCurrentStore(user.userId)`.

**Code evidence:**
`src/app/api/campaign/generate/route.ts` lines 13-19:
```
requireSameOrigin(request);
const user = await requireApiUser();
const store = await getCurrentStore(user.userId);
if (!store) { return notFound("Store not found"); }
```
No `storeId` is read from the body. Store is resolved server-side from authenticated user's identity.

**Tests:** `src/__tests__/api/campaign-matrix.test.ts` — 4 scenarios including "StoreId malicioso no body → 200 (ignorado)".

---

### T07 — Campaign generate-image with cross-tenant storeId
| Field | Value |
|-------|-------|
| **ID** | T07 |
| **Category** | Authorization / Campaign |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** `POST /api/campaign/generate-image` must call `requireOwnership(body.storeId, user.userId)`.

**Code evidence:**
`src/app/api/campaign/generate-image/route.ts` lines 15-91:
```
requireSameOrigin(request);
const user = await requireApiUser();
...
await requireOwnership(parsed.data.storeId, user.userId);
```
Legacy identity fields (storeName, storeLogoUrl, brandProfile, etc.) are rejected with 400 at lines 29-36.

---

### T08 — Client-controlled store identity data
| Field | Value |
|-------|-------|
| **ID** | T08 |
| **Category** | Authorization / Data Integrity |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** Extrair `resolveStoreIdentity`, `validateIdentityReference`, `buildCampaignBrief` para serviço interno sem `"use server"`. Funções recebem `Store` já autorizada, nunca aceitam `storeId` cru do cliente.

**Code evidence:**
- `src/lib/store-identity-service.ts` — No `"use server"` directive
- `resolveStoreIdentity(store)` — Recebe `Store` já autorizada (line 27-28)
- `validateIdentityReference(snapshot)` — Função pura (line 169)
- `buildCampaignBrief(snapshot, input)` — Função pura (line 203)
- `src/lib/actions/store.ts` — Wrappers async para compatibilidade de re-export (lines 1-19)

---

### T09 — Error information leakage through exception types
| Field | Value |
|-------|-------|
| **ID** | T09 |
| **Category** | Error Handling |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** Error classes centralizadas em `errors.ts`, mapeadas para status codes HTTP padronizados via `apiHandler` wrapper.

**Code evidence:**
| Component | File | Line(s) |
|-----------|------|---------|
| Error classes | `src/lib/auth/errors.ts` | 1-20 |
| HTTP response helpers | `src/lib/api-error-response.ts` | 3-13 |
| Error-to-HTTP mapping | `src/lib/auth/api-handler.ts` | 6-17 |

**Mapping:**
| Error Class | HTTP Status | Helper |
|-------------|-------------|--------|
| `ForbiddenError` | 403 | `forbidden()` |
| `UnauthorizedError` | 401 | `unauthorized()` |
| `StoreNotFoundError` | 404 | `notFound()` |

All unhandled errors are rethrown (not swallowed).

**Tests:** `src/__tests__/auth/authorized-store.test.ts` lines 119-152 — 7 test cases for error response status codes and custom messages.

---

### T10 — Guard precedence bypass (CSRF → Auth → Ownership)
| Field | Value |
|-------|-------|
| **ID** | T10 |
| **Category** | Authorization / Guard Ordering |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** Precedência invariante: CSRF (403) → Auth (401) → Ownership (404). Cross-origin sem sessão retorna 403 (nunca 401).

**Code evidence:**
Verified in all mutation handlers: `requireSameOrigin(request)` is called before `requireUser()` / `requireApiUser()`, which is called before `requireOwnership()` / `requireAuthorizedStore()`.

**Tests:** `src/__tests__/api/csrf-matrix.test.ts` — cada mutação × 3 cenários (cross-origin com sessão → 403, cross-origin sem sessão → 403, mesma origem sem sessão → 401).

---

### T11 — generation_events table data exposure
| Field | Value |
|-------|-------|
| **ID** | T11 |
| **Category** | Database / Default-Deny |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** RLS enabled on `generation_events` with NO policy (default-deny). No GRANT SELECT. Only `supabaseAdmin` (service_role) can access.

**Code evidence:**
Migration lines 19-22:
```
ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY;
-- NOTA: Nenhuma policy FOR SELECT TO authenticated em generation_events.
```
No GRANT SELECT for generation_events (line 28 comment).

**Tests:** Lines 32-41 of rls-policies.test.ts — verifies ALTER TABLE exists but no CREATE POLICY for generation_events.

---

### T12 — store-logos bucket public access (accepted risk)
| Field | Value |
|-------|-------|
| **ID** | T12 |
| **Category** | Storage / Accepted Risk |
| **Disposition** | Accept |
| **Status** | ✅ **CLOSED** |

**Documentation evidence:**
- Migration lines 52-56: `-- Storage: store-logos (excecao temporaria — Fase 11)`
- Inventory and migration scheduled for Phase 11
- No DROP POLICY or CREATE POLICY for store-logos
- Verified via grep: no new flows read/write `store-logos` bucket

**Accepted risk rationale:** No new flows in Phase 10 read or write to `store-logos`. Bucket is referenced only in migration tests (`rls-policies.test.ts` lines 66-69).

---

### T13 — GET /api/store bypasses requireAuthorizedStore (intentional)
| Field | Value |
|-------|-------|
| **ID** | T13 |
| **Category** | Authorization / Atalho |
| **Disposition** | Accept |
| **Status** | ✅ **CLOSED** |

**Documentation evidence:**
`src/app/api/store/route.ts` GET handler (line 125-142) uses `requireApiUser()` + `getCurrentStore()` instead of `requireAuthorizedStore()` because this is a convenience endpoint that returns the current user's store without requiring a store ID path parameter.

This is not a security gap — `getCurrentStore()` queries `stores.user_id = claims.sub` which is tenant-isolated by design. Phase 9 established this pattern.

---

### T14 — Guard precedence in server actions
| Field | Value |
|-------|-------|
| **ID** | T14 |
| **Category** | Authorization / Server Actions |
| **Disposition** | Mitigate |
| **Status** | ✅ **CLOSED** |

**Planned mitigation:** Server Actions do not need `requireSameOrigin()` (Next.js Server Actions have built-in CSRF protection via action ID). Only `requireUser()` + `requireOwnership()` are needed.

**Code evidence:**
- `src/lib/visual-signature/server-actions.ts` — All 4 functions call `requireUser()` before `requireOwnership()`
- No `requireSameOrigin()` in server actions (correct — Server Actions have native CSRF via action ID and FormData requirement)

---

## Route Coverage Verification

All 18 API routes with their HTTP methods:

| Route | Methods | CSRF | Auth/Ownership | apiHandler |
|-------|---------|------|----------------|------------|
| `POST /api/store` | POST | ✅ line 31 | ✅ requireUser line 33 | ✅ line 30 |
| `GET /api/store` | GET | N/A (read) | ✅ requireApiUser + getCurrentStore | ✅ line 125 |
| `GET /api/store/[id]` | GET | N/A (read) | ✅ requireUser + requireOwnership | ✅ line 30 |
| `PATCH /api/store/[id]` | PATCH | ✅ line 55 | ✅ requireUser + requireOwnership | ✅ line 51 |
| `GET /api/store/[id]/logo` | GET | N/A (read) | ✅ requireAuthorizedStore | ✅ line 525 |
| `POST /api/store/[id]/logo` | POST | ✅ line 516 | ✅ requireAuthorizedStore | ✅ line 512 |
| `DELETE /api/store/[id]/logo` | DELETE | ✅ line 541 | ✅ requireAuthorizedStore | ✅ line 537 |
| `POST /api/store/[id]/logo/retry-brand-director` | POST | ✅ line 20 | ✅ requireAuthorizedStore | ✅ |
| `GET /api/store/[id]/brand-profile` | GET | N/A (read) | ✅ requireAuthorizedStore | ✅ line 12 |
| `POST /api/store/[id]/brand-profile` | POST | ✅ line 110 | ✅ requireAuthorizedStore | ✅ line 106 |
| `PATCH /api/store/[id]/brand-profile` | PATCH | ✅ line 61 | ✅ requireAuthorizedStore | ✅ line 57 |
| `POST /api/store/[id]/brand-profile/infer` | POST | ✅ line 17 | ✅ requireAuthorizedStore | ✅ line 13 |
| `POST /api/store/[id]/brand-profile/realign` | POST | ✅ line 32 | ✅ requireAuthorizedStore | ✅ |
| `PATCH /api/store/[id]/brand-profile/metadata` | PATCH | ✅ line 11 | ✅ requireAuthorizedStore | ✅ line 7 |
| `POST /api/store/[id]/brand-profile/generate-without-logo` | POST | ✅ line 15 | ✅ requireAuthorizedStore | ✅ |
| `GET /api/store/[id]/visual-signature` | GET | N/A (read) | ✅ requireAuthorizedStore | ✅ line 53 |
| `DELETE /api/store/[id]/visual-signature` | DELETE | ✅ line 164 | ✅ requireAuthorizedStore | ✅ line 160 |
| `POST /api/store/[id]/visual-signature/approve` | POST | ✅ line 321 | ✅ requireAuthorizedStore | ✅ line 317 |
| `POST /api/store/[id]/visual-signature/reject` | POST | ✅ line 14 | ✅ requireAuthorizedStore | ✅ |
| `POST /api/store/[id]/visual-signature/restore` | POST | ✅ line 19 | ✅ requireAuthorizedStore | ✅ |
| `POST /api/store/[id]/visual-signature/dismiss-critical-drift` | POST | ✅ line 13 | ✅ requireAuthorizedStore | ✅ line 9 |
| `DELETE /api/store/[id]/visual-signature/dismiss-critical-drift` | DELETE | ✅ line 83 | ✅ requireAuthorizedStore | ✅ line 79 |
| `POST /api/store/[id]/visual-signature/generate-without-logo` | POST | ✅ line 46 | ✅ requireAuthorizedStore | ✅ |
| `POST /api/campaign/generate` | POST | ✅ line 14 | ✅ requireApiUser + getCurrentStore | ✅ line 13 |
| `POST /api/campaign/generate-image` | POST | ✅ line 16 | ✅ requireApiUser + requireOwnership | ✅ line 15 |
| `POST /auth/signout` | POST | ✅ line 8 | N/A (signout) | ✅ line 7 |

**Coverage:** 100% — every mutation has CSRF, every data-accessing route has auth/ownership, all handlers use `apiHandler` wrapper.

---

## Unregistered Flags

None. All new attack surfaces introduced in Phase 10 are mapped to threat IDs above.

---

## Verification Artifacts

| Artifact | Path |
|----------|------|
| Error classes | `src/lib/auth/errors.ts` |
| CSRF guard | `src/lib/auth/csrf.ts` |
| Authorized store guard | `src/lib/auth/store-ownership.ts` |
| API error response helpers | `src/lib/api-error-response.ts` |
| API handler wrapper | `src/lib/auth/api-handler.ts` |
| Require user (reexport) | `src/lib/auth/require-user.ts` |
| Store identity service | `src/lib/store-identity-service.ts` |
| Server actions (guarded) | `src/lib/visual-signature/server-actions.ts` |
| Store actions (wrappers) | `src/lib/actions/store.ts` |
| RLS migration | `supabase/migrations/20260707000001_enable_rls_child_tables.sql` |
| RLS migration tests | `src/__tests__/migrations/rls-policies.test.ts` |
| Auth guard unit tests | `src/__tests__/auth/authorized-store.test.ts` |
| Store-scoped matrix tests | `src/__tests__/api/store-scoped-matrix.test.ts` |
| Campaign matrix tests | `src/__tests__/api/campaign-matrix.test.ts` |
| Store creation matrix tests | `src/__tests__/api/store-creation-matrix.test.ts` |
| CSRF matrix tests | `src/__tests__/api/csrf-matrix.test.ts` |
| Server action guard tests | `src/__tests__/actions/visual-signature-guards.test.ts` |
| Store identity service tests | `src/__tests__/actions/store-identity-service.test.ts` |

---

## Quality Gates (from 10-06)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Zero type errors |
| `npx vitest run` | ✅ 51/51 files, 457/457 tests passing |
| `npm run lint` | ✅ Zero lint errors |
| `npx next build` | ✅ Build successful |
| localStorage audit | ✅ No store_id in localStorage |
| store-logos isolation | ✅ No new flows read/write store-logos |

---

## Accepted Risks

| Risk | Rationale | Remediation Timeline |
|------|-----------|---------------------|
| `store-logos` bucket public | No new flows use this bucket. Existing public policy maintained for backward compatibility. Inventory and migration scheduled. | Phase 11 |
| GET /api/store uses getCurrentStore instead of requireAuthorizedStore | Convenience endpoint; owner isolation is maintained via `stores.user_id = claims.sub` query. | Permanent (by design) |
| Buckets remain `public = true` | Download by known URL is permitted. Only list/discovery is restricted by storage policies. Necessary for public image serving. | Permanent (by design) |

---

## Conclusion

**Phase 10 passes security audit.** All 14 declared threats have verified mitigations in the implemented code. No open threats, no unregistered flags, no critical findings.

The security perimeter is closed across all attack surfaces:
- ✅ **Application layer:** CSRF on every mutation, ownership checks on every store-scoped endpoint, centralized error contracts, apiHandler wrapper
- ✅ **Data layer:** RLS on all child tables with owner-scoped policies, default-deny on sensitive tables
- ✅ **Storage layer:** Tenant-isolated storage policies with path prefix verification
- ✅ **Server Actions:** Auth + ownership guards on all 4 entrypoints
- ✅ **Campaign routes:** No client-controlled storeId authority
- ✅ **Test coverage:** Parametrized matrix tests for all scenarios (401/403/404/200) + CSRF precedence invariants
