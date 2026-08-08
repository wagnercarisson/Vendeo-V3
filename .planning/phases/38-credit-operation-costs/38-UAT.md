---
status: complete
phase: 38-credit-operation-costs
source: 38-01-SUMMARY.md, 38-02-SUMMARY.md, 38-03-SUMMARY.md, 38-04-SUMMARY.md, 38-05-SUMMARY.md, 38-06-SUMMARY.md, 38-07-SUMMARY.md, 38-08-SUMMARY.md
started: 2026-08-07T19:00:00Z
updated: 2026-08-08T00:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 4/4
name: UAT final F38 - todos os cenarios validados
expected: |
  4 cenarios UAT (custo dinamico 1->2, desliga operacao -> 503, fail-open linha inexistente, fail-closed banco indisponivel) validados manualmente + evidencias automatizadas. Fase pronta para openspec verify/arquivamento.
awaiting: openspec verify (proximo passo)

## Tests

### 1. Admin muda custo 1 -> 2
expected: |
  Em /admin/operation-costs, alterar `campaign_generation` de 1 para 2 com motivo obrigatorio. O formulario /campanhas/nova passa a mostrar "Custo: 2" e o balance-card passa a mostrar "Cada geracao consome 2 creditos.". O PUT retorna audit_id e a mudanca e auditada.
result: pass
note: "Validado manualmente pelo usuario."

### 2. Desliga operacao -> 503
expected: |
  Em /admin/operation-costs, desabilitar `campaign_generation` (enabled=false) com motivo. O formulario /campanhas/nova fica desabilitado com mensagem "Operacao desativada". Tentar gerar via API retorna 503 operation_disabled. Reativar (enabled=true) ao final.
result: pass
note: "2 bugs corrigidos e revalidados manualmente: (a) cache global de useOperationCosts gerava estado stale sem F5; (b) CTA Nova Campanha na mesma rota nao remontava o componente. Geracao bloqueada no servidor com 503 operation_disabled mesmo com UI stale (guard correto)."

### 3. Fail-open linha inexistente
expected: |
  Com uma operation_key valida mas sem linha na tabela credit_operation_costs, OperationCostService.getCost retorna source "fallback" com os defaults (1 credito, enabled=true) e a UI continua funcional. Coberto por testes unitarios do service (38-02) e garantido pela logica fail-open implementada.
result: pass
note: "Linha campaign_generation removida via service role; /campanhas/nova seguiu funcional com 'Custo: 1' (fallback). Seed restaurado ao final."

### 4. Fail-closed banco derrubado
expected: |
  Quando a leitura de credit_operation_costs falha de verdade (erro de rede/banco), a rota de geracao responde 503 operation_cost_unavailable, sem gerar nem reservar creditos, e a UI mostra "Tente novamente em alguns instantes".
result: pass
note: "Evidencia real: teste de integracao fail-closed (operation-cost-service.failclosed.integration.ts) aponta o service para URL de banco inacessivel e prova que getCost lanca OperationCostUnavailableError. Rota generate-image converte esse erro em 503 operation_cost_unavailable (teste automatizado route.test.ts:813, sem reserva/geracao). Simulacao de banco derrubado via REVOKE nao executada por falta de acesso DDL no ambiente."

## Automated Evidence

- `node scripts/verify/38-operation-cost-verification.mjs`: 19/19 pass (I1-I6a: RPC real + audit + idempotencia + rejeicao cost=0 + RLS anon bloqueada + trigger append-only + seeds).
- `npx vitest run --config vitest.integration.config.ts`: 3/3 pass (I6b: getCost real -> source 'table'; fail-closed: URL inacessivel -> OperationCostUnavailableError).
- `npx vitest run`: 1597/1597 pass.
- `npm run typecheck`: 0 errors.
- `npm run lint`: 0 warnings/errors.
- `npm run build`: success (51 static/dynamic routes).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0
