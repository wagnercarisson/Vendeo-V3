# Plan 10-03: Server Actions — Extração de Serviço + Guards — Summary

**Status:** Complete
**Date:** 2026-07-07

## Files Created

- `src/lib/store-identity-service.ts` — Serviço interno com `resolveStoreIdentity(store)`, `validateIdentityReference(snapshot)`, `buildCampaignBrief(snapshot, input)`. Sem `"use server"`.
- `src/__tests__/actions/store-identity-service.test.ts` — Testes unitários do serviço extraído
- `src/__tests__/actions/visual-signature-guards.test.ts` — Testes de auth guards nas Server Actions

## Files Modified

- `src/lib/actions/store.ts` — Removidas definições, agora reexporta de `@/lib/store-identity-service`
- `src/lib/visual-signature/server-actions.ts` — Adicionados `requireUser()` + `requireOwnership(storeId)` em `generateVariations`, `generateAutomatic`, `activateSignature`, `listSignatures`

## Quality

- `npx tsc --noEmit` — zero errors
- Nenhuma das funções extraídas aceita `storeId` cru do cliente — recebem `Store` já autorizada
