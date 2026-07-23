---
phase: 30
plan: 04
subsystem: legal
tags: [pipeline, clearance, reaccept]
key-files:
  created:
    - src/app/(app)/legal/reaccept/page.tsx
    - src/app/(app)/legal/reaccept/reaccept-form.tsx
  modified:
    - src/app/api/campaign/generate-image/route.ts
    - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
    - src/components/flow/visual-signature-approval-modal.tsx
metrics:
  new-pages: 1
  modified-routes: 3
---

# Plan 30-04 Summary — Pipeline Guards + Re-aceite Flow

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1–3 | cfdd788 | Pipeline guards + VS guard + re-aceite page |

## What was built

- **Pipeline guard (generate-image)**: `requireLegalClearance` check after auth/ownership, before rate limit and balance check. 403 with `{ acceptUrl: "/legal/reaccept", requiredDocuments, reason }`
- **VS guard (generate-without-logo)**: Authoritative server-side `requireLegalClearance` before balance check
- **VS approval modal**: UX-level check via `GET /api/legal/status` before generation — shows blocking message with link
- **/legal/reaccept page**: Detects pending documents, shows change summary, provides "Aceitar nova versão" button that calls POST /api/legal/accept with source='login_reacceptance'

## Deviations

None.

## Self-Check: PASSED
- TypeScript: 0 errors
- Git commit: cfdd788
