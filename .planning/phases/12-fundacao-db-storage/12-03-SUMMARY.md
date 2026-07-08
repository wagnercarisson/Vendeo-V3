---
phase: 12
plan: 12-03
subsystem: scripts
tags:
  - verification
  - smoke-test
  - sql
requires:
  - 12-01 (campaigns table)
  - 12-02 (campaign-images bucket)
provides:
  - scripts/verify-phase12.sql with 9 smoke test blocks
  - 10-item UAT technical checklist
affects: []
tech-stack:
  added: []
  patterns:
    - DO $$ blocks with RAISE EXCEPTION for fast-fail verification
    - pg_policies queries for Storage policy validation
key-files:
  created:
    - scripts/verify-phase12.sql
  modified: []
key-decisions:
  - Each check is an independent DO $$ block for isolation
  - Failure uses RAISE EXCEPTION (fast-fail)
  - Success uses RAISE NOTICE 'PASS: ...'
  - Block 9 explicitly verifies absence of UPDATE policy
requirements-completed:
  - REQ-SMOKE-SQL
  - REQ-UAT-CHECKLIST
duration: "2 min"
completed: 2026-07-08
---

# Phase 12 Plan 03: Verify Script Summary

Script `scripts/verify-phase12.sql` with:
- Header documenting 10-item UAT technical checklist for manual verification
- 9 independent `DO $$` blocks: campaigns table, RLS, error_message CHECK, updated_at trigger, private bucket, 3 Storage policies, no-UPDATE immutability check
- Run instructions for psql or Supabase Studio SQL editor

## Tasks

### Task 12-03a: Write smoke SQL verification script
- **Status:** Complete
- **Commit:** 6ef2bd5
- 9 `DO $$` blocks, each with RAISE EXCEPTION on failure and RAISE NOTICE on success

### Task 12-03b: Write README/UAT checklist header
- **Status:** Complete
- File header documents all 10 manual verification items with run instructions

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
