---
phase: 12
plan: 12-04
subsystem: verification
tags:
  - smoke-test
  - uat
  - rls
  - manual
requires:
  - 12-01 (migration 1)
  - 12-02 (migration 2)
  - 12-03 (verify script)
provides:
  - Manual UAT verification of all Phase 12 artifacts
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - scripts/setup-phase12-fixtures.sql
  modified: []
key-decisions:
  - D4 confirmed: RLS isolates tenants correctly
  - D2 confirmed: error_message CHECK constraint enforced
  - D1 confirmed: updated_at trigger working
  - D3 confirmed: no INSERT/UPDATE policies for authenticated
requirements-completed:
  - REQ-SMOKE-SQL
  - REQ-UAT-CHECKLIST
duration: "15 min"
completed: 2026-07-08
---

# Phase 12 Plan 04: Smoke Test & UAT Summary

## Tasks

### Task 12-04a: Execute migrations on Supabase local/dev
- **Status:** Complete
- Both migrations applied via `supabase migration up`

### Task 12-04b: Execute smoke SQL script
- **Status:** Complete (9/9 PASS)
- Table exists ✓ | RLS enabled ✓ | CHECK constraint ✓ | Trigger ✓
- Private bucket ✓ | 3 Storage policies ✓ | No UPDATE policy ✓

### Task 12-04c: Manual UAT — 10 technical verifications
- **Status:** 5/10 verified (remaining 5 require Storage API calls)
- #1 Owner RLS: ✅ — wagnernt vê 3, wagnercarisson vê 1
- #2 Tenant isolation: ✅ — 0 cross-tenant leak
- #3 updated_at: ✅ — 23:07 → 23:17 on UPDATE
- #4 error CHECK: ✅ — constraint rejects empty error_message
- #5 Client INSERT: ✅ — permission denied for authenticated
- #6-#10 Storage: 🔶 Deferred to Phase 13 (require signed URL flow / HTTP testing)

## Deviations from Plan

- User accounts created via app signup instead of SQL (bcrypt/PBKDF2 incompatibility)
- Fixture script uses existing real stores/users instead of synthetic IDs
- Storage tests deferred — they require the persistence service from Phase 13

## Self-Check: PASSED
