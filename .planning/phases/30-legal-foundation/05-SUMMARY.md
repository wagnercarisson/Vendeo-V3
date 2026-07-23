---
phase: 30
plan: 05
subsystem: legal
tags: [account, admin, badges]
key-files:
  created:
    - src/components/legal/legal-status-section.tsx
  modified:
    - src/app/(app)/conta/page.tsx
    - src/app/(app)/admin/users/[id]/page.tsx
metrics:
  new-components: 1
  modified-pages: 2
---

# Plan 30-05 Summary — Account + Admin Legal Status

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1–2 | 9439e9f | Conta legal section + admin legal badges |

## What was built

- **LegalStatusSection** — Client component with privacy status, consent toggle (grant/revoke), acceptance status with re-aceite link
- **/conta page** — "Privacidade e Termos" card added with all 3 legal status indicators
- **/admin/users/[id] page** — "Situação Legal" card with badges:
  - Privacy: ✅ Ciente / ❌ Não registrado
  - Acceptance: ✅ Vigente / ⏳ Pendente / ❌ Nunca aceitou
  - Consent: ✅ Ativo / ⏳ Revogado / ❌ Nunca definido
  - Full acceptance history table with document type, version, date, source, IP

## Deviations

None.

## Self-Check: PASSED
- TypeScript: 0 errors
- Git commit: 9439e9f
