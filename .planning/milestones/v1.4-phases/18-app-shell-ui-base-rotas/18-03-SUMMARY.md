# 18-03: Route Migration + Polish + Testes

**Status:** ✓ Complete
**Date:** 2026-07-13
**Commit:** 6d97072

## Deliverables

### Route Migration
- `/campanha/[id]` → `/campanhas/[id]` com client.tsx (Lucide icons, PageHeader, Kit de Publicação)
- `/minhas-campanhas` → `/campanhas` com client.tsx (campaign list, design tokens)
- `/store` → `/loja` (account/profile page)
- `/dashboard` → placeholder funcional
- `/conta` → account settings page
- Old page directories removed (`campanha/`, `minhas-campanhas/`, `store/`, `campaign/preview/`)

### Auth & Middleware
- Middleware matcher updated for plural routes (`/campanhas`, `/loja`, `/conta`)
- `campaignUrl` updated to `/campanhas/:id` in generation flow
- `AuthHeader` component removed (dead code)
- `LogoutButton` refactored with design tokens (Button component, Lucide icons)

### Polish
- Campaign detail uses `PageHeader` with breadcrumbs, `Badge` (Editado), `Card`
- Campaign list uses `PageHeader` with breadcrumbs, `Button` (Nova Campanha), `Download` icon
- Disabled state for edit mode buttons with loading spinner
- All buttons use consistent Button component with min-height: 44px touch targets

### Tests (600 passing, 79 files)
- New: `src/__tests__/middleware.test.ts` — middleware auth + redirect tests
- New: `src/__tests__/next.config.test.ts` — 301 redirect validation
- Fixed: import paths `@/app/(app)/campanhas/[id]/client`
- Fixed: emoji→Lucide icon button text queries (`"Editar"` instead of `"✏️ Editar"`)
- Fixed: navigation assertion `"/campanhas/abc-123"` instead of `"/campanha/abc-123"`
- Fixed: duplicate text match for product name in breadcrumb + title

## Verification
- [x] Rotas migradas para plural (/campanhas, /loja, /conta)
- [x] Old directories removidos sem quebra
- [x] Middleware matcher atualizado
- [x] AuthHeader removido
- [x] LogoutButton refatorado
- [x] 301 redirects mantidos e testados
- [x] 600 testes passando (79 files)
- [x] TypeScript: clean | Lint: clean
