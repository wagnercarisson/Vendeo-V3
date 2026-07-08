---
status: complete
phase: 10-perimetro-multitenant
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md, 10-06-SUMMARY.md
started: 2026-07-08T16:30:00-03:00
updated: 2026-07-08T17:10:00-03:00
---

## Current Test

[testing complete]

## Tests

### 1. Cross-tenant isolation — store alheia retorna 404
expected: Fazer requisição GET para `/api/store/[id-alheio]/logo` retorna 404, nunca 403 ou 200. O usuário não descobre se a loja existe ou não.
result: pass
note: Testado via navegador — GET /api/store/6a7cc19f-446e-45b9-a114-c56e846267c6 retornou 404.

### 2. CSRF — mutação cross-origin retorna 403
expected: Enviar POST/PATCH/DELETE para qualquer rota mutante sem header Origin ou com Origin diferente do host retorna 403 Forbidden. A precedência CSRF > Auth garante que cross-origin sem sessão retorna 403 (nunca 401).
result: pass
note: Testado via curl com sessão válida + Origin maliciosa — POST /api/store/[id]/logo retornou 403. Bug de 500 fixado com apiHandler wrapper.

### 3. Unauthenticated access — sem sessão retorna 401/redirect
expected: Acessar qualquer rota `/api/store/*` sem cookie de sessão retorna 401 (API routes) ou redireciona para /login (page routes).
result: pass
note: Confirmado via middleware + apiHandler — testado anteriormente na fase 8/9.

### 4. Server Actions — ownership respeitado
expected: Executar Server Actions de visual-signature com storeId de outro usuário lança erro de ownership.
result: pass
note: Testes unitários em visual-signature-guards.test.ts (5/5 pass) e store-identity-service.test.ts (4/4 pass).

### 5. Campaign generate — storeId do body ignorado
expected: POST `/api/campaign/generate` ignora storeId no body, usa getCurrentStore().
result: pass
note: Verificado em código — route.ts linha 14-15 usa getCurrentStore(user.userId), storeId do body não é lido.

### 6. RLS + Storage policies
expected: Migration SQL contém RLS em 4 tabelas filhas + Storage policies tenant-isolated.
result: pass
note: Migration verificada em 20260707000001_enable_rls_child_tables.sql. 8/8 testes de migration passando.

### 7. Error contracts — erros centralizados
expected: Todas as rotas usam errors.ts como fonte única. Precedência CSRF (403) → Auth (401) → Ownership (404).
result: pass
note: errors.ts verificado. apiHandler wrapper garante precedência correta em todas as ~30 funções export.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none found]
