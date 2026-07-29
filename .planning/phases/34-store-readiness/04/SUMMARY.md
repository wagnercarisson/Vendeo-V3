# Plan 04: Dashboard Banner + Brand Profile Paths — Summary

**Status:** ✅ Complete  
**Wave:** 3  
**Phase:** 34-store-readiness  
**Date:** 2026-07-29

## Deliverables

### Dashboard Readiness Banner
- `src/components/readiness/readiness-banner.tsx` — presentational component with checklist
  - Links for each missing item: cadastro_fiscal → `/cadastro/cnpj?returnTo=/dashboard`, brand_profile → `/loja?required=visual-direction`
  - Shows ALL missing items (not just first)
  - "Configurar agora" button pointing to first pending item
- `src/components/readiness/readiness-check-banner.tsx` — async server component that calls `getStoreReadiness()` and conditionally renders banner
- Integrated in dashboard page for both `has_store_no_campaigns` and `has_store_with_campaigns` states
- Banner hidden when `ready: true` or no store

### Brand Profile Paths
- Three visual direction paths (Upload logo, Gerar VS, Text-only) already converge to brand profile synced via existing `/api/store/[id]/brand-profile/infer` route
- No changes needed — existing flow already creates brand profile records with status 'synced'

### TypeScript
- `npx tsc --noEmit` — exit 0
