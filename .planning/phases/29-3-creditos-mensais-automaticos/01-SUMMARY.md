# 29-3-01: Modelo Contábil — Buckets + Categorias + Migração

**Status:** ✅ Complete  
**Wave:** 1  
**Date:** 2026-07-22

## Summary

Migration única que expande `credit_balances` com buckets (bonus_balance, purchased_balance), expande categorias de `credit_transactions` para 7 tipos, faz backfill dos dados existentes e reescreve as 3 SQL functions (`grant_credits`, `reserve_credit`, `refund_credit`) com lógica bucket-aware.

## What was built

- **Migration SQL** (`20260722000002_creditos_mensais_automaticos.sql`): 505 linhas
  - Novas colunas: `bonus_balance`, `purchased_balance`, `last_monthly_grant_at` em credit_balances
  - Backfill: saldo existente → bonus_balance, grant+onboarding → bonus_onboarding, grant+outros → admin_grant
  - 7 tipos de transação com CHECK constraints: bonus_onboarding, bonus_monthly, admin_grant, purchase, deduction, refund, adjustment
  - Trigger sync_credit_balances_total (balance = bonus + purchased)
  - Partial index idx_credit_balances_monthly_grant
- **grant_credits** reescrito com 6º parâmetro p_type (bucket-aware)
- **reserve_credit** reescrito: dedução prioritária de bônus, metadata com bonus_amount/purchased_amount
- **refund_credit** reescrito: lê metadata da deduction original, fallback legacy → bonus_balance
- **types.ts**: CreditTransactionTypeSchema com 7 valores, CreditBalance com bonusBalance/purchasedBalance
- **transaction-history.tsx**: TYPE_LABEL e TYPE_BADGE sem 'grant', com 3 novos labels
- **pipeline-metrics.ts**: getCreditsGranted busca 4 tipos de grant

## Files changed

- `supabase/migrations/20260722000002_creditos_mensais_automaticos.sql` (new)
- `src/lib/credit/types.ts` (updated)
- `src/components/credit/transaction-history.tsx` (updated)
- `src/lib/metrics/pipeline-metrics.ts` (updated)
- `src/lib/credit/__tests__/credit-service.test.ts` (updated)
- `src/components/credit/__tests__/transaction-history.test.tsx` (updated)
- `src/app/api/admin/__tests__/users.test.ts` (updated)

## Verification

- ✅ `npm run typecheck` — zero erros
- ✅ `npm run lint` — zero erros
