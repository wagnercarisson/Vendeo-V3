# Plan 01: Migration + Core Libraries — Summary

**Status:** ✅ Complete  
**Wave:** 1  
**Phase:** 34-store-readiness  
**Date:** 2026-07-29

## Deliverables

### Migration SQL
- `supabase/migrations/20260729000001_f34_store_readiness.sql`
  - `CREATE TABLE store_billing_info` — 18 campos, UNIQUE em store_id
  - RLS: `owner_select` (SELECT authenticated) + `service_role_manage` (ALL service_role)
  - `CREATE UNIQUE INDEX idx_store_billing_info_store_id`
  - Trigger `update_store_billing_info_updated_at` para updated_at automático
  - `CREATE FUNCTION check_store_readiness(p_store_id UUID) RETURNS JSONB` — RPC STABLE sem SECURITY DEFINER
  - REVOKE EXECUTE FROM public, GRANT TO authenticated + service_role
  - REVERT section ao final
  - ⚠ **Não aplicado** — Supabase local não disponível

### Core Library — Store Readiness
- `src/lib/store-readiness.ts` (server-only)
  - `MissingItem` type (`cadastro_fiscal` | `brand_profile`)
  - `StoreReadinessResult` interface
  - `getStoreReadiness(storeId)` — chamada RPC + fallback em erro

### Core Library — Store Billing Info
- `src/lib/billing/store-billing-info.ts` (server-only)
  - `StoreBillingInfo` interface (18 campos)
  - `StoreWithBillingInfo` type
  - `getStoreBillingInfo(storeId, userId)` — ownership check antes de ler
  - `upsertStoreBillingInfo(storeId, userId, data)` — ownership check + reset confirmed_at em edição

### Pure Module — CNPJ Address Mapper
- `src/lib/billing/cnpj-address-mapper.ts` (shared, sem server-only)
  - `getPreFillFromCnpj(cnpjData)` — mapeia 7 campos de endereço

### Store Type — CNPJ Fields
- `src/lib/store.ts` — 13 novos campos tipados (cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia, etc.)

### Cast Removal
- `src/app/(app)/dashboard/page.tsx` — casts substituídos por acesso direto
- `src/app/(app)/cadastro/cnpj/page.tsx` — casts substituídos
- ✅ Nenhum `as unknown as Record<string, unknown>` sobrevive em código de produção

### TypeScript
- `npx tsc --noEmit` — exit 0 (3 arquivos de teste atualizados com campos obrigatórios)
