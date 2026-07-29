# Plan 02: Guarda Dupla + Fluxo Legacy — Summary

**Status:** ✅ Complete  
**Wave:** 2  
**Phase:** 34-store-readiness  
**Date:** 2026-07-29

## Deliverables

### Guarda de Readiness — Server Component
- `src/app/(app)/campanhas/nova/page.tsx`
  - Guarda `getStoreReadiness()` após store-exists check e ANTES do legal clearance
  - Se `cadastro_fiscal` ausente → redirect `/cadastro/cnpj?returnTo=/campanhas/nova`
  - Se `brand_profile` ausente → redirect `/loja?required=visual-direction`
  - Se `ready: true` → formulário renderiza normalmente

### Guarda de Readiness — API Route
- `src/app/api/campaign/generate-image/route.ts`
  - Guarda `getStoreReadiness()` após auth/ownership e ANTES de rate limit + saldo
  - Retorna HTTP 412 com `{ error: { message, reasons, missing } }`

### Fluxo Legacy — Redirect Encadeado
- `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx`
  - Fallback `nome_fantasia = razao_social` quando não informado
  - Pós-atualização: verifica readiness via `/api/store/check-readiness`
  - Se brand profile ausente → redirect `/loja?required=visual-direction`
  - Se pronto + returnTo → redirect para returnTo
  - Se pronto sem returnTo → redirect `/dashboard`

### API Route — Check Readiness
- `src/app/api/store/check-readiness/route.ts` — thin wrapper for `getStoreReadiness()`

### Mensagens de Contexto
- Página `/cadastro/cnpj` exibe banner contextual quando redirecionada de guard de readiness
- `?required=visual-direction` redirect usa mensagens específicas

### TypeScript
- `npx tsc --noEmit` — exit 0
