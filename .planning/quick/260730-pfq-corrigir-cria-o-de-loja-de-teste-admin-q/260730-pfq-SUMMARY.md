---
quick_id: 260730-pfq
type: fix
subsystem: database, api
tags: supabase, rpc, cnpj, migration, constraint

# Dependency graph
requires:
  - migration: 20260729000002_fix_cnpj_atomicity
    provides: chk_stores_cnpj_atomic CHECK constraint
provides:
  - admin_create_test_store RPC now accepts and persists cnpj_root_hash
  - Route computes hashCnpjRoot and passes p_cnpj_root_hash to RPC
  - Test coverage for hash computation and RPC parameter
affects: [admin create-test-store, f33 cnpj verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [cnpj_root_hash parameter convention follows create_store_with_cnpj/update_store_cnpj]

key-files:
  created:
    - supabase/migrations/20260731000002_fix_admin_create_test_store_cnpj_root_hash.sql
  modified:
    - src/app/api/admin/stores/create-test/route.ts
    - src/app/api/admin/stores/__tests__/create-test.test.ts

key-decisions:
  - "p_cnpj_root_hash placed after p_cnpj_normalized (position 5 of 10), matching insert param order from create_store_with_cnpj"
  - "Validation raises 'cnpj_root_hash_required' for explicit error vs cryptic CHECK violation"

duration: ~15min
completed: 2026-07-30
---

# Quick 260730-pfq: Fix admin create-test-store cnpj_root_hash

**Added p_cnpj_root_hash to admin_create_test_store RPC, route, and tests to satisfy chk_stores_cnpj_atomic CHECK constraint**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-30T18:25:00Z
- **Completed:** 2026-07-30T18:27:00Z
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments

- Created new migration dropping old 9-arg RPC and recreating with `p_cnpj_root_hash TEXT` parameter + validation
- Updated route to compute `hashCnpjRoot()` from first 8 digits of normalized CNPJ and pass to RPC
- Extended test suite to verify hash function call and RPC parameter presence

## Task Commits

1. **Task 1: Add p_cnpj_root_hash to admin_create_test_store RPC** — `54251c8` (fix)
2. **Task 2: Update route to compute and pass cnpj_root_hash** — `89c1ce1` (feat)
3. **Task 3: Update tests to verify p_cnpj_root_hash** — `239443e` (test)

## Files Created/Modified

- `supabase/migrations/20260731000002_fix_admin_create_test_store_cnpj_root_hash.sql` — Drops old 9-arg RPC, recreates with `p_cnpj_root_hash TEXT` param, validation, and INSERT column
- `src/app/api/admin/stores/create-test/route.ts` — Imports `hashCnpjRoot`, computes hash from first 8 digits, passes `p_cnpj_root_hash` in RPC call
- `src/app/api/admin/stores/__tests__/create-test.test.ts` — Mocks `hashCnpjRoot`, verifies call with `"12345678"` and RPC receives `p_cnpj_root_hash: "hashed_12345678"`

## Decisions Made

- `p_cnpj_root_hash` placed after `p_cnpj_normalized` (position 5 of 10 params), matching the insert param convention from `create_store_with_cnpj` and `update_store_cnpj`
- Added explicit validation `IF p_cnpj_normalized IS NOT NULL AND (p_cnpj_root_hash IS NULL OR p_cnpj_root_hash = '') THEN RAISE EXCEPTION 'cnpj_root_hash_required'` — gives a clear error instead of a cryptic CHECK constraint violation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all files read, edits applied cleanly, TypeScript and tests passing.

## Verification

- **TypeScript:** `npx tsc --noEmit --pretty` — clean (no output)
- **Tests:** `vitest run create-test.test.ts` — 3/3 passed
- **Lint:** `npx next lint` — no warnings or errors

---

*Quick ID: 260730-pfq*
*Completed: 2026-07-30*
