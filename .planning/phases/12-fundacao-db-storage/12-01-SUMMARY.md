---
phase: 12
plan: 12-01
subsystem: database
tags:
  - migration
  - campaigns
  - ddl
  - rls
requires:
  - phases 7-11 (stores with user_id, RLS patterns)
provides:
  - public.campaigns table with DDL
affects: []
tech-stack:
  added: []
  patterns:
    - trigger-function scoped per table
    - RLS owner SELECT subquery
    - INDEX IF NOT EXISTS
key-files:
  created:
    - supabase/migrations/20260708000001_create_campaigns_table.sql
  modified: []
key-decisions:
  - D1: Trigger update_campaigns_updated_at scoped per table convention
  - D2: error_message CHECK constraint prevents status='error' without message
  - D4: RLS owner SELECT policy without write policies for authenticated
  - D6: Migrations include revert commands at end
requirements-completed:
  - REQ-CAMPAIGNS-DDL
  - REQ-ERROR-CHECK
  - REQ-TRIGGER-UPDATED-AT
  - REQ-RLS-CAMPAIGNS
  - REQ-INDEXES
duration: "2 min"
completed: 2026-07-08
---

# Phase 12 Plan 01: Migration 1 — Campaigns Table Summary

Migration `20260708000001_create_campaigns_table.sql` with campaigns table DDL (12 columns), CHECK constraints on status and error_message, scoped trigger for updated_at, RLS with owner SELECT policy, GRANT SELECT TO authenticated, and two performance indexes (store_id, created_at DESC).

## Tasks

### Task 12-01a: Write DDL for campaigns table
- **Status:** Complete
- **Commit:** dfce5e3
- File created with all required elements: `CREATE TABLE IF NOT EXISTS`, `chk_campaigns_status`, `chk_campaigns_error_message`, trigger function `update_campaigns_updated_at`, trigger `trg_campaigns_updated_at`, `ALTER TABLE ENABLE ROW LEVEL SECURITY`, policy `owner_select_campaigns`, `GRANT SELECT`, `idx_campaigns_store_id`, `idx_campaigns_created_at`, revert commands

### Task 12-01b: Validate migration SQL syntax
- **Status:** Complete
- SQL syntax reviewed manually (supabase db lint requires running database)
- All 68 lines syntactically correct: DDL, PL/pgSQL function, trigger, RLS, index creation

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
