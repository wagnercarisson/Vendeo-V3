---
phase: quick-29.2
plan: 01
type: execute
completed_date: "2026-07-22T14:35:00.000Z"
duration_minutes: 8
subsystem: "credits, onboarding"
tags: ["onboarding-grant", "migration", "credits", "10-creditos", "v2"]
key_files:
  created:
    - supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql
  modified:
    - src/components/credit/balance-card.tsx
    - openspec/specs/onboarding-grant/spec.md
    - src/app/api/store/__tests__/route.test.ts
    - src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx
decisions:
  - "Migration v2 é CREATE OR REPLACE com DROP da assinatura antiga (12 params) + p_initial_grant_amount DEFAULT 10, sem editar migrations já aplicadas"
  - "REVOKE EXECUTE de PUBLIC/anon/authenticated + GRANT TO service_role — apenas backend pode chamar a RPC"
  - "Spec documenta que lojas existentes NÃO recebem backfill automático; beta tester é manual via admin grant"
metrics:
  duration: "8 min"
  commits: 3
  tests_passed: 10
  files_created: 1
  files_modified: 4
---

# Phase quick-29.2 Plan 01: Onboarding Grant — 10 Créditos

**One-liner:** Migration V2 com RPC parametrizável (p_initial_grant_amount DEFAULT 10) + microcopy atualizada + testes ajustados para onboarding grant de 10 créditos.

## Summary

Alterado o crédito inicial concedido na criação de loja de 5 para 10 créditos, mantendo bônus beta como operação manual via admin existente. A migration V2 adiciona `p_initial_grant_amount INTEGER DEFAULT 10` com `DROP` explícito da assinatura antiga, `REVOKE EXECUTE` de `PUBLIC`/`anon`/`authenticated` e `GRANT EXECUTE TO service_role`. Todas as referências de onboarding grant como 5 créditos foram atualizadas para 10.

## Tasks Executed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Criar migration V2 — RPC parametrizável com default 10 | `976a571` | `supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql` |
| 2 | Atualizar microcopy no BalanceCard e spec do onboarding grant | `cf0afe4` | `src/components/credit/balance-card.tsx`, `openspec/specs/onboarding-grant/spec.md` |
| 3 | Atualizar testes — route.store e dashboard-credits | `18b9343` | `src/app/api/store/__tests__/route.test.ts`, `src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx` |

## Verification Results

| Suite | Status | Tests |
|-------|--------|-------|
| route.test.ts | ✅ PASS | 3/3 |
| dashboard-credits.test.tsx | ✅ PASS | 3/3 |
| balance-display.test.tsx (unaltered) | ✅ PASS | 4/4 |
| `npm run typecheck` | ✅ PASS | Clean |
| `npm run lint` | ✅ PASS | Clean |

## Key Details

### Migration V2 (`20260722000001_create_store_with_initial_grant_v2.sql`)
- **DROP** da assinatura antiga de 12 parâmetros antes do CREATE OR REPLACE (Postgres identifica função por nome + tipos — sem o DROP, a assinatura antiga com 5 hardcoded continuaria existindo)
- **p_initial_grant_amount INTEGER DEFAULT 10** como 13º parâmetro posicional
- **grant_credits** chamado com `p_initial_grant_amount` em vez de hardcoded `5`
- **REVOKE EXECUTE** FROM PUBLIC, anon, authenticated
- **GRANT EXECUTE** TO service_role (backend usa supabaseAdmin)
- **REVERT** comment: `DROP FUNCTION IF EXISTS public.create_store_with_initial_grant CASCADE`
- 118 linhas

### Microcopy
- `balance-card.tsx:46`: "ganhar 5 créditos gratuitos" → "ganhar 10 créditos gratuitos"

### Spec Updates (`openspec/specs/onboarding-grant/spec.md`)
- Todas as referências de 5 → 10 créditos atualizadas
- Adicionada seção "Parametrização do valor do grant (v2)" documentando:
  - DEFAULT 10, caller não precisa ser alterado
  - Sem backfill para lojas existentes
  - Bônus beta tester manual via admin `CreditGrantForm`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — threat register T-29.2-01 (Tampering) was properly mitigated via REVOKE/GRANT security on the new migration.

## Self-Check: PASSED

- ✅ Migration file exists (118 lines, contains DROP, DEFAULT 10, REVOKE, GRANT, REVERT)
- ✅ Microcopy updated: "10 créditos gratuitos", no "5 créditos gratuitos" remaining
- ✅ Spec updated: all 5→10, parametrização v2, beta manual documented
- ✅ Store route tests pass (balance: 10)
- ✅ Dashboard-credits tests pass ("10 créditos")
- ✅ Balance-display tests pass (unaltered)
- ✅ Typecheck clean
- ✅ Lint clean
