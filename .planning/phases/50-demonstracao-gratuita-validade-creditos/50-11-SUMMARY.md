---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 11
status: completed
---

# Phase 50 Plan 11 Summary

Executed against the local PostgreSQL instance with the complete focused matrix passing.

## Completed

- Added unit coverage for demo states, post-materialization expiration, relative expiry, labels, entitlement eligibility, and fail-closed launch defaults.
- Added real PostgreSQL coverage for grant concurrency, expiration concurrency, reservation safety, grant idempotency, expiration idempotency, and notification/event deduplication.
- Added real integration coverage for refund branches, wrapper privileges, admin exception behavior, grant-free admin creation, and support atomicity.
- Preserved the original demo episode when refunding before expiry; a new 24-hour grace episode is expected only after expiry.
- OpenSpec tasks 11.1–11.7 are complete.

## Validation

- Complete focused suite: 5 files, 16 tests passed against local PostgreSQL.
- Typecheck, lint, and diff check passed.

## Limitation

The local Supabase stack was repaired by removing the orphaned vector container and running `supabase db reset --local`; all required migrations, including the support RPC, were applied before the final run.
