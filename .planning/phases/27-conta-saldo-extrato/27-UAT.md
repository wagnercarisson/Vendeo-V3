---
status: testing
phase: 27-conta-saldo-extrato
source:
  - 27-01-SUMMARY.md
  - 27-02-SUMMARY.md
  - 27-03-SUMMARY.md
started: 2026-07-18T19:20:00.000Z
updated: 2026-07-18T19:20:00.000Z
---

## Current Test

number: 5
name: /conta — CTA when balance is zero/baixo
expected: |
  When balance is 0, BalanceCard shows "Créditos insuficientes" and a "Solicitar créditos" button that opens a modal with mailto instructions.
awaiting: user response

## Tests

### 1. Dashboard — Balance badge visible with campaigns
expected: Dashboard with store and campaigns shows a 4th metric card "Créditos" with numeric balance value.
result: pass

### 2. Dashboard — No balance badge when no store
expected: User without store sees empty state, no "Créditos" card in the grid.
result: pass

### 3. /conta — BalanceCard shows current balance
expected: /conta page shows "Créditos" section with BalanceCard displaying the store's credit balance in large text.
result: pass

### 4. /conta — TransactionHistory with paginated list
expected: /conta shows "Extrato de Créditos" table with columns Tipo, Valor, Saldo, Motivo, Data. If multiple pages, pagination controls are visible.
result: pass

### 5. /conta — CTA when balance is zero/baixo
expected: When balance is 0, BalanceCard shows "Créditos insuficientes" and a "Solicitar créditos" button that opens a modal with mailto instructions.
result: [pending]

### 6. /conta — No store shows "Criar loja"
expected: User without store sees "Você ainda não tem uma loja" with CTA "Criar loja" → /loja.
result: [pending]

### 7. /campanhas/nova — Balance indicator before submit
expected: Form shows "Saldo: X créditos · Custo: 1" indicator before the "Criar Campanha" button. Button is enabled when balance ≥ 1.
result: [pending]

### 8. /campanhas/nova — Zero credits blocks generation
expected: When balance = 0, "Criar Campanha" button is disabled with tooltip "Você precisa de créditos para gerar uma campanha". CTA "Solicitar créditos" is visible.
result: [pending]

### 9. /campanhas/nova — Balance error shows distinct message
expected: When balance fails to load, shows "Não foi possível confirmar seu saldo. Tente novamente." Button disabled with tooltip, "Tentar novamente" button visible. Never treats error as zero (no CTA "Solicitar créditos").
result: [pending]

### 10. CreditCta — Modal opens with mailto when email configured
expected: CreditCta with variant="zero" and supportEmail shows button "Solicitar créditos". Click opens modal with mailto link to support email + instructions.
result: [pending]

## Summary

total: 10
passed: 1
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

[none yet]
