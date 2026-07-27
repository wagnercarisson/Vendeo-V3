# Plan 01 — Summary

**Phase:** 32 — Freemium Anti-Abuso CNPJ
**Plan:** 01 — Migration SQL + CNPJ Core Library
**Wave:** 1
**Status:** ✅ Complete
**Date:** 2026-07-27

## Tasks

### Task 1: Migration SQL — Freemium Anti-Abuso CNPJ
- Migration única `20260727000001_freemium_anti_abuso_cnpj.sql` com 7 blocos:
  1. ALTER TABLE stores: `cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`, `cnpj_validation_score` + índices
  2. CREATE TABLE `freemium_entitlements` com ON DELETE SET NULL, RLS, índices únicos
  3. RPCs auxiliares: `try_grant_onboarding_entitlement`, `try_grant_monthly_entitlement`, `admin_grant_freemium_exception` (todas SECURITY DEFINER SET search_path = '')
  4. RPC `create_store_with_cnpj` — substitui `create_store_with_legal_acceptance`, aceita `p_cnpj_root_hash` pré-calculado
  5. RPC `update_store_cnpj` — para lojas legacy, NÃO concede créditos
  6. ALTER FUNCTION `grant_monthly_credits` — entitlement-aware, ignora lojas sem CNPJ
  7. INSERT `legal_document_versions` — terms_of_service v1.2, privacy_policy v1.1

### Task 2: CNPJ Core Library — 6 funções puras
- `types.ts`: CnpjInput, CnpjOutput, CnpjValidationResult, CnpjValidationScore
- `normalize.ts`: normalizeCnpj() — remove não-dígitos
- `validate.ts`: validateCnpj() — algoritmo oficial de dígitos verificadores do CNPJ
- `hash.ts`: hashCnpjRoot() — HMAC-SHA256 com process.env.CNPJ_PEPPER
- `mask.ts`: maskCnpj() — `**.***.***/0001-**`
- `similarity.ts`: compareBusinessName() — Levenshtein distance, score não-bloqueante
- `index.ts`: reexporta tudo

## Decisions
- `p_cnpj_root_hash` é pré-calculado pela rota server-side (hash não é calculado no banco)
- Todas RPCs SECURITY DEFINER com SET search_path = '' e nomes qualificados (public.*)
- `try_grant_*` RPCs usam ON CONFLICT com expressão (COALESCE(cycle, '_nostring_'))
- `admin_grant_freemium_exception` é transacional (entitlement + grant + audit_log)

## Files Created
- `supabase/migrations/20260727000001_freemium_anti_abuso_cnpj.sql` (230+ linhas)
- `src/lib/cnpj/types.ts`
- `src/lib/cnpj/normalize.ts`
- `src/lib/cnpj/validate.ts`
- `src/lib/cnpj/hash.ts`
- `src/lib/cnpj/mask.ts`
- `src/lib/cnpj/similarity.ts`
- `src/lib/cnpj/index.ts`
