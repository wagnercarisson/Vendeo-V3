# 29-3-02: grant_monthly_credits RPC + Launch Config

**Status:** ✅ Complete  
**Wave:** 2  
**Date:** 2026-07-22

## Summary

grant_monthly_credits RPC incluída na migration com elegibilidade por idade, teto de bônus, grant parcial, SKIP LOCKED e idempotência por ciclo efetivo. Launch Config expandido com 4 novas flags de política mensal.

## What was built

- **grant_monthly_credits(amount, bonus_cap, min_store_age_days)** → JSONB já incluso na migration:
  - Pré-contagem de elegíveis e skipped
  - INSERT ON CONFLICT DO NOTHING para lojas sem credit_balances
  - FOR UPDATE SKIP LOCKED para concorrência
  - Grant parcial: LEAST(p_amount, p_bonus_cap - bonus_balance)
  - Idempotência: 'mensal_ciclo_{cycle}_{store_id}''
  - last_monthly_grant_at atualizado apenas com grant efetivo
  - Retorno: { eligible, granted, skipped, errors }
- **LaunchConfig**: 9 campos (5 existentes + 4 novos)
- **getLaunchConfig()**: ambas as branches retornam as 4 novas flags
- **.env.example**: VENDEO_MONTHLY_CREDITS_ENABLED, _AMOUNT, _BONUS_CAP, _MIN_STORE_AGE_DAYS

## Verification

- ✅ `npm run typecheck` — zero erros
- ✅ `npm run lint` — zero erros
