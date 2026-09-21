# Phase 50 Plan 16 Summary

## Completed

- Kept beta access request-only, with signup fail-closed by the existing `publicSignupEnabled` default and a documented 50-approved-email operational gate.
- Added optional, purpose-limited WhatsApp copy, privacy links, and persisted `privacy_notice_version: v1.4` without marketing consent.
- Preserved the Terms v1.5 age/authority declaration and did not add birth-date collection.
- Added the image rights/consent/minor-interest notice without a duplicate checkbox.
- Added the retention runbook covering operational data, WhatsApp disposal, 30-day closure handling, storage objects, and temporary/orphan uploads.
- Added admin registration and lifecycle management for `data_subject_requests`, including conditional transitions, cancellation rejection after `in_progress`, protocol/idempotency fields, and audit metadata.
- Documented that titular rights are handled by support with protocol and that `support_credit_requests` is credit-only, not a LGPD/closure channel.

## Files

- `src/components/landing/access-request-form.tsx`
- `src/app/api/access-requests/route.ts`
- `src/components/flow/campaign-image-upload.tsx`
- `docs/operations/data-retention-runbook.md`
- `src/app/api/admin/data-subject-requests/route.ts`
- `src/app/(app)/admin/data-subject-requests/page.tsx`
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/tasks.md`

## Validation

- Focused landing tests: PASS, 2 files / 10 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `git diff --check`: PASS; only existing LF/CRLF conversion warnings.

## Blockers and Follow-up

- Legal retention periods and `due_at` remain intentionally unset/nullable until formal legal approval.
- The 50-participant count is an operational gate, not an invite platform; first-invite go-live gates remain tracked by F50-14.
- Remote database/RLS smoke tests were not run in this session.
