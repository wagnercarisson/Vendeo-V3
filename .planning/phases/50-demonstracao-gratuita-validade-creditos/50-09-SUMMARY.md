---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 09
status: completed
---

# 50-09 Summary

Reopened items completed: visible demo status/date and the no-campaign dashboard flow now preserve the full credit breakdown.

## Implemented

- Updated `BalanceCard` and `BalanceDisplay` to use available balance and expose demo status, local expiration date/time, relative expiration, and post-demo bonus/purchased balance.
- Updated `/conta` and dashboard credit loading to use `getBalanceBreakdown`; account notifications remain readable and markable through the existing notification list.
- Removed the 24-hour response SLA from credit support copy and preserved support-only wording without purchase language.
- Added demo balance, expiration, and derived status to the admin user detail page.
- Co-migrated the dashboard credit test mock to the breakdown API.

## Validation

- `npm run typecheck` passed.
- Focused Vitest suite passed: 4 files, 17 tests.
- Credit-surface copy scan found no `24h`, `Comprar créditos`, or `Adquirir créditos`.
- `git diff --check` passed.

## Notes

- No unrelated files were reverted or changed intentionally.
- The notification list and navigation bell were already implemented and were retained; `/conta` continues to source its list from `credit_notifications` with read-state updates.
