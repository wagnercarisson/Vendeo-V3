# F50 Verification

Status: **TECHNICAL GATES COMPLETE: ready for final verification and archival review**

This record confirms the previously completed structural/ledger evidence and
records the approved closed-beta posture. No legal document, legal publication
migration, launch flag, or cutover is marked complete by this document.

## Remote Evidence

- Supabase project: `gvbzwihwgzujwsviufgy` (`Vendeo-V3`)
- The 9 F50 structural migrations are applied and synchronized remotely.
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
- Closed-beta posture: `VENDEO_DEMO_CREDITS_ENABLED=false`,
  `VENDEO_EMAIL_ENABLED` absent or `false`, and
  `VENDEO_PUBLIC_SIGNUP_ENABLED=false`; no new users, checkout, charge, or
  monetization.

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
20260924000003_f50_access_request_limit.sql
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

## Telemetry 8.2

**PASS.** The five required events are present in code and focused tests:

- `demo_granted`: SQL/reconciler, dedup by `grant_tx_id`.
- `first_generation`: campaign and visual-signature routes, dedup by grant.
- `demo_exhausted`: reconciler, dedup by `deduction_tx_id`.
- `demo_expired`: reconciler, dedup by `expiration_tx_id`.
- `support_credit_request`: support route, multiple requests by `operationId`.

Focused validation passed: 5 files, 89 tests.

## Task 14.5: No Purchase or Monetization

**PASS.** The public credit-reservation failure in
`src/app/api/campaign/generate-image/route.ts` now reports
`Erro ao reservar créditos.` instead of payment language. The existing
`saldo_insuficiente` branch remains `402` with `Saldo insuficiente.`, while
internal reservation failures remain `500`; cleanup, logging, and reservation
logic are unchanged.

Regression coverage in
`src/app/api/campaign/generate-image/__tests__/route.test.ts` confirms that an
internal `reserveCredit` error returns `500`, the exact new message, and no
occurrence of `pagamento`. The existing insufficient-balance test remains in
place. The focused route suite passed with 64 tests, and `npm run typecheck`
passed.

The follow-up audit found no active checkout, credit purchase, subscription,
payment provider, or payment language in application routes/components. The
remaining matches are non-monetary: visual-signature terminology, internal AI
cost/ledger metadata, historical `purchase` credit type, and future legal text
in documents that are not published in the current beta posture. Fiscal store
billing remains data confirmation only.

## Task 14.4: Controlled Demonstration UAT

**PASS — HUMAN-APPROVED.** Wagner approved the controlled technical UAT on
23/09/2026 after reviewing six scenarios in both desktop and mobile viewports.
The six approved states were: active demonstration, expiring within 24 hours,
exhausted before expiry, expired/materialized, insufficient balance, and closed
demonstration with bonus credit available.

The matrix and the 12 individual visual PASS results are recorded in
`.planning/phases/50-demonstracao-gratuita-validade-creditos/50-UAT.md`. The
review confirmed coherent states, balances, local date/time and relative expiry
copy where applicable, correct CTAs, no expired demo balance in available
balance, usable post-demo bonus credits, no clipping/overlap/readability issue,
and no purchase, payment, or SLA language.

The UAT-only captcha correction is also recorded: `captcha_enabled` was changed
from `true` to `false` only in the isolated PostgreSQL instance
`f50_restore_20260923` on port `55432`. No production, remote, or main local
database flag was changed. Evidence filenames are listed in `50-UAT.md`; no
credentials or secrets were copied to the repository.

## Task 17.2: Real Restore

**PASS — RESTORE VALIDADO.** The test used only
`C:\Vendeo-Backups\f50-post-migration-20260923-clean` and ran in the isolated
Supabase environment `f50_restore_20260923`:

- Ports: API `55431`, database `55432`, Studio `55433`, Inbucket `55434`, analytics `55437`.
- Backup hashes: zero divergences.
- Database, roles, schema and data restored; F50 structures present.
- Ledger: no balance or transaction inconsistencies.
- Storage: 5 private buckets and `419/419` physical objects restored.
- All 419 objects were downloaded from the restored Storage and matched the backup SHA-256 values.
- A signed URL was generated for a restored object; download succeeded and its checksum matched.
- No remote writes were executed; the original Vendeo environment was preserved.

The local Storage runtime required the isolated-only compatibility index
`restore_objects_bucket_name_compat` to accept its upload conflict target. This
index is not part of the backup and must not become a production migration.

## Task 17.3: Closed-Beta Technical Gates

**PASS.** The technical gates were confirmed without changing production,
flags, legal documents, or admitting users:

- Production snapshot: 2 approved emails, 2 pending requests, 4 total access requests.
- `publicSignupEnabled=false`; anonymous access-request flow remains the only public path.
- The beta approval limit is enforced by `20260924000003_f50_access_request_limit.sql`, synchronized locally/remotely. `admin_review_access_request` remains `SECURITY DEFINER` with empty `search_path`, serializes approvals with a dedicated advisory lock, counts `COUNT(DISTINCT lower(email))`, and raises `access_limit_reached` before any request or audit mutation.
- Support operation, private buckets, telemetry evidence, and the restorable backup are PASS in the preceding sections.

This task does not authorize the post-PJ cutover, public signup, email activation,
MFA/go-live, legal publication, or new-user admission.

## Escopo transferido para quick pós-PJ

Não há tarefas pendentes pertencentes ao escopo de conclusão da F50. Os seis
registros abaixo foram transferidos sem serem marcados como concluídos e serão
executados somente após a constituição da PJ:

- 10.4, 10.5, 10.6, 14.3, 14.6 e 14.7 (todos FOLLOW-UP PÓS-PJ).
- O escopo preserva identidade da PJ, placeholders/datas, validação jurídica,
  publicação legal, corte, credenciais, MFA/go-live e smoke test pós-corte.

A quick pós-PJ ainda não foi criada. A F50 não foi arquivada nesta rodada.

No production, remote, or main local database, structural migration, legal
document, legal migration, production launch flag, or unrelated flow was
changed by this verification update. The UAT-only `captcha_enabled` change was
limited to the isolated restore database and is not a migration. The access
limit implementation was completed before this record; this update only records
its evidence and the completion of task 17.3.
