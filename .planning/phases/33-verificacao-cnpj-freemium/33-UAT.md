---
status: testing
phase: 33-verificacao-cnpj-freemium
source: 01-SUMMARY.md, 02-SUMMARY.md, 03-SUMMARY.md, 04-SUMMARY.md, 05-SUMMARY.md
started: 2026-07-28T19:35:00Z
updated: 2026-07-28T19:35:00Z
---

## Current Test

number: 9
name: Admin User Detail — Verification Card
expected: |
  Navigate to /admin/users/[id] for a user with a store that went through CNPJ verification. A verification card should show the status, official CNPJ data, and a "Revelar CNPJ" button.
awaiting: user response

## Tests

### 1. Store Creation with Valid CNPJ — Approve Flow
expected: Full flow: CNPJ lookup onBlur → auto-fill → submit → store created with freemium grant
result: pass
issues_fixed: [
  "cidade não preenchida — fix: municipio field name",
  "500 CHECK constraint — fix: approve → approved"
]

### 2. CNPJ Field Order
expected: CNPJ field appears before "Nome da Loja" in the form
result: pass

### 3. CNPJ not_found — Store Blocked
expected: Enter a non-existent CNPJ. On blur, shows red "CNPJ não encontrado na Receita Federal." Store creation is blocked.
result: pass

### 4. CNPJ Unavailable — DEFER Flow
expected: When both APIs are unavailable, store is created without freemium credits. verification_status = defer.
result: pass
verified_by: code analysis — route.ts:119-123 (defer path), verification-service.ts:52-64 (unavailable cascade), f33-verification-flows.test.ts:92-108 (pure function test)

### 5. Dashboard Banners — Review Status
expected: After creating a store that results in "review" status, dashboard shows an amber/yellow banner indicating the store is under review.
result: pass

### 6. Dashboard Banners — Approved Status
expected: After creating a store that results in "approved" status, dashboard shows a green one-time dismissible banner.
result: pass

### 7. Admin Reviews Page — Tabs and Actions
expected: Navigate to /admin/reviews. See 4 tabs: Pendentes, Adiados, Recusados, Aprovados. Each tab shows relevant stores. Click Approve/Reject/Exception on a pending store.
result: issue
reported: "Aprovou mas navegou para URL da API — tela branca com JSON cru"
severity: major
fix: "Substituiu <form action=... method=POST> por client component ReviewActions com fetch() e router.refresh()"

### 8. Admin Users — Verification Status Column
expected: Navigate to /admin/users. See verification_status column. Filter by verification status.
result: pass

### 9. Admin User Detail — Verification Card
expected: Navigate to /admin/users/[id]. See verification card with status, official data, and reveal CNPJ button.
result: [pending]

### 10. Test Store Creation
expected: Navigate to /admin/users/[id]/create-test-store. Create a test store. It is created with is_test_store=true and no external API call.
result: [pending]

### 11. Admin Nav Link
expected: Admin layout includes "Revisão" link in navigation.
result: [pending]

## Summary

total: 11
passed: 6
issues: 1
pending: 4
skipped: 0

## Gaps

- truth: "Address city is auto-filled from CNPJ lookup data"
  status: failed
  reason: "User reported: cidade não foi preenchido — estado foi exibido corretamente"
  severity: minor
  test: 1
  root_cause: "BrasilApiProvider.mapResponse used data.cidade but BrasilAPI returns municipio"
  artifacts:
    - path: "src/lib/cnpj/lookup-providers/brasil-api.ts"
      issue: "Field name cidade should be municipio"
  missing:
    - "Changed data.cidade to data.municipio in mapResponse"
  fix_applied: true

- truth: "Store creation with valid CNPJ succeeds with approved status"
  status: failed
  reason: "User reported: 500 error — violates check constraint stores_verification_status_check"
  severity: blocker
  test: 1
  root_cause: "evaluateFreemiumEligibility returns 'approve' but DB CHECK constraint expects 'approved'"
  artifacts:
    - path: "src/lib/freemium/freemium-risk-service.ts"
      issue: "returns decision: 'approve' instead of 'approved'"
    - path: "src/lib/freemium/types.ts"
      issue: "Decision type includes 'approve' instead of 'approved'"
  missing:
    - "Changed all 'approve' to 'approved' in types, service, route, and tests"
  fix_applied: true

- truth: "Admin approve action on /admin/reviews stays on page and shows result"
  status: failed
  reason: "User reported: navegou para URL da API — tela branca com JSON cru"
  severity: major
  test: 7
  root_cause: "Server component using <form action=... method=POST> causes native browser navigation to API endpoint"
  artifacts:
    - path: "src/app/(app)/admin/reviews/page.tsx"
      issue: "Native form submission navigates away from page"
  missing:
    - "Created ReviewActions client component with fetch() + router.refresh()"
  fix_applied: true

- truth: "Admin approve/reject audit log inserts include reason and valid action"
  status: failed
  reason: "User reported: 500 error — null value in column 'reason' of admin_audit_log"
  severity: blocker
  test: 7
  root_cause: "F33 RPCs INSERT into admin_audit_log without reason column; action CHECK constraint missing new action values"
  artifacts:
    - path: "supabase/migrations/20260728000001_f33_cnpj_verification.sql"
      issue: "Missing reason in approve and reject RPC INSERTs"
    - path: "src/app/api/admin/reviews/[id]/reveal-cnpj/route.ts"
      issue: "Missing reason in reveal-cnpj audit log INSERT"
  missing:
    - "Created migration 20260728000002_fix_f33_audit_log.sql with fixed RPCs and updated CHECK constraint"
    - "Fixed reveal-cnpj route with reason"
  fix_applied: true
