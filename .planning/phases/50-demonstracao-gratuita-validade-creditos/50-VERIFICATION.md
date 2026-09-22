# F50 Verification

Status: **CHECKPOINT 14.3 PENDING**

This record closes only tasks 14.1 and 14.2. No legal document, legal
publication migration, launch flag, cutover, demonstration UAT, or restored
backup was marked complete.

## Remote Evidence

- Supabase project: `gvbzwihwgzujwsviufgy` (`Vendeo-V3`)
- The 8 F50 structural migrations are applied and synchronized remotely.
- Local and remote `migration list` entries coincide.
- `credit_balances` preserved: 10 rows.
- `credit_transactions` preserved: 309 rows.
- `invalid_balances = 0`.
- `unexpected_demo = 0`.
- `f50_transactions = 0`.
- Private buckets verified: `store-brand-assets`, `visual-signatures`, `store-logos`.
- Production build approved.
- Deployment status: `Ready`.
- Dashboard, balance, logo, and visual-signature flows verified working.
- Public signup remains blocked.
- Access request flow verified working.
- Total `demo_balance = 0`.

## Task 14.1: Structural Migration

**PASS.** The following 8 migrations are applied and synchronized between local
and remote history:

```text
20260920000001_f50_demo_credits.sql
20260920000002_f50_storage_privacy.sql
20260921000001_f50_support_credit_request_rpc.sql
20260921000004_f50_admin_available_balance.sql
20260922000001_f50_data_subject_audit.sql
20260923000001_f50_data_subject_request_rpcs.sql
20260924000001_f50_notification_claim.sql
20260924000002_f50_support_status_rpc.sql
```

The migration list is coincident and the structural verification is complete.
No legal publication migration was applied.

## Task 14.2: Ledger Reconciliation

**PASS.** Read-only reconciliation confirmed preservation and clean F50
invariants:

```text
credit_balances: 10
credit_transactions: 309
invalid_balances: 0
unexpected_demo: 0
f50_transactions: 0
```

The three private identity buckets are confirmed. No unexpected demo grant or
F50 transaction was introduced during verification.

## Application Evidence

- Production build: approved.
- Deployment: `Ready`.
- Dashboard: working.
- Balance display: working.
- Logo flow: working.
- Visual-signature flow: working.
- Public signup: blocked as required.
- Access request: working as required.

## Pending Checkpoint

The next checkpoint is **14.3: identity of the PJ**. The following remain
explicitly pending and are not complete:

- PJ identity confirmation (legal name, CNPJ, professional address).
- Placeholder replacement in the three legal documents.
- Formal legal approval of the final three documents.
- Demonstration UAT before cutover.
- Legal publication migration.
- Launch flag changes and cutover.
- Post-cutover smoke test.
- Real backup restoration and go-live gates.

No code, structural migration, legal document, legal migration, or launch flag
was changed by this verification update.
