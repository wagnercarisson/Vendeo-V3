# Plan 10-04: RLS + Storage Policies — Summary

**Status:** Complete
**Date:** 2026-07-07

## Files Created

- `supabase/migrations/20260707000001_enable_rls_child_tables.sql` — Migration com RLS em 4 tabelas filhas + Storage policies tenant-isolated + documentação de exceção store-logos
- `src/__tests__/migrations/rls-policies.test.ts` — Testes de SQL estático (8 casos)

## Migration Details

### RLS Policies (3 tabelas com SELECT do owner)
- `store_brand_assets`: `owner_select_brand_assets`
- `store_brand_profiles`: `owner_select_brand_profiles`
- `store_visual_signatures`: `owner_select_visual_signatures`
- `generation_events`: default-deny (sem policy, apenas service_role)

### Storage Policies
- `tenant_isolation_brand_assets`: substitui `brand_assets_public_read` — path prefix `{store_id}/`
- `tenant_isolation_visual_signatures`: substitui `visual_signatures_public_read` — path prefix `{store_id}/`
- `store-logos`: exceção temporária mantida (Fase 11)

### GRANT SELECT
- `store_brand_assets`, `store_brand_profiles`, `store_visual_signatures`
- `generation_events` NÃO recebe GRANT (default-deny)

## Quality

- `npx vitest run` — 8/8 migration tests passing
- Block `-- REVERT:` completo incluso
