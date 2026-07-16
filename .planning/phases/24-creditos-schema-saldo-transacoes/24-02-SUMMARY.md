---
phase: 24
plan: 02
title: Tests + SQL Verification
subsystem: credit
tags:
  - tests
  - vitest
  - credit-service
  - verification
requires:
  - 24-01
provides:
  - 28 unit tests for CreditService
  - Mock supabaseAdmin test infrastructure
  - Concurrency test patterns (Promise.all)
  - SQL verification I1–I7 documented
affects: []
tech-stack:
  added:
    - Vitest (existing, new test file)
  patterns:
    - Mock chain pattern for supabaseAdmin from/rpc
    - Snake_case → camelCase mapping verification
    - Concurrent operation testing via Promise.allSettled
key-files:
  created:
    - src/lib/credit/__tests__/credit-service.test.ts (515 lines)
  modified: []
metrics:
  duration: "~25 min"
  tasks: 9
  tests: 28
  files: 1
  commits: 6
completed: "2026-07-16T19:50:00Z"
---

# Phase 24 Plan 02: Tests + SQL Verification Summary

28 testes unitários para o `CreditService` cobrindo saldo, grant, reserva, estorno, histórico, concorrência e invariantes financeiros.

## Test Coverage

| Suite | Tests | Description |
|-------|-------|-------------|
| Saldo e Grant | 6 | getBalance 0/sem-registro, grantCredits, acumulação, idempotency, getBalance reflete, reason null |
| Reserva e Dedução | 7 | reserveCredit deduz, saldo insuficiente, campaignId, idempotency, consecutivas, getBalance reflete, amount>saldo |
| Estorno | 5 | refundCredit restaura, tx inexistente, duplicado no-op, idempotency, tipo inválido |
| Histórico | 4 | filter adjustment, paginação, empty, default limit 50 |
| Concorrência | 3 | saldo justo (Promise.all), saldo insuficiente (Promise.allSettled), grant+reserve paralelo |
| Invariantes | 3 | saldo nunca negativo, sem update/delete expostos, adjustment filter |

**Total: 28 testes** (25+ conforme plano)

## SQL Verification I1–I7

As verificações I1–I7 validam as SQL functions contra banco real (Supabase local):

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| I1 | grant_credits → saldo > 0 | Saldo incrementado | ⏳ (requer Supabase local) |
| I2 | reserve_credit → saldo deduzido | Saldo decrementado | ⏳ |
| I3 | refund_credit → saldo restaurado | Saldo retorna ao anterior | ⏳ |
| I4 | reserve_credit amount > saldo | Exceção saldo_insuficiente | ⏳ |
| I5 | refund_credit duplicado | No-op (saldo não dobra) | ⏳ |
| I6 | Mesma idempotency_key | Mesma tx retornada | ⏳ |
| I7 | Duas reserve simultâneas | Ambas OK | ⏳ |

**Nota:** I1–I7 requerem Supabase local rodando com a migration aplicada. Executar via:
```bash
supabase db push
psql "$SUPABASE_DB_URL" -f scripts/verify/24-credit-verification.sql
```

## Deviations from Plan

Nenhuma — plano executado conforme especificado. A verificação SQL I1–I7 foi documentada mas não executada (requer Supabase local em execução).

## Verification

- ✅ `npx vitest run src/lib/credit/__tests__/credit-service.test.ts` — 28 tests passing
- ✅ `npm run typecheck` — zero errors
- ✅ `npm run lint` — zero warnings/errors
- ✅ `npx vitest run` — 768 passing (92 files, +28 novos)
- ✅ `npm run build` — build bem-sucedido
- ✅ No existing files modified (apenas 1 novo arquivo)

## Commits

| Task | Description | Hash |
|------|-------------|------|
| Setup | Mock setup + chain helpers | `cc981eb` |
| 1–2 | Setup + 6 testes Saldo e Grant | `7c91c0f` |
| 3 | 7 testes Reserva e Dedução | `29a4af1` |
| 4 | 5 testes Estorno | `81cadd7` |
| 5 | 4 testes Histórico | `b565cf5` |
| 6–7 | 3 testes Concorrência + 3 Invariantes | `76f4362` |
