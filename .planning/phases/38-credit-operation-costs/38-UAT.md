---
status: in_progress
phase: 38-credit-operation-costs
source: 38-01-SUMMARY.md, 38-02-SUMMARY.md, 38-03-SUMMARY.md, 38-04-SUMMARY.md, 38-05-SUMMARY.md, 38-06-SUMMARY.md, 38-07-SUMMARY.md, 38-08-SUMMARY.md
started: 2026-08-07T19:00:00Z
updated: 2026-08-07T20:05:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1/4
name: Admin muda custo 1 -> 2
expected: |
  Em /admin/operation-costs, alterar `campaign_generation` de 1 para 2 com motivo obrigatorio. O formulario /campanhas/nova passa a mostrar "Custo: 2" e o balance-card passa a mostrar "Cada geracao consome 2 creditos.". O PUT retorna audit_id e a mudanca e auditada.
awaiting: checkpoint humano

## Tests

### 1. Admin muda custo 1 -> 2
expected: |
  Em /admin/operation-costs, alterar `campaign_generation` de 1 para 2 com motivo obrigatorio. O formulario /campanhas/nova passa a mostrar "Custo: 2" e o balance-card passa a mostrar "Cada geracao consome 2 creditos.". O PUT retorna audit_id e a mudanca e auditada.
result: pass
note: "Validado manualmente pelo usuario."

### 2. Desliga operacao -> 503
expected: |
  Em /admin/operation-costs, desabilitar `campaign_generation` (enabled=false) com motivo. O formulario /campanhas/nova fica desabilitado com mensagem "Operacao desativada". Tentar gerar via API retorna 503 operation_disabled. Reativar (enabled=true) ao final.
result: pending
note: "Bug identificado: useOperationCosts mantinha cache global persistente, entao a UI so refletia a mudanca apos F5. Corrigido para sempre buscar na montagem. Aguardando revalidacao manual."

### 3. Fail-open linha inexistente
expected: |
  Com uma operation_key valida mas sem linha na tabela credit_operation_costs, OperationCostService.getCost retorna source "fallback" com os defaults (1 credito, enabled=true) e a UI continua funcional. Coberto por testes unitarios do service (38-02) e garantido pela logica fail-open implementada.
result: pass
note: "Verificado automaticamente: OperationCostService.getCost chave inexistente retorna source 'fallback' com DEFAULT_OPERATION_COSTS (testes unitarios 38-02)."

### 4. Fail-closed banco derrubado
expected: |
  Quando a leitura de credit_operation_costs falha de verdade (erro de rede/banco), a rota de geracao responde 503 operation_cost_unavailable, sem gerar nem reservar creditos, e a UI mostra "Tente novamente em alguns instantes".
result: pending
note: "Verificado automaticamente: testes unitarios da rota generate-image cobrem o caminho OperationCostUnavailableError -> 503 operation_cost_unavailable."

## Automated Evidence

- `node scripts/verify/38-operation-cost-verification.mjs`: 19/19 pass (I1-I6a: RPC real + audit + idempotencia + rejeicao cost=0 + RLS anon bloqueada + trigger append-only + seeds).
- `npx vitest run --config vitest.integration.config.ts`: 2/2 pass (I6b: OperationCostService.getCost real contra banco remoto -> source 'table').
- `npx vitest run`: 1592/1592 pass.
- `npm run typecheck`: 0 errors.
- `npm run lint`: 0 warnings/errors.
- `npm run build`: success (51 static/dynamic routes).

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0
