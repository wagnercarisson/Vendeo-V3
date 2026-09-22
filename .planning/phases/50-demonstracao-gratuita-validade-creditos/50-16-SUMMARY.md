# Phase 50 Plan 16 Summary

## Status

Complete: data-subject request lifecycle is atomic, idempotent, transition-validated, and audited by SECURITY DEFINER RPCs.

## Completed

- Kept beta access request-only, with signup fail-closed by the existing `publicSignupEnabled` default and a documented 50-approved-email operational gate.
- Added optional, purpose-limited WhatsApp copy, privacy links, and persisted `privacy_notice_version: v1.4` without marketing consent.
- Preserved the Terms v1.5 age/authority declaration and did not add birth-date collection.
- Added the image rights/consent/minor-interest notice without a duplicate checkbox.
- Added the retention runbook covering operational data, WhatsApp disposal, 30-day closure handling, storage objects, and temporary/orphan uploads.
- Added admin registration and lifecycle management for `data_subject_requests`, including conditional transitions, cancellation rejection after `in_progress`, protocol/idempotency fields, and audit metadata.
- Replaced SELECT→INSERT/update-before-audit with transactional RPCs; concurrent registration is idempotent, rejected cancellation is audited, and audit failure rolls back the request mutation.
- Documented that titular rights are handled by support with protocol and that `support_credit_requests` is credit-only, not a LGPD/closure channel.

## File Matrix

- Existing plan scope: 3 files / 18 existing tests.
- `src/app/api/admin/data-subject-requests/route.ts`
- `supabase/migrations/20260923000001_f50_data_subject_request_rpcs.sql`
- `src/lib/__tests__/data-subject-requests.postgres.test.ts`

## Validation

- Focused PostgreSQL tests: PASS, 1 file / 4 tests.
- `supabase db reset --local`: PASS.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `git diff --check`: PASS; only existing LF/CRLF conversion warnings.
- OpenSpec strict: PASS.

## Blockers and Follow-up

- Legal retention periods and `due_at` remain intentionally unset/nullable until formal legal approval.
- The 50-participant count is an operational gate, not an invite platform; first-invite go-live gates remain tracked by F50-14.
- Remote database/RLS smoke tests were not run; this plan validates the local PostgreSQL contract only.
