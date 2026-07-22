# 29-3-03: Vercel Cron + Fallback Admin

**Status:** ✅ Complete  
**Wave:** 3  
**Date:** 2026-07-22

## Summary

Rota Vercel Cron `GET /api/cron/monthly-credits` com proteção CRON_SECRET, leitura de Launch Config, execução da RPC e logging via `logPipelineEvent()`. Fallback admin com botão de execução manual e resultado detalhado.

## What was built

- **GET /api/cron/monthly-credits**:
  - CRON_SECRET via Authorization Bearer header
  - Skip silencioso se monthlyCreditsEnabled=false
  - Chama grant_monthly_credits com parâmetros do Launch Config
  - logPipelineEvent: cron.monthly_credits (complete/failed)
  - Retorna { eligible, granted, skipped, errors }
- **vercel.json**: cron `0 6 * * *` apontando para a rota
- **POST /api/admin/monthly-credits/grant**:
  - Protegido por apiHandler + requireAdmin
  - Skip se monthlyCreditsEnabled=false
  - logPipelineEvent: admin.monthly_credits com actor_id
- **MonthlyCreditGrantButton**: client component com loading, resultado, erro
- **Admin dashboard**: card "Concessão Mensal de Créditos" com o botão

## Files changed

- `src/app/api/cron/monthly-credits/route.ts` (new)
- `vercel.json` (new)
- `src/app/api/admin/monthly-credits/grant/route.ts` (new)
- `src/components/admin/monthly-credit-grant-button.tsx` (new)
- `src/app/(app)/admin/page.tsx` (updated)

## Verification

- ✅ `npm run typecheck` — zero erros
- ✅ `npm run lint` — zero erros
