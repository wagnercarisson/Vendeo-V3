---
phase: quick-mrr
plan: 01
type: execute
subsystem: admin
tags: [test-store, metrics, admin-pages, migration]
key-files:
  created:
    - supabase/migrations/20260731000001_admin_test_store_filter.sql
  modified:
    - src/lib/metrics/pipeline-metrics.ts
    - src/app/(app)/admin/page.tsx
    - src/app/(app)/admin/campaigns/errors/page.tsx
    - src/app/api/admin/campaigns/errors/route.ts
    - src/app/(app)/admin/users/page.tsx
    - src/app/api/admin/users/route.ts
    - src/app/(app)/admin/metrics/page.tsx
    - src/lib/metrics/__tests__/pipeline-metrics.test.ts
    - src/app/api/admin/__tests__/users.test.ts
    - src/app/api/admin/__tests__/campaigns-errors.test.ts
decisions:
  - "Opção A — p_store_kind ternário no SQL: production | test | all em todas as RPCs, com JOIN stores e filtro CASE explícito"
  - "RPC única admin_get_metrics retorna bundle JSONB com pipeline + VS + wallet, substituindo N funções JS individuais com cache por (hours, storeKind)"
  - "grant_monthly_credits: +WHERE is_test_store = FALSE — zero concessão para test stores"
  - "admin_grant_credits: não alterado — admin pode conceder para test stores"
duration: 0.8h
completed_date: 2026-07-30
---

# Quick Task 260730-mrr: Admin — Separar Test Store de Produção

**One-liner:** Implementar filtro ternário `p_store_kind` (production | test | all) em todas as RPCs, páginas, APIs e métricas do admin para separar dados de lojas de teste dos de produção, com RPC bundle para métricas e propagação `?view=all` de ponta a ponta.

## Wave Overview

| Wave | Tasks | Commits | Status |
|------|-------|---------|--------|
| 1 — Migration SQL | 1.1, 1.2 | `7dfd5a9` | ✅ |
| 2 — pipeline-metrics.ts | 2.1, 2.2 | `c68d90c` | ✅ |
| 3 — Admin Pages | 3.1–3.4 | `4fbcd52`, `d690f60`, `dbb8dfd`, `6598e94` | ✅ |
| 4 — Tests | 4.1, 4.2 | `864b14a`, `7abffe5` | ✅ |
| 5 — UAT Manual | docs | N/A | ✅ (document-only) |

## Changes by File

### supabase/migrations/20260731000001_admin_test_store_filter.sql (NEW)
- `admin_get_users_summary`: +p_store_kind (production|test|all) ao final, preservando p_verification_status e defaults existentes. DROP FUNCTION explícito da assinatura anterior para evitar overloads.
- `admin_is_test_store(p_store_id UUID)`: novo helper RPC
- `admin_get_metrics(p_store_kind, p_hours, p_metric_type)`: nova RPC bundle que retorna JSONB com pipeline (total/success/error/avg_cost/avg_duration/active_users), VS (success_rate/error_rate/avg_duration) e wallet (credits_granted/credits_consumed_vs/refund_rate/vs_credits_consumed/vs_credits_refunded/vs_refund_rate) em uma chamada. Inclui cross-window refund logic via CTEs.
- `grant_monthly_credits`: +WHERE s.is_test_store = FALSE no cursor principal

### src/lib/metrics/pipeline-metrics.ts (REFACTORED)
- `fetchMetricsBundle(hours, storeKind)`: chama `admin_get_metrics` RPC uma vez por par (hours, storeKind)
- Cache interno `Map<string, MetricsBundle>` evita chamadas duplicadas (mesma RPC serve todas as funções)
- Todas as funções exportadas (`getSuccessRate`, `getErrorRate`, `getAvgCost`, `getAvgDuration`, `getCreditsGranted`, `getRefundRate`, `getActiveUsers`, `getVsSuccessRate`, `getVsErrorRate`, `getVsAvgDuration`, `getVsCreditsConsumed`, `getVsRefundRate`, `getVsCreditsRefunded`) agora aceitam `storeKind: StoreKind = 'production'` e leem do bundle
- `clearMetricsCache()` para isolamento em testes
- `MetricsBundle` e `StoreKind` tipos exportados

### src/app/(app)/admin/page.tsx (Dashboard)
- `admin_get_users_summary` chamado com `p_store_kind => 'production'`
- Campanhas com erro: `stores!inner(id, is_test_store)` + `.eq("stores.is_test_store", false)`

### src/app/(app)/admin/campaigns/errors/page.tsx (Campaign Errors)
- Select corrigido: `stores!inner(name, user_id, is_test_store)` (antes: `stores(name)`)
- Por padrão: `eq("stores.is_test_store", false)` — mostra só produção
- `?include_test=1`: remove filtro, exibe badge TESTE nas linhas
- Toggle visual "Incluir lojas de teste" / "Incluindo lojas de teste"

### src/app/api/admin/campaigns/errors/route.ts (Campaign Errors API)
- Mesma correção de select e filtro que a página
- Aceita `?include_test=1` para incluir test stores

### src/app/(app)/admin/users/page.tsx (Users)
- Select "Tipo" com opções: Todos (default), Produção, Teste
- `p_store_kind` propagado para RPC baseado na seleção
- Pagination links preservam filtro kind

### src/app/api/admin/users/route.ts (Users API)
- Aceita `?kind=production|test|all` e repassa para RPC

### src/app/(app)/admin/metrics/page.tsx (Metrics)
- `?view=all` → `storeKind='all'`, default → `'production'`
- `fetchMetrics(hours, storeKind)` propaga para todas as funções
- Botão toggle "Modo: Produção" / "Modo: Todos" no cabeçalho

### src/lib/metrics/__tests__/pipeline-metrics.test.ts (REFACTORED)
- Mocks migrados de `from()` para `rpc()` (admin_get_metrics bundle)
- Adicionados 8 cenários de filtro test store:
  - storeKind='test' retorna métricas só de teste
  - storeKind='all' inclui test stores
  - production < all (quando test stores existem)
  - Cache por (hours, storeKind)
  - Cache key varia por storeKind

### src/app/api/admin/__tests__/users.test.ts (+3 cenários)
- kind=production, kind=test, default kind=all

### src/app/api/admin/__tests__/campaigns-errors.test.ts (+3 cenários)
- Default exclui test stores, include_test=1 inclui, select stores!inner verificado

## Deviations from Plan

**None.** Plan executed exactly as written.

## Verification Artifacts

- All 8 commits created and tracked
- Migration file created: 20260731000001_admin_test_store_filter.sql
- All source files modified as specified
- Test files updated with new scenarios

## Wave 5 — UAT Manual (document-only)

### Pré-condição
- Existir ao menos 1 test store com campanhas, créditos, erros
- Existir ao menos 1 production store com campanhas, créditos, erros

### Roteiro

| # | Passo | Resultado esperado | Status |
|---|-------|--------------------|--------|
| 1 | Acessar `/admin` | Cards "Total de Usuários" e "Campanhas com Erro" mostram números de produção apenas | ⬜ Pendente |
| 2 | Acessar `/admin/metrics` | Métricas de pipeline, VS e wallet refletem apenas produção | ⬜ Pendente |
| 3 | Acessar `/admin/metrics?view=all` | Métricas incluem test stores | ⬜ Pendente |
| 4 | Acessar `/admin/campaigns/errors` | Nenhuma campanha de test store aparece | ⬜ Pendente |
| 5 | Acessar `/admin/campaigns/errors?include_test=1` | Campanhas de test stores aparecem com badge "TESTE" | ⬜ Pendente |
| 6 | Acessar `/admin/users` | Select "Tipo" presente, default "Todos" | ⬜ Pendente |
| 7 | Selecionar "Produção" em `/admin/users` | Apenas production stores aparecem | ⬜ Pendente |
| 8 | Selecionar "Teste" em `/admin/users` | Apenas test stores aparecem | ⬜ Pendente |
| 9 | Acessar `/admin/users/{test_user_id}` | Badge "TESTE" visível, dados normais | ⬜ Pendente |
| 10 | Executar monthly grant manualmente (RPC) | Nenhum crédito concedido para test stores | ⬜ Pendente |
| 11 | Verificar audit log | Ações em test stores ainda aparecem | ⬜ Pendente |

## Self-Check

| Check | Status |
|-------|--------|
| Migration file exists | ✅ |
| pipeline-metrics.ts refactored | ✅ |
| Admin Dashboard updated | ✅ |
| Campaign Errors page + API updated | ✅ |
| Admin Users page + API updated | ✅ |
| Admin Metrics page updated | ✅ |
| Pipeline metrics tests updated | ✅ |
| Admin API tests updated | ✅ |
| All 8 commits created | ✅ |
