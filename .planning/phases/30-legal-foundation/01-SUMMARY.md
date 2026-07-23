---
phase: 30
plan: 01
subsystem: legal
tags: [migrations, docs, legal]
key-files:
  created:
    - supabase/migrations/20260723000001_create_legal_document_versions.sql
    - supabase/migrations/20260723000002_create_privacy_acknowledgements.sql
    - supabase/migrations/20260723000003_create_legal_acceptances.sql
    - supabase/migrations/20260723000004_create_user_consent_events.sql
    - supabase/migrations/20260723000005_create_legal_helpers.sql
    - supabase/migrations/20260723000006_seed_legal_document_versions_v1.sql
    - docs/legal/terms-of-service-v1.md
    - docs/legal/privacy-policy-v1.md
    - docs/legal/acceptable-use-v1.md
metrics:
  migrations: 6
  documents: 3
  tests: 0
---

# Plan 30-01 Summary — Migrations + Legal Documents Drafts

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1–7 | a2b0873 | All 6 migrations + 3 legal document drafts |

## What was built

- **6 migrations** establishing the legal database foundation:
  - `legal_document_versions`: version-controlled legal documents
  - `privacy_acknowledgements`: user privacy policy acknowledgement (PK = user_id)
  - `legal_acceptances`: contractual acceptance per store (UNIQUE store/doc/version)
  - `user_consent_events`: append-only LGPD consent log
  - `legal_helpers`: `has_valid_privacy_acknowledgement()`, `has_valid_acceptance()` SQL functions
  - Seed v1.0 for all 3 document types
- **Atomic RPC** `create_store_with_legal_acceptance()` replacing `create_store_with_initial_grant` — creates store + both acceptances + credit grant in one transaction. Service-role only.
- **3 legal document drafts** in `docs/legal/` with legal disclaimer:
  - Terms of Service v1.0
  - Privacy Policy v1.0 (LGPD)
  - Acceptable Use Policy v1.0

## Deviations

None.

## Self-Check: PASSED
- All 6 migration files created at correct paths
- All 3 document drafts created
- TypeScript compilation passes (no code changes)
- Git commit: a2b0873
