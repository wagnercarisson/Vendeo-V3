# 27-01: Fundação — CreditService Session + BalanceDisplay + BalanceCard

**Status:** ✅ Complete
**Wave:** 1
**Commits:** `b7db26c`

## Deliverables

- **CreditService** constructor relaxed to accept `SupabaseClient` (not only `typeof supabaseAdmin`), backward compatible
- **countCreditTransactions(storeId)** — new method with `.neq("type", "adjustment")` + `{ count: "exact", head: true }`
- **BalanceDisplay** — Server Component with 3 variants (badge/card/inline) and 4 states (normal/low/zero/no-store)
- **BalanceCard** — Server Component with loading/error/ready states and CTA modal with mailto

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run src/lib/credit/` — 28 existing tests still passing (no regression)
- All existing CreditService usages in F24/F25/F26 compile without changes
