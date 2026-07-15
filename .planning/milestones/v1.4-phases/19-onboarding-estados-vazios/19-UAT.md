---
status: complete
phase: 19-onboarding-estados-vazios
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md
started: "2026-07-13T18:00:00.000Z"
updated: "2026-07-13T18:10:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard — no_store state
expected: Dashboard mostra "Configure sua loja" com CTA → /loja quando usuário não tem loja
result: pass

### 2. Dashboard — has_store_no_campaigns state
expected: Dashboard mostra "Crie sua primeira campanha" com CTA → /campanhas/nova quando loja existe mas sem campanhas
result: pass

### 3. Dashboard — has_store_with_campaigns state
expected: Dashboard mostra placeholder "Seu dashboard está sendo preparado" sem CTA quando loja existe com campanhas
result: pass

### 4. /campanhas — no_store empty state (no redirect)
expected: Navegar para /campanhas sem loja mostra empty state "Configure sua loja" com CTA → /loja. NÃO redireciona.
result: pass

### 5. /campanhas/[id] — no_store returns 404
expected: Navegar para /campanhas/[id] sem loja retorna página 404. NÃO redireciona para /loja.
result: pass

### 6. /campanhas/nova — redirect mantido
expected: Navegar para /campanhas/nova sem loja redireciona para /loja (comportamento mantido)
result: pass

### 7. /campanhas — empty state text via microcopy
expected: Com loja mas sem campanhas, a lista em /campanhas mostra "Nenhuma campanha ainda" com CTA "Criar primeira campanha" → /campanhas/nova (texto vindo de microcopy.ts, não hardcoded)
result: pass

### 8. countCampaigns não chamado em /campanhas quando no_store
expected: Quando não há loja em /campanhas, countCampaigns NÃO é chamado (performance — evita query desnecessária)
result: pass
note: Verificado por teste automatizado (campanhas-page.test.tsx) — early return antes de listCampaigns

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
