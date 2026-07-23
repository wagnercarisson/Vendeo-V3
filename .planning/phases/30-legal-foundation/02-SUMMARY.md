---
phase: 30
plan: 02
subsystem: legal
tags: [types, services, clearance, core]
key-files:
  created:
    - src/lib/legal/types.ts
    - src/lib/legal/document-versions.ts
    - src/lib/legal/privacy.ts
    - src/lib/legal/consent.ts
    - src/lib/legal/acceptance-service.ts
    - src/lib/legal/clearance.ts
metrics:
  files: 6
  tests: 0
---

# Plan 30-02 Summary — Core Library: Types e Services

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1–6 | e2de329 | All 6 legal core library files |

## What was built

- **types.ts** — All shared types: LegalCapability, DocumentType, AcceptanceStatus, ClearanceResult, params interfaces
- **document-versions.ts** — Queries legal_document_versions table: getCurrentVersion, getVersionHistory, isVersionCurrent
- **privacy.ts** — registerPrivacyAcknowledgement (upsert), hasValidPrivacyAcknowledgement (compares version)
- **consent.ts** — recordConsentEvent (append-only INSERT), getEffectiveConsent (last event), revokeConsent
- **acceptance-service.ts** — registerAcceptance (resolves version server-side), registerAllContractAcceptances, getAcceptanceStatus (current/outdated/never), getStoreAcceptanceHistory
- **clearance.ts** — requireLegalClearance guard, CAPABILITY_DOCUMENTS and CAPABILITY_TREE constants

## Deviations

None. All files follow existing src/lib/ patterns using supabaseAdmin (service role).

## Self-Check: PASSED
- All 6 files created and compile (TypeScript: 0 errors)
- ESLint: 0 warnings/errors
- Git commit: e2de329
