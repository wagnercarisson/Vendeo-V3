---
status: testing
phase: 32-freemium-anti-abuso-cnpj
source: 32-01-SUMMARY.md, 32-02-SUMMARY.md, 32-03-SUMMARY.md, 32-04-SUMMARY.md, 32-05-SUMMARY.md
started: 2026-07-27T18:57:00Z
updated: 2026-07-27T21:45:00Z
finalized: true
---

## Current Test

[testing complete]

## Tests

### 1. "Atualizar CNPJ" button appears on dashboard for stores without CNPJ
expected: Store without CNPJ sees amber banner with button on dashboard. Button is styled as primary button (bg-accent-green text-white). Clicking goes to /cadastro/cnpj.
result: pass

### 2. CNPJ update form — mask and validation
expected: /cadastro/cnpj shows form with CNPJ input masked as XX.XXX.XXX/YYYY-ZZ. Invalid CNPJ (wrong check digits) shows error on blur. Valid CNPJ + submit succeeds.
result: pass

### 3. Store creation — CNPJ is required
expected: POST /api/store with no CNPJ returns 400. Invalid CNPJ returns 400. Valid CNPJ creates store and returns cnpjMasked + onboardingGranted.
result: issue
reported: "dois issues: 1. campos com escrita truncada - Raz\u00e3o Social com escape visível no label e placeholder 2. erro exibido no topo mas ao clicar salvar user não percebe - sugestão: scroll to top on error"
severity: minor

### 4. Freemium onboarding — granted once per CNPJ root
expected: First store with a new CNPJ root gets onboardingGranted=true. Second store with same CNPJ root gets onboardingGranted=false. Credits are preserved.
result: pass

### 5. Freemium monthly — granted once per root per cycle
expected: Same CNPJ root does not receive monthly credits twice in the same cycle period.
result: pass

### 6. Admin — freemium badge, entitlement history, exception
expected: Admin user detail shows masked CNPJ, freemium badge (4 variants: active/exhausted/exception/empty), entitlement history table, and "Conceder exceção" button.
result: pass

### 7. Admin — user list shows CNPJ column and freemium filter
expected: Admin user list has CNPJ column (font-mono, masked). Filter dropdown with options: Todos, Sem CNPJ, Freemium ativo, Freemium usado, Freemium esgotado. Filter works correctly on desktop and mobile.
result: pass

### 8. Legal documents — ToS v1.2 and Privacy v1.1 available
expected: /docs/legal/terms-of-service-v1-2.md exists with CNPJ clauses. /docs/legal/privacy-policy-v1-1.md exists with LGPD CNPJ purposes.
result: pass

### 9. CNPJ library functions work correctly
expected: validateCnpj rejects invalid check digits, known sequences, wrong length. normalizeCnpj strips punctuation. hashCnpjRoot returns deterministic 64-char hex. maskCnpj returns masked format. compareBusinessName returns score without errors.
result: pass

## Summary

total: 9
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Labels show correct accented characters (Razão Social)"
  status: failed
  reason: "User reported: Raz\\u00e3o Social with escape visible in label and placeholder"
  severity: minor
  test: 3
  root_cause: "store-identity-form.tsx used \\u00e3 escape in JSX text content and attribute"
  artifacts:
    - path: "src/components/flow/store-identity-form.tsx"
      issue: "\\u00e3 used instead of actual ã character in label and placeholder"
  missing:
    - "Replace \\u00e3 with actual ã character"
  debug_session: ""

- truth: "Error message visible on submit failure"
  status: failed
  reason: "User reported: error at top of page but user doesn't notice after clicking save"
  severity: minor
  test: 3
  root_cause: "handleStep1Submit did not validate CNPJ client-side. Server 400 set error state but useEffect watching error was unreliable with React async batching. Error displayed at top but page didn't scroll."
  artifacts:
    - path: "src/components/flow/store-identity-form.tsx"
      issue: "No CNPJ validation in handleStep1Submit before save()"
  missing:
    - "Add validateCnpj() call in handleStep1Submit"
    - "Scroll to top synchronously in handler on field errors"
  debug_session: ""
  fix_commit: "777c2af"

