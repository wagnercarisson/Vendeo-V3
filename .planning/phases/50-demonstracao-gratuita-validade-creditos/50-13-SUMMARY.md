---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 13
status: partial
---

# Plan 50-13 Summary

Co-migrated remaining test fixtures and assertions for available credit balance,
signed storage URLs, and the current demo expiry wording. The legacy `balance`
field was removed from the `CreditService` test fixture. No production code,
migrations, or 50-14 work was changed.

## Verification

- `npx vitest run`: **PASS**, 364 files, 3745 passed, 1 skipped (3746 total).
- `npm run typecheck`: **PASS**, exit 0.
- `npm run lint`: **PASS**, exit 0.
- `npm run build`: **PASS**, exit 0.
- Focused co-migration: **PASS**, 5 files, 64 tests.
- Protected baseline: 79 entries reviewed; 2 mismatches recorded in `50-GATES.txt`.

## Blockers

- The protected baseline fence remains blocked for 2 inherited files:
  `src/app/api/campaign/generate-image/route.ts` and
  `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`.
- Those differences predate plan 50-13 and come from earlier F50
  `first_generation` and storage-privacy work. They were preserved and not
  reverted.
- No 50-14 task, migration, rollout, UAT, or cutover was executed.
