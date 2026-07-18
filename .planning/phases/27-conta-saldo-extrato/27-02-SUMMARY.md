# 27-02: Páginas e Integração — TransactionHistory + CreditCta + Dashboard + /conta + Geração

**Status:** ✅ Complete
**Wave:** 2
**Commits:** `0d61e9a`

## Deliverables

- **TransactionHistory** — Client Component with paginated table (5 columns), type mapping (grant→Concessão, deduction→Geração, etc.), Pagination from F21
- **CreditCta** — Client Component with modal/mailto, variants zero/low/normal
- **Dashboard** — balance badge in metrics grid (has_store_with_campaigns) and empty state (has_store_no_campaigns)
- **/conta** — credits section with BalanceCard + TransactionHistory + pagination (10/page via searchParams)
- **/campanhas/nova** — balance indicator before submit, button disabled when balance=0/null, CTA for zero credits, "Tentar novamente" on error

## Key Decisions Followed

- BalanceCard in /conta has CTA internally — no separate CreditCta (per plan warning)
- CreditCta used only in /campanhas/nova (standalone, no BalanceCard)
- Error never treated as saldo zero — distinct messages

## Verification

- All 832 tests passing (including fixed dashboard mocks)
- TypeScript clean, lint clean
