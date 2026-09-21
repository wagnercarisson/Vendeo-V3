---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 11
status: partial
---

# Phase 50 Plan 11 Summary

Partially executed against the local PostgreSQL instance; the plan remains open.

## Completed

- Added unit coverage for demo states, post-materialization expiration, relative expiry, labels, entitlement eligibility, and fail-closed launch defaults.
- Added real PostgreSQL coverage for grant concurrency, expiration concurrency, reservation safety, grant idempotency, expiration idempotency, and notification/event deduplication.
- Added real integration coverage for refund branches, wrapper privileges, admin exception behavior, grant-free admin creation, and support atomicity; these cases currently expose remaining blockers.
- Corrected `refund_credit` so an exhausted demo opens a new 24-hour grace episode.
- OpenSpec tasks 11.1–11.7 remain open until all real database assertions pass.

## Validation

- Existing focused suite: 4 files, 11 tests passed.
- New integration suite: blocked after exposing the refund behavior and missing local support RPC.

## Limitation

The local reset failed with a `schema_migrations_pkey` conflict. A subsequent migration-up attempt found the local database missing `storage.buckets`, and restarting Supabase encountered an existing `supabase_vector_Vendeo_V3` container-name conflict. Remaining blockers are: restore a coherent local migration state, apply `20260921000001_f50_support_credit_request_rpc.sql`, and rerun the refund/support integration assertions.
